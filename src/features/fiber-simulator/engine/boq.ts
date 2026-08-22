/**
 * ============================================================
 * محرك جدول الكميات والتكاليف (BOQ) — محاكي FTTH
 * ============================================================
 * يحوّل كيانات التصميم إلى فواتير مواد وأعمال مدنية بأسعار
 * الكتالوج الحقيقية (دولار) مع تحويل عرضي للدينار العراقي.
 * كميات المواد تُقرّب للأعلى (منطق التوريد الفعلي).
 */

import type { ProjectEntities, SimMap } from '../types';
import { TRENCH_METHODS, USD_TO_IQD, catalogItem, type CatalogCategory } from '../data/materials.catalog';
import { buildNetwork, type NetAnchor } from './rules';
import { dist, polylineLength } from './geometry';

export interface BoqLine {
  itemId: string;
  nameAr: string;
  category: CatalogCategory;
  unit: string;
  qty: number;
  unitUSD: number;
  totalUSD: number;
}

export interface BoqReport {
  lines: BoqLine[];
  categoryTotals: Partial<Record<CatalogCategory, number>>;
  grandTotalUSD: number;
  grandTotalIQD: number;
  /** الكلفة لكل دار مغطاة بالدولار (أو null) */
  costPerHomeUSD: number | null;
  coveredHomes: number;
  trenchMeters: number;
  ductMeters: number;
}

/** تجميع الكميات ثم توليد الفواتير */
class Qty {
  private map = new Map<string, number>();
  add(itemId: string, qty: number): void {
    if (qty <= 0) return;
    this.map.set(itemId, (this.map.get(itemId) ?? 0) + qty);
  }
  entries(): [string, number][] {
    return [...this.map.entries()];
  }
}

const anchorOf = (a: { x: number; y: number }, kind: NetAnchor['kind'], id: string): NetAnchor => ({
  kind,
  id,
  p: { x: a.x, y: a.y },
});

export function computeBoq(entities: ProjectEntities, map: SimMap): BoqReport {
  const q = new Qty();
  let trenchMeters = 0;
  let ductMeters = 0;

  /* ---------- الأعمال المدنية والأنابيب ---------- */
  for (const t of entities.trenches) {
    const L = polylineLength(t.points);
    trenchMeters += L;
    q.add(TRENCH_METHODS[t.method].costItemId, L);

    /* شريط تحذيري للطرق المدفونة فقط */
    if (t.method !== 'aerial') q.add('warning_tape', L);

    ductMeters += L * (t.ducts.hdpe32 + t.ducts.hdpe40 + t.ducts.micro7);
    q.add('duct_hdpe32', L * t.ducts.hdpe32);
    q.add('duct_hdpe40', L * t.ducts.hdpe40);
    q.add('duct_micro7', L * t.ducts.micro7);
  }

  /* ---------- المنشآت ---------- */
  for (const s of entities.structures)
    q.add(s.kind === 'manhole' ? 'manhole_concrete' : 'handhole_polymer', 1);

  for (const c of entities.cabinets) {
    q.add('fdc_cabinet', 1);
    /* الكابل الرئيسي: المقسم ← الكبينة عبر الشبكة (مع بدل راحة 5%) */
    const network = buildNetwork(entities, map.exchange.point);
    const d =
      network.distance(
        { kind: 'exchange', id: 'exchange', p: map.exchange.point },
        anchorOf(c, 'cabinet', c.id)
      ) ?? dist(map.exchange.point, { x: c.x, y: c.y }) * 1.15;
    const feederItem = c.capacityF >= 288 ? 'cable_feeder_288f' : 'cable_feeder_96f';
    q.add(feederItem, Math.ceil(d * 1.05));
  }

  /* ---------- FAT والقواسم والكابل Distribute ---------- */
  const network = buildNetwork(entities, map.exchange.point);
  const coveredHomes = new Set(entities.drops.map((d) => d.toBuildingId)).size;

  for (const f of entities.fats) {
    q.add(f.ports >= 32 ? 'fat_32' : 'fat_16', 1);
    if (f.splitter)
      q.add(
        f.splitter === '1:4'
          ? 'splitter_1x4'
          : f.splitter === '1:8'
            ? 'splitter_1x8'
            : f.splitter === '1:16'
              ? 'splitter_1x16'
              : 'splitter_1x32',
        1
      );
    q.add('closure_48f', 1);

    /* كابل التوزيع: أقرب كبينة ← FAT عبر الشبكة */
    let d: number | null = null;
    for (const c of entities.cabinets) {
      const dd = network.distance(anchorOf(c, 'cabinet', c.id), anchorOf(f, 'fat', f.id));
      if (dd !== null && (d === null || dd < d)) d = dd;
    }
    const use = d ?? nearestFallback(cabinetPos(entities), f) * 1.15;
    if (use > 0) q.add('cable_dist_24f', Math.ceil(use * 1.05));
  }

  /* ---------- الإسقاطات والإنهاءات ---------- */
  for (const d of entities.drops) {
    q.add('cable_drop_1f', Math.ceil(polylineLength(d.points) * 1.05));
    q.add('drop_set', 1);
    q.add('connector_fast', 1);
    q.add('pigtail_sc', 1);
    q.add('patch_cord', 1);
    q.add('splice_fusion', 2); /* لحامة عند FAT + لحامة الكابل الرئيسي للحساب */
  }
  /* لحامتا الكلوزر لكل FAT (دخول + خروج) */
  q.add('splice_fusion', entities.fats.length * 2);

  /* ---------- المعدات النشطة ---------- */
  if (coveredHomes > 0) {
    q.add('ont_xpon', coveredHomes);
    q.add('olt_port', coveredHomes);
  }

  /* ---------- توليد الفواتير ---------- */
  const lines: BoqLine[] = q
    .entries()
    .map(([itemId, qty]): BoqLine | null => {
      const item = catalogItem(itemId);
      if (!item) return null;
      const qtyR = item.unit === 'm' ? Math.round(qty * 10) / 10 : Math.ceil(qty);
      return {
        itemId,
        nameAr: item.nameAr,
        category: item.category,
        unit: item.unit,
        qty: qtyR,
        unitUSD: item.priceUSD,
        totalUSD: Math.round(qtyR * item.priceUSD * 100) / 100,
      } satisfies BoqLine;
    })
    .filter((l): l is BoqLine => l !== null)
    .sort((a, b) => a.category.localeCompare(b.category) || b.totalUSD - a.totalUSD);

  const categoryTotals: Partial<Record<CatalogCategory, number>> = {};
  let grand = 0;
  for (const l of lines) {
    categoryTotals[l.category] = (categoryTotals[l.category] ?? 0) + l.totalUSD;
    grand += l.totalUSD;
  }
  grand = Math.round(grand * 100) / 100;

  return {
    lines,
    categoryTotals,
    grandTotalUSD: grand,
    grandTotalIQD: Math.round(grand * USD_TO_IQD),
    costPerHomeUSD: coveredHomes > 0 ? Math.round((grand / coveredHomes) * 100) / 100 : null,
    coveredHomes,
    trenchMeters: Math.round(trenchMeters * 10) / 10,
    ductMeters: Math.round(ductMeters * 10) / 10,
  };
}

/* مسافة مستقيمة احتياطية عند غياب الشبكة */
function cabinetPos(entities: ProjectEntities): { x: number; y: number } | null {
  return entities.cabinets[0] ? { x: entities.cabinets[0].x, y: entities.cabinets[0].y } : null;
}

function nearestFallback(
  c: { x: number; y: number } | null,
  f: { x: number; y: number }
): number {
  if (!c) return 0;
  return dist(c, f);
}
