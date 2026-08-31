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
