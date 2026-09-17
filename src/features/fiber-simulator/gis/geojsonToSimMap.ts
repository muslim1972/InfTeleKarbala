/**
 * ============================================================
 * محوّل GeoJSON → SimMap — محاكي FTTH
 * ============================================================
 * يحوّل ملف GIS قياسي (FeatureCollection / EPSG:4326) إلى خريطة
 * يتعامل معها المحاكي بنفس دقة الخارطة الافتراضية:
 *
 *  - إسقاط محلي شبه-استوائي (equirectangular) بدقة < 0.1% للمسافات
 *    تحت 5كم — يتحوّل WGS84 (lon/lat) إلى متر (x,y).
 *  - مبانٍ Polygon  → MapBuilding (مضلع حقيقي + نقطة دخول ذكية
 *    على أقرب ضلع باتجاه أقرب شارع).
 *  - طرق LineString → MapRoad (محور + عرض من تصنيف OSM + سطح).
 *  - توليد المقسم (exchange) على أقرب ضلع لأهم شارع تلقائياً.
 *  - متطلبات (requirements) تتناسب مع حجم المنطقة وعدد الدور.
 *
 * الوحدة نقية (pure) — لا React ولا تأثيرات جانبية، تُستخدم من
 * واجهة الاستيراد وأي سكربت مستقبلي.
 */

import type { MapBuilding, MapRoad, SimMap, Vec2 } from '../types';
import {
  dist,
  nearestPointOnPolyline,
  nearestPointOnRing,
  polygonArea,
  polygonCentroid,
} from '../engine/geometry';

/* ======================= حدود الأمان ======================= */
/** سقف صارم لمنع إغراق المتصفح بملفات ضخمة (DoS) */
export const GIS_LIMITS = {
  maxFeatures: 500,
  maxRingPoints: 64,
  minBuildingAreaM2: 6,
  minRoadPoints: 2,
  maxRoadPoints: 200,
} as const;

/** نصف قطر البحث عن أقرب شارع لربط نقطة دخول المبنى (متر) */
const CONNECT_SEARCH_M = 120;

/** عرض الشارع الافتراضي حسب تصنيف OSM (متر) */
const ROAD_WIDTH: Record<string, number> = {
  motorway: 21,
  motorway_link: 12,
  trunk: 14,
  trunk_link: 10,
  primary: 11,
  primary_link: 8,
  secondary: 9,
  secondary_link: 7,
  tertiary: 7.5,
  tertiary_link: 6,
  unclassified: 6,
  residential: 6,
  living_street: 5,
  service: 4.5,
  road: 5,
  track: 3.5,
  footway: 2,
  path: 2,
  pedestrian: 3,
  cycleway: 2.5,
};

/** أولوية الشارع لاختيار موقع المقسم — الأصغرد أهمية */
const ROAD_PRIORITY: Record<string, number> = {
  motorway: 0,
  trunk: 1,
  trunk_link: 2,
  primary: 3,
  primary_link: 4,
  secondary: 5,
  secondary_link: 6,
  tertiary: 7,
  tertiary_link: 8,
};

export interface GisImportResult {
  map: SimMap;
  stats: {
    buildings: number;
    roads: number;
    skipped: number;
    bboxM: { w: number; h: number };
  };
  warnings: string[];
}

export class GisImportError extends Error {}

interface Rect { minX: number; minY: number; maxX: number; maxY: number; }

/* ======================= أدوات داخلية ======================= */

const r1 = (v: number): number => Math.round(v * 4) / 4; // دقة 0.25م

/**
 * قص خط متعدد على مستطيل (slab clipping) — يُنتج قطعاً متصلة
 * داخل المستطيل فقط. ضروري لقص الطرق التي تمتد خارج منطقة
 * التدريب (Overpass يرجع هندسة الطريق كاملة) ولاحتياط أي ملف
 * مستورد يحوي عناصر شاذة.
 */
function clipPolylineToRect(pts: Vec2[], rect: Rect): Vec2[][] {
  const inside = (p: Vec2) =>
    p.x >= rect.minX && p.x <= rect.maxX && p.y >= rect.minY && p.y <= rect.maxY;
  const pieces: Vec2[][] = [];
  let cur: Vec2[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const ain = inside(a);
    const bin = inside(b);
    if (ain && bin) {
      if (cur.length === 0) cur.push(a);
      cur.push(b);
    } else if (ain && !bin) {
      if (cur.length === 0) cur.push(a);
      cur.push(clipExit(a, b, rect));
      if (cur.length >= 2) pieces.push(cur);
      cur = [];
    } else if (!ain && bin) {
      cur = [clipExit(b, a, rect), b];
    }
    /* !ain && !bin — لا شيء */
  }
  if (cur.length >= 2) pieces.push(cur);
  return pieces;
}

