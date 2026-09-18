/**
 * ============================================================
 * جلب الخرائط من OpenStreetMap في الوقت الفعلي — محاكي FTTH
 * ============================================================
 * استراتيجية الجلب (محدّثة بعد التشخيص الميداني على VPS):
 *  - خادمنا (VPS) معزول بلا إنترنت صادر — لا يستطيع الوصول إلى
 *    Overpass إطلاقاً (تأكدنا بقياسات curl من المضيف والحاويات).
 *  - لذلك الجلب يتم مباشرةً من متصفح المستخدم (الذي عليه اتصال).
 *  - overpass-api.de الرئيسي محجوب من شبكة المؤسسة (HTTP 406 حتى
 *    مع POST) — مؤكَّد تجريبياً.
 *  - المرايا العاملة من شبكتنا (مع CORS: ACAO *): private.coffee
 *    (الأسرع — 2.4ث لاستعلام المدينة القديمة)، ثم mail.ru و
 *    kumi.systems (رسميتان لكنهما تعودان 504 "مشغول" في أوقات
 *    الذروة حتى للاستعلامات الصغيرة — مؤكَّد تجريبياً).
 *  - كل محاولة لها مهلة صارمة (45 ثانية) حتى لا يبقى الزر
 *    معلقاً بلا إشعار، وأي فشل يُجمَع في رسالة عربية واضحة تميّز
 *    "الخادم مزدحم" عن "لا اتصال".
 *
 * دالة الخادم (gis-overpass) تبقى منشورة كجسر مستقبلي إن أُتيح
 * إنترنت صادر للخادم — العميل لا يعتمد عليها اليوم عمداً.
 *
 * العزل: وحدة نقيّة بلا React ولا اعتماديات خارجية.
 */

export interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface OsmPreset {
  id: string;
  /** اسم المنطقة كما يظهر للمستخدم */
  label: string;
  /** نبذة عن طبيعة المنطقة (تساعد المستخدم على الاختيار) */
  hint: string;
  bbox: BBox;
}

/**
 * مناطق جاهزة مأخوذة من مدن عراقية حقيقية. الصناديق صغيرة
 * (≈300–400م لكل ضلع) لتناسب حقول التدريب على شبكات FTTH.
 */
export const OSM_PRESETS: OsmPreset[] = [
  {
    id: 'karbala-east',
    label: 'كربلاء — شرق الحرم',
    hint: 'حي سكني منتظم خلف سور الإمام الحسين (ع)',
    bbox: { south: 32.618, west: 44.038, north: 32.621, east: 44.042 },
  },
  {
    id: 'karbala-abbas',
    label: 'كربلاء — حي العباس',
    hint: 'منطقة سكنية غرب الحرم، شبكة شوارع متعرّجة',
    bbox: { south: 32.61, west: 44.022, north: 32.6135, east: 44.026 },
  },
  {
    id: 'najaf-old',
    label: 'النجف — المدينة القديمة',
    hint: 'نسيج عمراني كثيف قرب الإمام علي (ع)',
    bbox: { south: 32.0005, west: 44.3325, north: 32.0035, east: 44.3355 },
  },
  {
    id: 'baghdad-karrada',
    label: 'بغداد — الكرادة',
    hint: 'منطقة تجارية سكنية داخل بغداد',
    bbox: { south: 33.317, west: 44.429, north: 33.32, east: 44.432 },
  },
  {
    id: 'basra-ashar',
    label: 'البصرة — العشّار',
    hint: 'وسط المدينة التاريخي على الشط',
    bbox: { south: 30.507, west: 47.781, north: 30.51, east: 47.784 },
  },
];

/* ======================= إعدادات الجلب ======================= */

/**
 * مرايا Overpass المتوافقة مع طلبات المتصفح (UA عادي + CORS) — بالترتيب.
 * private.coffee أولاً: الأسرع استجابة حالياً والأقل ازدحاماً (قياس 2.4ث
 * مقابل 30-48ث على المرايا الرسمية في أوقات الذروة).
 */
const BROWSER_ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/** مهلة كل محاولة — المناطق الكثيفة على مرآة مزدحمة قد تستغرق عشرات الثواني */
const ATTEMPT_TIMEOUT_MS = 45_000;
/** سقف عدد العناصر (حماية المتصفح من الإغراق) */
const MAX_FEATURES = 600;
/** كبح محلي — يمنع الضغط المتكرر السريع على Overpass */
const THROTTLE_MS = 4_000;
let lastFetchAt = 0;

export interface OsmFetchResult {
  geojson: string;
  meta: {
    buildings: number;
    roads: number;
    truncated: boolean;
    bboxM: { w: number; h: number };
  };
}

