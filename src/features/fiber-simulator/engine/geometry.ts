/**
 * ============================================================
 * محرك الهندسة — مسافات، إسقاط، والتقاط ذكي (Smart Snapping)
 * ============================================================
 * كل الوحدات بالمتر. الأولوية عند الالتقاط:
 * عقد قائمة (مناهيل/كبائن/FAT/نقاط دخول منازل) ← مسارات الحفر ← محاور شوارع ← شبكة.
 */

import type { MapRoad, Vec2 } from '../types';

export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

export function polylineLength(pts: Vec2[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]);
  return L;
}

/** إسقاط نقطة على قطعة مستقيمة */
export function projectOnSegment(p: Vec2, a: Vec2, b: Vec2): { point: Vec2; t: number; dist: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { point: a, t: 0, dist: dist(p, a) };
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const point = { x: a.x + t * dx, y: a.y + t * dy };
  return { point, t, dist: dist(p, point) };
}

/** تقاطع قطعتين مستقيمتين — يعيد نقطة التقاطع إن وقعت ضمن كلتا القطعتين */
export function segmentIntersection(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): Vec2 | null {
  const d1x = a2.x - a1.x;
  const d1y = a2.y - a1.y;
  const d2x = b2.x - b1.x;
  const d2y = b2.y - b1.y;
  const denom = d1x * d2y - d1y * d2x;
  if (denom === 0) return null; // متوازيان
  const wx = b1.x - a1.x;
  const wy = b1.y - a1.y;
  const t = (wx * d2y - wy * d2x) / denom;
  const u = (wx * d1y - wy * d1x) / denom;
  const eps = 1e-9;
  if (t < -eps || t > 1 + eps || u < -eps || u > 1 + eps) return null;
  return { x: a1.x + t * d1x, y: a1.y + t * d1y };
}

export interface NodeRef {
  id: string;
  x: number;
  y: number;
}

export interface SnapOptions {
  roads: MapRoad[];
  /** مسارات الحفر القائمة — تُلتقط بعد العقد وقبل الشوارع كي تلتصق
      صناديق FAT/FDC والمنشآت فوق المسار لا بجانبه */
  paths?: Vec2[][];
  nodes: NodeRef[];
  /** سماحية الالتقاط بالمتر (تُحسب عادة: 12 بكسل ÷ المقياس) */
  tolM: number;
  gridStep?: number; // افتراضياً 0.5م
  /** التقاط الزوايا القياسية أثناء رسم مسار (0/45/90) */
  orthogonalFrom?: Vec2 | null;
}

export interface SnapResult {
  point: Vec2;
  kind: 'node' | 'path' | 'road' | 'grid' | 'orthogonal' | 'free';
  targetId?: string;
}

/** إسقاط الزوايا القياسية 0/45/90 درجة من نقطة مرجعية */
function snapOrthogonal(from: Vec2, p: Vec2): Vec2 {
  const dx = p.x - from.x;
  const dy = p.y - from.y;
  const angle = Math.atan2(dy, dx);
  const len = Math.hypot(dx, dy);
  const step = Math.PI / 4; // 45°
  const snapped = Math.round(angle / step) * step;
  return { x: from.x + Math.cos(snapped) * len, y: from.y + Math.sin(snapped) * len };
}

export function computeSnap(raw: Vec2, opts: SnapOptions): SnapResult {
  // 1) العقد القائمة (أقرب عقدة ضمن السماحية)
  let bestNode: NodeRef | null = null;
  let bestNodeDist = Infinity;
  for (const n of opts.nodes) {
    const d = dist(raw, n);
    if (d <= opts.tolM && d < bestNodeDist) {
      bestNode = n;
      bestNodeDist = d;
    }
  }
  if (bestNode) return { point: { x: bestNode.x, y: bestNode.y }, kind: 'node', targetId: bestNode.id };

  // 2) مسارات الحفر القائمة (التصاق FAT/FDC والمنشآت فوق المسار)
  if (opts.paths && opts.paths.length > 0) {
    let bestPath: { point: Vec2; d: number } | null = null;
    for (const pts of opts.paths) {
      for (let i = 1; i < pts.length; i++) {
        const pr = projectOnSegment(raw, pts[i - 1], pts[i]);
        if (pr.dist <= opts.tolM && (!bestPath || pr.dist < bestPath.d)) {
          bestPath = { point: pr.point, d: pr.dist };
        }
      }
    }
    if (bestPath) return { point: bestPath.point, kind: 'path' };
  }

  // 3) محاور الشوارع
  let bestRoad: { point: Vec2; id: string; d: number } | null = null;
  for (const road of opts.roads) {
    const cl = road.centerline;
    for (let i = 1; i < cl.length; i++) {
      const pr = projectOnSegment(raw, cl[i - 1], cl[i]);
      if (pr.dist <= opts.tolM && (!bestRoad || pr.dist < bestRoad.d)) {
        bestRoad = { point: pr.point, id: road.id, d: pr.dist };
      }
    }
  }
  if (bestRoad) return { point: bestRoad.point, kind: 'road', targetId: bestRoad.id };

  // 3) الزوايا القياسية أثناء الرسم
  if (opts.orthogonalFrom) {
    const o = snapOrthogonal(opts.orthogonalFrom, raw);
    const d = dist(o, raw);
    if (d <= opts.tolM * 2) return { point: o, kind: 'orthogonal' };
  }

  // 4) شبكة نصف متر
  const step = opts.gridStep ?? 0.5;
  const gx = Math.round(raw.x / step) * step;
  const gy = Math.round(raw.y / step) * step;
  if (Math.hypot(gx - raw.x, gy - raw.y) <= Math.min(opts.tolM, 0.4)) {
    return { point: { x: gx, y: gy }, kind: 'grid' };
  }

  return { point: raw, kind: 'free' };
}