/** نقطة خروج القطعة (a→b) من المستطيل — a داخل، b خارج */
function clipExit(a: Vec2, b: Vec2, rect: Rect): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t = 1;
  if (dx > 0) t = Math.min(t, (rect.maxX - a.x) / dx);
  else if (dx < 0) t = Math.min(t, (rect.minX - a.x) / dx);
  if (dy > 0) t = Math.min(t, (rect.maxY - a.y) / dy);
  else if (dy < 0) t = Math.min(t, (rect.minY - a.y) / dy);
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + dx * t, y: a.y + dy * t };
}

/** فحص بنية GeoJSON بصارمة — فاشل دائماً عند أي شك */
function assertFeatureCollection(raw: unknown): asserts raw is {
  type: 'FeatureCollection';
  features: unknown[];
} {
  if (typeof raw !== 'object' || raw === null) throw new GisImportError('الملف ليس كائناً صالحاً');
  const o = raw as Record<string, unknown>;
  if (o.type !== 'FeatureCollection')
    throw new GisImportError(`نوع الجذر "${String(o.type)}" — المتوقع FeatureCollection`);
  if (!Array.isArray(o.features)) throw new GisImportError('حقل features مفقود أو ليس قائمة');
  if (o.features.length === 0) throw new GisImportError('الملف لا يحتوي أي عنصر');
  if (o.features.length > GIS_LIMITS.maxFeatures)
    throw new GisImportError(
      `عدد العناصر ${o.features.length} يتجاوز السقف ${GIS_LIMITS.maxFeatures}`
    );
}