/** إشارة إلغاء بمهلة — بديل متوافق لكل المتصفحات عن AbortSignal.timeout */
function timeoutSignal(ms: number): AbortSignal {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

/** استعلام Overpass: مبانٍ وطرق داخل الصندوق، مع هندسة كاملة بلا قص.
 * مهلة الخادم (40ث) أقل من مهلة العميل (45ث) كي يرد الخادم بخطأ
 * واضح بدل أن يقطع المتصفح الاتصال بلا تشخيص. */
function buildOverpassQuery(bbox: BBox): string {
  const { south, west, north, east } = bbox;
  return [
    '[out:json][timeout:40];',
    '(',
    `  way["building"](${south},${west},${north},${east});`,
    `  way["highway"](${south},${west},${north},${east});`,
    ');',
    'out geom qt;',
  ].join('\n');
}

interface OverpassElement {
  type?: string;
  geometry?: Array<{ lat?: number; lon?: number }>;
  tags?: Record<string, string>;
}

/**
 * تحويل عناصر Overpass إلى GeoJSON قياسي (EPSG:4326) — نسخة العميل
 * المطابقة لمنطق الدالة الخادمية: مضلعات للمباني المغلقة وخطوط للطرق.
 */
function overpassToGeojson(
  data: unknown,
  bbox: BBox,
  name?: string
): OsmFetchResult {
  const features: Array<Record<string, unknown>> = [];
  let buildings = 0;
  let roads = 0;
  let truncated = false;

  const elements =
    (data as { elements?: OverpassElement[] } | null)?.elements ?? [];

  for (const el of elements) {
    if (el.type !== 'way' || !Array.isArray(el.geometry) || el.geometry.length < 2)
      continue;
    if (features.length >= MAX_FEATURES) {
      truncated = true;
      break;
    }
    const coords: number[][] = [];
    for (const g of el.geometry) {
      if (typeof g?.lat !== 'number' || typeof g?.lon !== 'number') continue;
      coords.push([g.lon, g.lat]);
    }
    if (coords.length < 2) continue;

    const isBuilding = Object.hasOwn(el.tags ?? {}, 'building');
    const closed =
      coords.length > 3 &&
      coords[0][0] === coords[coords.length - 1][0] &&
      coords[0][1] === coords[coords.length - 1][1];

    if (isBuilding && closed) {
      buildings++;
      features.push({
        type: 'Feature',
        properties: {
          kind: 'building',
          name: el.tags?.['name'] ?? el.tags?.['addr:housename'] ?? '',
          building: el.tags?.building ?? 'yes',
          floors: el.tags?.['building:levels'] ?? '',
          source: 'OpenStreetMap',
        },
        geometry: { type: 'Polygon', coordinates: [coords] },
      });
    } else if (!isBuilding) {
      roads++;
      features.push({
        type: 'Feature',
        properties: {
          kind: 'highway',
          name: el.tags?.name ?? '',
          highway: el.tags?.highway ?? 'road',
          lanes: el.tags?.lanes ?? '',
          surface: el.tags?.surface ?? '',
          source: 'OpenStreetMap',
        },
        geometry: { type: 'LineString', coordinates: coords },
      });
    }
  }

  if (features.length === 0) {
    throw new Error(
      'لا توجد مبانٍ أو طرق مسجلة في OpenStreetMap لهذه المنطقة — جرّب منطقة أخرى أكثر عمراناً'
    );
  }

  const geojson = {
    type: 'FeatureCollection',
    name: typeof name === 'string' && name.trim() ? name.trim() : 'خريطة جُلبت حيّاً',
    crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::4326' } },
    features,
  };

  const bboxM = {
    w: Math.round(
      (bbox.east - bbox.west) *
        111320 *
        Math.cos(((bbox.south + bbox.north) / 2) * (Math.PI / 180))
    ),
    h: Math.round((bbox.north - bbox.south) * 110574),
  };

  return {
    geojson: JSON.stringify(geojson),
    meta: { buildings, roads, truncated, bboxM },
  };
}

/** مستمع لمراحل الجلب — تعرضه الواجهة كتغذية راجعة حيّة للمستخدم */
export type OsmStageListener = (stage: string) => void;

/**
 * يطلب خريطة منطقة محددة من OpenStreetMap جلباً مباشراً من المتصفح.
 * يجرّب المرايا بالترتيب مع مهلة لكل محاولة، ويرجع نص GeoJSON جاهزاً
 * لإمراره إلى المحوّل، أو يرمي رسالة عربية واضحة تجمع أسباب الفشل.
 * onStage (اختياري): إشعار الواجهة بالمرآة الحالية قبل كل محاولة.
 */
export async function fetchOsmArea(
  bbox: BBox,
  name?: string,
  onStage?: OsmStageListener
): Promise<OsmFetchResult> {
  const now = Date.now();
  if (now - lastFetchAt < THROTTLE_MS) {
    const wait = Math.ceil((THROTTLE_MS - (now - lastFetchAt)) / 1000);
    throw new Error(`يرجى الانتظار ${wait} ثانية بين كل عملية جلب وأخرى`);
  }

  const query = buildOverpassQuery(bbox);
  const failures: string[] = [];

  for (let i = 0; i < BROWSER_ENDPOINTS.length; i++) {
    const endpoint = BROWSER_ENDPOINTS[i];
    lastFetchAt = Date.now();
    const host = new URL(endpoint).host;
    onStage?.(
      `المحاولة ${i + 1} من ${BROWSER_ENDPOINTS.length} عبر ${host} — المناطق المزدحمة قد تستغرق عشرات الثواني`
    );
    try {
      /* طلب بسيط بلا ترويسات مخصصة — لا preflight، وCORS مفعّل على المرايا */
      const res = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, {
        signal: timeoutSignal(ATTEMPT_TIMEOUT_MS),
      });
      if (!res.ok) {
        /* 504/429/5xx = المرآة مزدحمة (شائع في الذروة) وليس انقطاع اتصال */
        failures.push(
          `${host}: ${res.status === 504 || res.status === 429 || res.status >= 500 ? 'الخادم مزدحم حالياً' : `HTTP ${res.status}`}`
        );
        continue;
      }
      const data: unknown = await res.json();
      return overpassToGeojson(data, bbox, name);
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === 'AbortError';
      failures.push(`${host}: ${aborted ? 'تجاوز المهلة' : 'تعذر الوصول'}`);
    }
  }

  throw new Error(
    `تعذّر الجلب المباشر من OpenStreetMap (${failures.join(' · ')}) — المرايا مزدحمة أو الاتصال ضعيف، أعد المحاولة بعد قليل`
  );
}