/** أقرب نقطة دخول منزل ضمن نطاق (لاستخدامها في أداة الإسقاط Drop) */
export function nearestBuildingConnection(
  p: Vec2,
  buildings: { id: string; connectionPoint: Vec2 }[],
  rangeM: number
): { id: string; point: Vec2 } | null {
  let best: { id: string; point: Vec2; d: number } | null = null;
  for (const b of buildings) {
    const d = dist(p, b.connectionPoint);
    if (d <= rangeM && (!best || d < best.d)) best = { id: b.id, point: b.connectionPoint, d };
  }
  return best ? { id: best.id, point: best.point } : null;
}

/* ============================================================
 * عمليات المضلعات — تدعم المضلعات الحقيقية المستوردة من GIS
 * ============================================================ */

/** هل النقطة داخل مضلع (ray casting) — مع هامش اختياري */
export function pointInPolygon(p: Vec2, ring: Vec2[], pad = 0): boolean {
  const n = ring.length;
  if (n < 3) return false;
  /* المربع المحيط أولًا — تسريع كبير للخرائط الكبيرة */
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const q of ring) {
    if (q.x < minX) minX = q.x;
    if (q.x > maxX) maxX = q.x;
    if (q.y < minY) minY = q.y;
    if (q.y > maxY) maxY = q.y;
  }
  if (p.x < minX - pad || p.x > maxX + pad || p.y < minY - pad || p.y > maxY + pad) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = ring[i];
    const b = ring[j];
    const intersect =
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** مركز ثقل المضلع (مساحي) — لوضع تسميات وعناصر داخل المبنى */
export function polygonCentroid(ring: Vec2[]): Vec2 {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    const cross = a.x * b.y - b.x * a.y;
    area += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  if (Math.abs(area) < 1e-9) {
    /* مضلع منحلّ — نرجع المتوسط الحسابي */
    let sx = 0, sy = 0;
    for (const q of ring) { sx += q.x; sy += q.y; }
    return { x: sx / ring.length, y: sy / ring.length };
  }
  area *= 0.5;
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

/** أقرب نقطة على محيط مضلع لنقطة مرجعية خارجية (بالتحديد على أقرب ضلع) */
export function nearestPointOnRing(p: Vec2, ring: Vec2[]): { point: Vec2; dist: number } {
  let best: { point: Vec2; dist: number } | null = null;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const pr = projectOnSegment(p, a, b);
    if (!best || pr.dist < best.dist) best = { point: pr.point, dist: pr.dist };
  }
  return best ?? { point: ring[0], dist: dist(p, ring[0]) };
}

/** أقرب نقطة على خط متعدد + مسافتها */
export function nearestPointOnPolyline(
  p: Vec2,
  pts: Vec2[]
): { point: Vec2; dist: number; segIndex: number } {
  let best: { point: Vec2; dist: number; segIndex: number } | null = null;
  for (let i = 1; i < pts.length; i++) {
    const pr = projectOnSegment(p, pts[i - 1], pts[i]);
    if (!best || pr.dist < best.dist) best = { point: pr.point, dist: pr.dist, segIndex: i - 1 };
  }
  return best ?? { point: p, dist: 0, segIndex: 0 };
}

/** مساحة مضلع (shoelace) بالمتر المربع */
export function polygonArea(ring: Vec2[]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[i].x * ring[j].y - ring[j].x * ring[i].y;
  }
  return Math.abs(a) / 2;
}
