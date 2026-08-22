/**
 * ============================================================
 * محرك القواعد — الفحص الحي (Live Lint) للتصميم
 * ============================================================
 * يبني شبكة ربط (Graph) من مسارات الحفر ويحسب:
 * - الاتصال البصري: المقسم ← FDC ← FAT ← المنازل
 * - المسافات الحقيقية عبر الشبكة (Dijkstra)
 * - تغطية المنازل وجودة الإشارة عند كل دار (Power Budget)
 * - المخالفات الهندسية برسائل عربية واضحة
 */

import type {
  Cabinet,
  FatBox,
  ProjectEntities,
  SimMap,
  SplitterRatio,
  Vec2,
} from '../types';
import { dist, projectOnSegment } from './geometry';
import { computePowerBudget, type BudgetResult } from './physics';

/* ===================== منافذ القواسم ===================== */

export const SPLITTER_PORTS: Record<SplitterRatio, number> = {
  '1:4': 4,
  '1:8': 8,
  '1:16': 16,
  '1:32': 32,
};

/* ===================== شبكة الربط (Graph) ===================== */

export type NetAnchorKind = 'exchange' | 'cabinet' | 'fat';

export interface NetAnchor {
  kind: NetAnchorKind;
  id: string;
  p: Vec2;
}

export interface NetworkGraph {
  /** المسافة بالمتر بين مرساتين عبر شبكة الحفر — أو null إذا غير متصلين */
  distance(a: NetAnchor, b: NetAnchor): number | null;
  /** أقرب مسافة من نقطة إلى أي مسار حفر — أو null إذا لا مسارات */
  distanceToNetwork(p: Vec2): number | null;
}

interface GraphEdge {
  to: number;
  w: number;
}

/**
 * بناء شبكة الرابط: رؤوس مسارات الحفر + مراسي
 * (المقسم/الكبائن/FAT) موصولة بأقرب نقطة إسقاط على المسارات.
 */
export function buildNetwork(entities: ProjectEntities, exchange: Vec2): NetworkGraph {
  const nodes: Vec2[] = [];
  const edges: GraphEdge[][] = [];
  const keyOf = new Map<string, number>(); // "x|y" → index

  const addNode = (p: Vec2): number => {
    const key = `${p.x.toFixed(3)}|${p.y.toFixed(3)}`;
    const existing = keyOf.get(key);
    if (existing !== undefined) return existing;
    const idx = nodes.length;
    nodes.push(p);
    edges.push([]);
    keyOf.set(key, idx);
    return idx;
  };

  const link = (a: number, b: number, w: number) => {
    if (a === b || w <= 0.0001) return;
    edges[a].push({ to: b, w });
    edges[b].push({ to: a, w });
  };

  /* رؤوس المسارات */
  for (const t of entities.trenches) {
    let prev = addNode(t.points[0]);
    for (let i = 1; i < t.points.length; i++) {
      const cur = addNode(t.points[i]);
      link(prev, cur, dist(t.points[i - 1], t.points[i]));
      prev = cur;
    }
  }

  /* إدراج مرساة عبر أقرب إسقاط على المسارات */
  const anchors = new Map<string, number>();
  const attachAnchor = (a: NetAnchor): number => {
    const anchorIdx = addNode(a.p);
    anchors.set(`${a.kind}:${a.id}`, anchorIdx);
    if (entities.trenches.length === 0) return anchorIdx;

    let best: { proj: Vec2; d: number } | null = null;
    for (const t of entities.trenches) {
      for (let i = 1; i < t.points.length; i++) {
        const pr = projectOnSegment(a.p, t.points[i - 1], t.points[i]);
        if (!best || pr.dist < best.d) best = { proj: pr.point, d: pr.dist };
      }
    }
    if (best) {
      const projIdx = addNode(best.proj);
      link(anchorIdx, projIdx, best.d);
    }
    return anchorIdx;
  };

  const allAnchors: NetAnchor[] = [
    { kind: 'exchange', id: 'exchange', p: exchange },
    ...entities.cabinets.map((c) => ({ kind: 'cabinet' as const, id: c.id, p: { x: c.x, y: c.y } })),
    ...entities.fats.map((f) => ({ kind: 'fat' as const, id: f.id, p: { x: f.x, y: f.y } })),
  ];
  for (const a of allAnchors) attachAnchor(a);

  /* Dijkstra */
  const dijkstra = (from: number): number[] => {
    const n = nodes.length;
    const d = new Array<number>(n).fill(Infinity);
    const visited = new Array<boolean>(n).fill(false);
    d[from] = 0;
    for (;;) {
      let u = -1;
      let bestD = Infinity;
      for (let i = 0; i < n; i++)
        if (!visited[i] && d[i] < bestD) {
          u = i;
          bestD = d[i];
        }
      if (u === -1) break;
      visited[u] = true;
      for (const e of edges[u]) {
        const nd = d[u] + e.w;
        if (nd < d[e.to]) d[e.to] = nd;
      }
    }
    return d;
  };

  const cache = new Map<number, number[]>();
  const distancesFrom = (idx: number): number[] => {
    let c = cache.get(idx);
    if (!c) {
      c = dijkstra(idx);
      cache.set(idx, c);
    }
    return c;
  };

  const anchorIndex = (a: NetAnchor): number | undefined =>
    anchors.get(`${a.kind}:${a.id}`);

  return {
    distance(a, b) {
      if (entities.trenches.length === 0) return null;
      const ia = anchorIndex(a);
      const ib = anchorIndex(b);
      if (ia === undefined || ib === undefined) return null;
      const d = distancesFrom(ia)[ib];
      return Number.isFinite(d) ? d : null;
    },
    distanceToNetwork(p) {
      if (entities.trenches.length === 0) return null;
      let best: number | null = null;
      for (const t of entities.trenches) {
        for (let i = 1; i < t.points.length; i++) {
          const pr = projectOnSegment(p, t.points[i - 1], t.points[i]);
          if (best === null || pr.dist < best) best = pr.dist;
        }
      }
      return best;
    },
  };
}