function asPos(coord: unknown): [number, number] | null {
  if (!Array.isArray(coord) || coord.length < 2) return null;
  const lon = typeof coord[0] === 'number' ? coord[0] : Number(coord[0]);
  const lat = typeof coord[1] === 'number' ? coord[1] : Number(coord[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
  return [lon, lat];
}

/** تقليل رؤوس الحلقة بتخطّي منتظم إن تجاوزت السقف */
function decimate<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const stride = Math.ceil(arr.length / max);
  const out: T[] = [];
  for (let i = 0; i < arr.length; i += stride) out.push(arr[i]);
  /* ضم النقطة الأخيرة لإغلاق الشكل */
  if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
  return out;
}

/* ======================= الإسقاط المحلي ======================= */

interface Projected {
  buildings: { ring: Vec2[]; props: Record<string, unknown> }[];
  roads: { pts: Vec2[]; props: Record<string, unknown> }[];
  w: number;
  h: number;
}

/**
 * إسقاط WGS84 → متر محلي. الخطوة الوحيدة التقريبية هي معامل
 * خط الطول (cos refLat) ودائرة الأرض — خطأها النسبي < 0.1% تحت 5كم
 * مما يكفي تماماً للتخطيط الهندسي على مستوى الحي.
 */
function projectCollection(fc: { features: unknown[] }): Projected {
  const lons: number[] = [];
  const lats: number[] = [];
  const rawBuildings: { ring: [number, number][]; props: Record<string, unknown> }[] = [];
  const rawRoads: { pts: [number, number][]; props: Record<string, unknown> }[] = [];

  let skipped = 0;

  for (const f of fc.features) {
    if (typeof f !== 'object' || f === null) { skipped++; continue; }
    const feat = f as Record<string, unknown>;
    const geom = feat.geometry as Record<string, unknown> | undefined;
    const props = (feat.properties ?? {}) as Record<string, unknown>;
    if (!geom || typeof geom !== 'object') { skipped++; continue; }

    if (geom.type === 'Polygon') {
      const coords = geom.coordinates as unknown[];
      if (!Array.isArray(coords) || coords.length === 0) { skipped++; continue; }
      const shell = coords[0];
      if (!Array.isArray(shell)) { skipped++; continue; }
      const ring: [number, number][] = [];
      for (const c of shell) {
        const p = asPos(c);
        if (!p) { ring.length = 0; break; }
        ring.push(p);
        lons.push(p[0]);
        lats.push(p[1]);
      }
      if (ring.length >= 4) rawBuildings.push({ ring, props });
      else skipped++;
    } else if (geom.type === 'LineString') {
      const coords = geom.coordinates as unknown[];
      if (!Array.isArray(coords)) { skipped++; continue; }
      const pts: [number, number][] = [];
      for (const c of coords) {
        const p = asPos(c);
        if (!p) { pts.length = 0; break; }
        pts.push(p);
        lons.push(p[0]);
        lats.push(p[1]);
      }
      if (pts.length >= GIS_LIMITS.minRoadPoints) rawRoads.push({ pts, props });
      else skipped++;
    } else {
      /* MultiPolygon / Point / GeometryCollection — نتجاوزها بأمان */
      skipped++;
    }
  }

  if (lons.length === 0) throw new GisImportError('لا توجد إحداثيات صالحة في الملف');

  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const refLat = (minLat + maxLat) / 2;
  const mPerLon = (111320 * Math.cos((refLat * Math.PI) / 180)) || 1;
  const mPerLat = 110574;

  /* y ينمو للأسفل => شمالًا للأعلى كالعادة في الخرائط */
  const toXY = ([lon, lat]: [number, number]): Vec2 => ({
    x: (lon - minLon) * mPerLon,
    y: (maxLat - lat) * mPerLat,
  });

  const buildings = rawBuildings.map(({ ring, props }) => ({
    ring: decimate(
      ring.map(toXY).map((p) => ({ x: r1(p.x), y: r1(p.y) })),
      GIS_LIMITS.maxRingPoints
    ),
    props,
  }));
  const roads = rawRoads.map(({ pts, props }) => ({
    pts: decimate(
      pts.map(toXY).map((p) => ({ x: r1(p.x), y: r1(p.y) })),
      GIS_LIMITS.maxRoadPoints
    ),
    props,
  }));

  return {
    buildings,
    roads,
    w: (maxLon - minLon) * mPerLon,
    h: (maxLat - minLat) * mPerLat,
  };
}

/* ======================= بناء المباني ======================= */

interface BuildingDraft {
  ring: Vec2[];
  props: Record<string, unknown>;
}

function buildBuildings(
  drafts: BuildingDraft[],
  roads: MapRoad[]
): { items: MapBuilding[]; skipped: number } {
  const items: MapBuilding[] = [];
  let skipped = 0;

  for (const { ring, props } of drafts) {
    /* إغلاق الحلقة إن لم تكن مغلقة */
    let closed = ring;
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first.x !== last.x || first.y !== last.y) closed = [...ring, { ...first }];

    const area = polygonArea(closed);
    if (area < GIS_LIMITS.minBuildingAreaM2) { skipped++; continue; }

    const c = polygonCentroid(closed);

    /* أقرب شارع — لنقطة دخول الكابل على أقرب ضلع باتجاه الشارع */
    let bestRoad: { point: Vec2; dist: number } | null = null;
    for (const r of roads) {
      const np = nearestPointOnPolyline(c, r.centerline);
      if (np.dist > CONNECT_SEARCH_M) continue;
      if (!bestRoad || np.dist < bestRoad.dist) bestRoad = { point: np.point, dist: np.dist };
    }

    const ref = bestRoad ? bestRoad.point : c;
    const onRing = nearestPointOnRing(ref, closed);
    const connectionPoint: Vec2 = { x: r1(onRing.point.x), y: r1(onRing.point.y) };

    items.push({
      id: '',
      label: '',
      polygon: closed,
      connectionPoint,
      name: typeof props.name === 'string' && props.name.trim() ? props.name.trim() : undefined,
    });
  }

  /* ترتيب صفّي (يسار→يمين، أعلى→أسفل) لتسميات منطقية H1..Hn */
  items.sort((a, b) => {
    const ay = a.polygon.reduce((m, p) => Math.min(m, p.y), Infinity);
    const by = b.polygon.reduce((m, p) => Math.min(m, p.y), Infinity);
    if (Math.abs(ay - by) > 8) return ay - by;
    const ax = a.polygon.reduce((m, p) => Math.min(m, p.x), Infinity);
    const bx = b.polygon.reduce((m, p) => Math.min(m, p.x), Infinity);
    return ax - bx;
  });

  items.forEach((b, i) => {
    b.id = `b${i + 1}`;
    b.label = `H${i + 1}`;
  });

  return { items, skipped };
}

/* ======================= بناء الطرق ======================= */