/* ===================== تقرير الفحص ===================== */

export type Severity = 'error' | 'warning' | 'info';

export interface DesignIssue {
  id: string;
  severity: Severity;
  messageAr: string;
  hintAr?: string;
}

export interface HomeStatus {
  buildingId: string;
  label: string;
  covered: boolean;
  /** طول كابل الإسقاط بالمتر */
  dropMeters: number | null;
  /** طول المسار البصري الكلي من المقسم حتى الـ ONT بالمتر */
  fiberMeters: number | null;
  /** تفصيل مقاطع المسار البصري بالمتر — يغذّي منحنى OTDR */
  path: OpticalPath | null;
  budget: BudgetResult | null;
}

export interface OpticalPath {
  /** المقسم ← الكبينة FDC */
  exchangeToFdcM: number;
  /** الكبينة ← صندوق FAT */
  fdcToFatM: number;
  /** الإسقاط: FAT ← دخول الدار */
  dropM: number;
}

export interface DesignReport {
  homes: HomeStatus[];
  coverage: { covered: number; total: number };
  issues: DesignIssue[];
  worstRxDbm: number | null;
  opticalOk: boolean;
  /** إجمالي أطوال مسارات الحفر بالمتر */
  trenchMeters: number;
  network: NetworkGraph;
}

/** أقصى مسافة مسموحة بين FAT/الكبينة ومسار أنابيب قائم */
export const MAX_OFFSET_FROM_DUCT_M = 5;