function guessSurface(props: Record<string, unknown>): 'asphalt' | 'soil' {
  const s = typeof props.surface === 'string' ? props.surface.toLowerCase() : '';
  if (['asphalt', 'paved', 'concrete', 'chipseal', 'metal'].some((k) => s.includes(k)))
    return 'asphalt';
  const hw = typeof props.highway === 'string' ? props.highway : '';
  /* الطرق الرئيسية مفترضة إسفلتية ما لم يُذكر خلاف ذلك */
  if (['motorway', 'trunk', 'primary', 'secondary', 'tertiary'].includes(hw)) return 'asphalt';
  return 'soil';
}

function buildRoads(
  drafts: { pts: Vec2[]; props: Record<string, unknown> }[]
): { roads: MapRoad[]; hw: string[] } {
  const roads: MapRoad[] = [];
  const hw: string[] = [];
  drafts.forEach(({ pts, props }, i) => {
    const cls = typeof props.highway === 'string' && props.highway ? props.highway : 'road';
    const lanesRaw = Number(props.lanes);
    const lanes = Number.isFinite(lanesRaw) && lanesRaw > 0 ? lanesRaw : 0;
    let width = ROAD_WIDTH[cls] ?? 5;
    if (lanes) width = Math.max(width, Math.min(24, lanes * 3.5));
    const name =
      (typeof props.name === 'string' && props.name.trim()) ||
      (typeof props.ref === 'string' && props.ref.trim()) ||
      `طريق ${i + 1}`;
    roads.push({
      id: `r${i + 1}`,
      name,
      centerline: pts,
      width: r1(width),
      surface: guessSurface(props),
    });
    hw.push(cls);
  });
  return { roads, hw };
}

/* ======================= موقع المقسم ======================= */

/**
 * يضع المقسم على رصيف أهم شارع (الأعلى تصنيفاً ثم الأطول)،
 * بإزاحة عمودية نحو أقرب حافة للخريطة.
 */
export function placeExchange(
  roads: MapRoad[],
  roadHw: string[],
  bounds: Vec2
): { point: Vec2; label: string } {
  let bestIdx = -1;
  let bestScore = Infinity;
  for (let i = 0; i < roads.length; i++) {
    const cls = roadHw[i] ?? '';
    const prio = ROAD_PRIORITY[cls] ?? 99;
    const score = prio * 1000 - polylineLen(roads[i].centerline) / 10;
    if (score < bestScore) { bestScore = score; bestIdx = i; }
  }

  let anchor: Vec2;
  let width = 6;
  if (bestIdx >= 0) {
    const cl = roads[bestIdx].centerline;
    anchor = cl[Math.floor(cl.length / 2)];
    width = roads[bestIdx].width;
  } else {
    anchor = { x: bounds.x * 0.5, y: bounds.y * 0.5 };
  }

  /* إزاحة عمودية نحو أقرب حافة للخريطة — المقسم على الرصيف */
  const cx = bounds.x / 2;
  const cy = bounds.y / 2;
  const dx = anchor.x - cx;
  const dy = anchor.y - cy;
  const len = Math.hypot(dx, dy) || 1;
  const off = width / 2 + 5;
  const p: Vec2 = {
    x: anchor.x + (dx / len) * off,
    y: anchor.y + (dy / len) * off,
  };
  /* تثبيت داخل الحدود بهامش أمان */
  p.x = Math.max(6, Math.min(bounds.x - 6, p.x));
  p.y = Math.max(6, Math.min(bounds.y - 6, p.y));

  return { point: { x: r1(p.x), y: r1(p.y) }, label: 'المقسم الرئيسي' };
}

function polylineLen(pts: Vec2[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]);
  return L;
}

/* ======================= بصمة فريدة ======================= */

function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/* ======================= النقطة العامة ======================= */

export interface GisConvertOptions {
  /** اسم اختياري للخريطة — يُشتق من بيانات الملف إن لم يُمرَّر */
  name?: string;
  /** مستوى اختياري — يُحسب تلقائياً من عدد الدور */
  level?: SimMap['level'];
}

export function geoJsonToSimMap(
  rawText: string,
  opts: GisConvertOptions = {}
): GisImportResult {
  /* 1) تحليل آمن — JSON.parse وحده (لا eval أبداً) */
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new GisImportError('تعذّر تحليل JSON — الملف تالف أو ليس JSON صالحاً');
  }
  assertFeatureCollection(parsed);

  /* 2) حزم حجم الملف الخام حماية إضافية */
  if (rawText.length > 8_000_000)
    throw new GisImportError('حجم الملف يتجاوز 8MB — استورد منطقة أصغر');

  /* 3) الإسقاط إلى متر محلي */
  const proj = projectCollection(parsed);
  if (proj.buildings.length === 0)
    throw new GisImportError('لا توجد مبانٍ صالحة (Polygon مغلقة بمساحة كافية)');

  /* 4) صندوق منطقة التدريب = تجمّع المباني + هامش عمل.
     نصقص عليه كل الطرق حتى لا تمتد طرق رئيسية خارج الحي —
     Overpass يرجع هندسة الطريق كاملة بلا قص. */
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const { ring } of proj.buildings)
    for (const p of ring) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  const MARGIN = 14;
  const clip: Rect = {
    minX: minX - MARGIN,
    minY: minY - MARGIN,
    maxX: maxX + MARGIN,
    maxY: maxY + MARGIN,
  };

  /* 5) قص الطرق على صندوق منطقة التدريب (قد تتفتت الطريقة
     الواحدة لعدة قطع — نُبقيها كلها بنفس الاسم) */
  const clippedRoads: { pts: Vec2[]; props: Record<string, unknown> }[] = [];
  let droppedRoads = 0;
  for (const rd of proj.roads) {
    const pieces = clipPolylineToRect(rd.pts, clip);
    if (pieces.length === 0) { droppedRoads++; continue; }
    for (const pts of pieces) clippedRoads.push({ pts, props: rd.props });
  }

  /* 6) الطرق أولاً (تحتاجها المباني لربط نقاط الدخول) */
  const { roads, hw } = buildRoads(clippedRoads);

  /* 7) المباني بنقاط دخول ذكية */
  const { items: buildings, skipped } = buildBuildings(proj.buildings, roads);
  if (buildings.length === 0)
    throw new GisImportError('لا توجد مبانٍ صالحة (Polygon مغلقة بمساحة كافية)');

  /* 8) أبعاد الخريطة = صندوق منطقة التدريب */
  const widthM = Math.max(40, Math.ceil(clip.maxX - clip.minX));
  const heightM = Math.max(40, Math.ceil(clip.maxY - clip.minY));
  const ox = clip.minX;
  const oy = clip.minY;
  const shift = (p: Vec2): Vec2 => ({ x: r1(p.x - ox), y: r1(p.y - oy) });
  for (const b of buildings) {
    b.polygon = b.polygon.map(shift);
    b.connectionPoint = shift(b.connectionPoint);
  }
  for (const r of roads) r.centerline = r.centerline.map(shift);

  /* 9) المقسم + المتطلبات */
  const exchange = placeExchange(roads, hw, { x: widthM, y: heightM });
  const maxDim = Math.max(widthM, heightM);
  const level: SimMap['level'] =
    opts.level ?? (buildings.length <= 8 ? 'beginner' : buildings.length <= 20 ? 'intermediate' : 'advanced');

  const fcName = (parsed as { name?: unknown }).name;
  const name =
    opts.name ??
    (typeof fcName === 'string' && fcName.trim() ? fcName.trim() : `خريطة مستوردة (${buildings.length} دار)`);

  const signature = `${parsed.features.length}:${buildings.length}:${roads.length}:${minX},${minY}`;
  const id = `gis-${shortHash(name.toLowerCase())}-${shortHash(signature)}`;

  const map: SimMap = {
    id,
    name,
    level,
    widthM,
    heightM,
    buildings,
    roads,
    exchange,
    requirements: {
      homes: buildings.length,
      minRxDbm: -24,
      maxDropMeters: Math.max(60, Math.min(160, Math.round(maxDim * 0.45))),
      budgetPerHomeUSD: 175,
      notes: `مستوردة من GeoJSON — ${buildings.length} مبنى، ${roads.length} طريق. الأبعاد ${widthM}×${heightM}م.`,
    },
  };

  const warnings: string[] = [];
  if (skipped > 0) warnings.push(`تخطّي ${skipped} عنصراً غير صالح (مساحة صغيرة أو إحداثيات ناقصة)`);
  if (droppedRoads > 0)
    warnings.push(`أُسقطت ${droppedRoads} طريقاً خارج منطقة التدريب`);
  const decimated = proj.buildings.some((b) => b.ring.length >= GIS_LIMITS.maxRingPoints);
  if (decimated)
    warnings.push(`بعض المباني اختُزلت رؤوسها إلى ${GIS_LIMITS.maxRingPoints} للحفاظ على الأداء`);
  if (roads.length === 0) warnings.push('لا توجد طرق — سيعتمد ربط نقاط الدخول على أقرب محيط');

  return {
    map,
    stats: { buildings: buildings.length, roads: roads.length, skipped, bboxM: { w: Math.round(proj.w), h: Math.round(proj.h) } },
    warnings,
  };
}