export function lintDesign(entities: ProjectEntities, map: SimMap): DesignReport {
  const issues: DesignIssue[] = [];
  const homes: HomeStatus[] = map.buildings.map((b) => ({
    buildingId: b.id,
    label: b.label,
    covered: false,
    dropMeters: null,
    fiberMeters: null,
    path: null,
    budget: null,
  }));

  let trenchMeters = 0;
  for (const t of entities.trenches) {
    for (let i = 1; i < t.points.length; i++)
      trenchMeters += dist(t.points[i - 1], t.points[i]);
  }

  const network = buildNetwork(entities, map.exchange.point);

  /* ---------- قواعد الكبينة FDC ---------- */
  if (entities.cabinets.length === 0) {
    issues.push({
      id: 'no-fdc',
      severity: 'error',
      messageAr: 'لا توجد كبينة توزيع رئيسية FDC — يجب تركيبها أولاً قرب المقسم.',
    });
  }
  if (entities.cabinets.length > 1) {
    issues.push({
      id: 'multi-fdc',
      severity: 'warning',
      messageAr: `يوجد ${entities.cabinets.length} كبائن FDC — خريطة هذا المستوى تحتاج واحدة فقط.`,
    });
  }
  const fdc = entities.cabinets[0] as Cabinet | undefined;
  if (fdc) {
    const dExchange = network.distance(
      { kind: 'exchange', id: 'exchange', p: map.exchange.point },
      { kind: 'cabinet', id: fdc.id, p: { x: fdc.x, y: fdc.y } }
    );
    if (dExchange === null) {
      issues.push({
        id: 'fdc-disconnected',
        severity: 'error',
        messageAr: 'الكبينة FDC غير متصلة بالمقسم عبر مسارات حفر — مدّد مسار أنابيب بينهما.',
      });
    }
    const offset = network.distanceToNetwork({ x: fdc.x, y: fdc.y });
    if (offset !== null && offset > MAX_OFFSET_FROM_DUCT_M) {
      issues.push({
        id: 'fdc-offset',
        severity: 'warning',
        messageAr: `الكبينة FDC تبعد ${offset.toFixed(1)}م عن أقرب مسار أنابيب (الحد ${MAX_OFFSET_FROM_DUCT_M}م).`,
      });
    }
  }

  /* ---------- قواعد FAT ---------- */
  if (entities.fats.length === 0) {
    issues.push({
      id: 'no-fat',
      severity: 'error',
      messageAr: 'لا توجد أي صناديق توزيع FAT — ركّبها على مسارات الأنابيب داخل الزقاق.',
    });
  }

  const dropsPerFat = new Map<string, number>();
  for (const d of entities.drops)
    dropsPerFat.set(d.fromFatId, (dropsPerFat.get(d.fromFatId) ?? 0) + 1);

  for (const fat of entities.fats) {
    const fatAnchor: NetAnchor = { kind: 'fat', id: fat.id, p: { x: fat.x, y: fat.y } };

    const offset = network.distanceToNetwork({ x: fat.x, y: fat.y });
    if (offset === null || offset > MAX_OFFSET_FROM_DUCT_M) {
      issues.push({
        id: `fat-offset-${fat.id}`,
        severity: 'warning',
        messageAr: `صندوق FAT يبعد ${(offset ?? Infinity) > 1e6 ? 'بعيد جداً' : (offset ?? 0).toFixed(1)}م عن مسار الأنابيب — يجب أن يكون على المسار.`,
      });
    }

    if (fdc) {
      const dToFdc = network.distance(
        fatAnchor,
        { kind: 'cabinet', id: fdc.id, p: { x: fdc.x, y: fdc.y } }
      );
      if (dToFdc === null) {
        issues.push({
          id: `fat-disconnected-${fat.id}`,
          severity: 'error',
          messageAr: 'صندوق FAT غير متصل بالكبينة FDC عبر شبكة الأنابيب.',
        });
      }
    }

    const drops = dropsPerFat.get(fat.id) ?? 0;
    if (drops > 0 && !fat.splitter) {
      issues.push({
        id: `fat-no-splitter-${fat.id}`,
        severity: 'error',
        messageAr: 'صندوق FAT يخدم منازل دون قاسم بصري — ثبّت قاسماً داخله.',
      });
    }
    if (drops > fat.ports) {
      issues.push({
        id: `fat-ports-${fat.id}`,
        severity: 'error',
        messageAr: `عدد الإسقاطات من FAT (${drops}) يتجاوز منافذه (${fat.ports}).`,
      });
    }
    if (fat.splitter && drops > SPLITTER_PORTS[fat.splitter]) {
      issues.push({
        id: `fat-splitter-cap-${fat.id}`,
        severity: 'warning',
        messageAr: `القاسم ${fat.splitter} يوفر ${SPLITTER_PORTS[fat.splitter]} منافذ بينما الإسقاطات ${drops}.`,
      });
    }
  }

  /* ---------- قواعد الإسقاط والمنازل ---------- */
  const coveredSet = new Map<string, { meters: number; fat: FatBox }>();
  const dupHomes = new Set<string>();

  for (const d of entities.drops) {
    const fat = entities.fats.find((f) => f.id === d.fromFatId);
    if (!fat) continue;
    let L = 0;
    for (let i = 1; i < d.points.length; i++) L += dist(d.points[i - 1], d.points[i]);

    if (L > map.requirements.maxDropMeters) {
      issues.push({
        id: `drop-long-${d.id}`,
        severity: 'error',
        messageAr: `كابل إسقاط طوله ${L.toFixed(0)}م يتجاوز الحد المسموح (${map.requirements.maxDropMeters}م) — قرّب صندوق FAT من الدور.`,
      });
    }

    if (coveredSet.has(d.toBuildingId)) dupHomes.add(d.toBuildingId);
    coveredSet.set(d.toBuildingId, { meters: L, fat });
  }

  if (dupHomes.size > 0) {
    issues.push({
      id: 'dup-drops',
      severity: 'warning',
      messageAr: `${dupHomes.size} دار لديها أكثر من كابل إسقاط — احذف الزائد.`,
    });
  }

  /* ---------- الحساب البصري لكل دار مغطاة ---------- */
  let worstRx: number | null = null;
  for (const h of homes) {
    const cov = coveredSet.get(h.buildingId);
    if (!cov) continue;
    h.covered = true;
    h.dropMeters = cov.meters;

    let feederM = 0;
    if (fdc) {
      feederM =
        network.distance(
          { kind: 'cabinet', id: fdc.id, p: { x: fdc.x, y: fdc.y } },
          { kind: 'fat', id: cov.fat.id, p: { x: cov.fat.x, y: cov.fat.y } }
        ) ?? dist({ x: fdc.x, y: fdc.y }, { x: cov.fat.x, y: cov.fat.y });
    }
    const exchangeToFdc =
      fdc !== undefined
        ? network.distance(
            { kind: 'exchange', id: 'exchange', p: map.exchange.point },
            { kind: 'cabinet', id: fdc.id, p: { x: fdc.x, y: fdc.y } }
          ) ?? dist(map.exchange.point, { x: fdc.x, y: fdc.y })
        : 0;

    h.fiberMeters = feederM + exchangeToFdc + cov.meters;
    h.path = {
      exchangeToFdcM: Math.round(exchangeToFdc * 10) / 10,
      fdcToFatM: Math.round(feederM * 10) / 10,
      dropM: Math.round(cov.meters * 10) / 10,
    };
    h.budget = computePowerBudget({
      fiberKm: h.fiberMeters / 1000,
      splices: 2,
      connectors: 2,
      splitters: cov.fat.splitter ? [cov.fat.splitter] : [],
    });

    if (worstRx === null || h.budget.rxDbm < worstRx) worstRx = h.budget.rxDbm;

    if (h.budget.rxDbm < map.requirements.minRxDbm) {
      issues.push({
        id: `rx-low-${h.buildingId}`,
        severity: 'error',
        messageAr: `إشارة الدار ${h.label} تبلغ ${h.budget.rxDbm.toFixed(1)} dBm — دون الحد المطلوب ${map.requirements.minRxDbm} dBm.`,
        hintAr: 'قصّر المسار البصري أو استخدم قاسماً أصغر (مثلاً 1:8 بدل 1:32).',
      });
    }
  }

  const covered = [...coveredSet.keys()].length;
  if (covered < map.requirements.homes) {
    issues.push({
      id: 'coverage',
      severity: covered === 0 ? 'warning' : 'warning',
      messageAr: `التغطية ${covered}/${map.requirements.homes} داراً — أكمل ربط بقية المنازل.`,
    });
  }

  /* ---------- مسارات حفر بلا وظيفة ---------- */
  if (entities.trenches.length > 0 && entities.fats.length === 0 && !fdc) {
    issues.push({
      id: 'trench-idle',
      severity: 'info',
      messageAr: 'رُسمت مسارات حفر دون أي معدات بصرية عليها — أكمل تركيب الكبينة والصناديق.',
    });
  }

  const opticalOk =
    covered === map.requirements.homes &&
    worstRx !== null &&
    worstRx >= map.requirements.minRxDbm;

  return {
    homes,
    coverage: { covered, total: map.requirements.homes },
    issues,
    worstRxDbm: worstRx,
    opticalOk,
    trenchMeters,
    network,
  };
}
