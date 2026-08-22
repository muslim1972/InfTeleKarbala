/**
 * ============================================================
 * محرك التقييم النهائي — النجوم (0–5) لمحاكي FTTH
 * ============================================================
 * يجمع نتائج الفحص الهندسي وجدول الكميات وجودة اللحام في
 * تقييم موزون من 100 نقطة ثم يترجمها إلى نجوم.
 *
 * توزيع الأوزان:
 * - التغطية        35 نقطة (الهدف الأساسي للمشروع)
 * - جودة الإشارة   25 نقطة (Power Budget عند أسوأ دار)
 * - كفاءة الكلفة   20 نقطة (كلفة الدار مقابل الميزانية المرجعية)
 * - سلامة التصميم  10 نقاط (ال مخالفات الهندسية)
 * - إتقان اللحام   10 نقاط (دقة الألوان وقيم الفقد في المختبر)
 */

import type { SimMap } from '../types';
import type { DesignReport } from './rules';
import type { BoqReport } from './boq';

export type CriterionId = 'coverage' | 'signal' | 'cost' | 'integrity' | 'splicing';

export interface ScoreCriterion {
  id: CriterionId;
  labelAr: string;
  weight: number;
  /** 0–100 */
  earnedPct: number;
  /** النقاط المكتسبة = earnedPct × weight / 100 */
  points: number;
  detailAr: string;
}

export interface ScoreResult {
  stars: number; // 0..5 (أنصاف نجوم)
  percentage: number; // 0..100
  passed: boolean; // 3 نجوم فأكثر
  titleAr: string;
  criteria: ScoreCriterion[];
}

export interface SpliceSummary {
  done: number;
  total: number;
  /** متوسط فقد اللحامات المنفذة (dB) */
  avgLossDb: number | null;
}

/* ---------- دوال الاستيفاء الخطي المجزأ ---------- */

const lerpPct = (x: number, pts: [number, number][]): number => {
  if (x <= pts[0][0]) return pts[0][1];
  const last = pts[pts.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1];
    const [x2, y2] = pts[i];
    if (x <= x2) {
      const t = (x - x1) / (x2 - x1);
      return Math.round(y1 + t * (y2 - y1));
    }
  }
  return last[1];
};

export function scoreProject(input: {
  report: DesignReport;
  boq: BoqReport;
  map: SimMap;
  splice: SpliceSummary;
}): ScoreResult {
  const { report, boq, map, splice } = input;

  /* ---------- 1) التغطية ---------- */
  const coveragePct = map.requirements.homes
    ? Math.round((report.coverage.covered / map.requirements.homes) * 100)
    : 0;
  const coverage: ScoreCriterion = {
    id: 'coverage',
    labelAr: 'نسبة تغطية المنازل',
    weight: 35,
    earnedPct: coveragePct,
    points: (coveragePct * 35) / 100,
    detailAr: `${report.coverage.covered}/${report.coverage.total} داراً (${coveragePct}%)`,
  };

  /* ---------- 2) جودة الإشارة عند أسوأ دار ---------- */
  const rx = report.worstRxDbm;
  let signalPct = 0;
  let signalDetail = 'لا توجد أي دار مغطاة لقياس الإشارة.';
  if (rx !== null) {
    /* -18 فأعلى: 100 | -24: 85 | -27: 55 | -30: 10 | أدنى: 0 */
    signalPct = lerpPct(-rx, [
      [18, 100],
      [24, 85],
      [27, 55],
      [30, 10],
      [33, 0],
    ]);
    signalDetail = `أسوأ إشارة ${rx.toFixed(1)} dBm (المطلوب ≥ ${map.requirements.minRxDbm} dBm)`;
  }
  const signal: ScoreCriterion = {
    id: 'signal',
    labelAr: 'جودة الإشارة البصرية',
    weight: 25,
    earnedPct: signalPct,
    points: (signalPct * 25) / 100,
    detailAr: signalDetail,
  };

  /* ---------- 3) كفاءة الكلفة ---------- */
  const bench = map.requirements.budgetPerHomeUSD ?? 200;
  let costPct = 0;
  let costDetail = 'لا توجد كلفة — المشروع فارغ.';
  if (boq.costPerHomeUSD !== null && boq.coveredHomes > 0) {
    const ratio = boq.costPerHomeUSD / bench;
    /* ≤0.85: 100 | 1.0: 80 | 1.25: 45 | ≥1.5: 5 */
    costPct = lerpPct(ratio, [
      [0.85, 100],
      [1.0, 80],
      [1.25, 45],
      [1.5, 5],
      [2.0, 0],
    ]);
    costDetail = `${boq.costPerHomeUSD.toFixed(0)}$/دار مقابل مرجع ${bench}$ (${Math.round(ratio * 100)}%)`;
  }
  const cost: ScoreCriterion = {
    id: 'cost',
    labelAr: 'كفاءة الكلفة',
    weight: 20,
    earnedPct: costPct,
    points: (costPct * 20) / 100,
    detailAr: costDetail,
  };

  /* ---------- 4) سلامة التصميم (المخالفات) ---------- */
  const errors = report.issues.filter((i) => i.severity === 'error').length;
  const warnings = report.issues.filter((i) => i.severity === 'warning').length;
  const integrityPct = Math.max(0, 100 - errors * 30 - warnings * 8);
  const integrity: ScoreCriterion = {
    id: 'integrity',
    labelAr: 'سلامة التصميم الهندسي',
    weight: 10,
    earnedPct: integrityPct,
    points: (integrityPct * 10) / 100,
    detailAr:
      errors + warnings === 0
        ? 'لا مخالفات — تصميم نظيف'
        : `${errors} خطأ جسيم و${warnings} تحذير في الفحص الحي`,
  };

  /* ---------- 5) إتقان اللحام ---------- */
  let splicePct = 0;
  let spliceDetail = 'لم تُنفّذ أي لحامة في المختبر.';
  if (splice.total > 0) {
    const doneRatio = splice.done / splice.total;
    /* الجودة: متوسط فقد ≤0.05 ممتاز | 0.10 جيد | 0.20 مقبول */
    const quality =
      splice.avgLossDb === null
        ? 1
        : lerpPct(splice.avgLossDb, [
            [0.05, 1],
            [0.1, 0.85],
            [0.2, 0.6],
            [0.35, 0.2],
            [0.5, 0],
          ]);
    splicePct = Math.round(doneRatio * 100 * (0.55 + 0.45 * quality));
    spliceDetail = `${splice.done}/${splice.total} لحامة${
      splice.avgLossDb !== null
        ? ` — متوسط الفقد ${splice.avgLossDb.toFixed(3)} dB`
        : ''
    }`;
  }
  const splicing: ScoreCriterion = {
    id: 'splicing',
    labelAr: 'إتقان اللحام في المختبر',
    weight: 10,
    earnedPct: splicePct,
    points: (splicePct * 10) / 100,
    detailAr: spliceDetail,
  };

  /* ---------- المجموع والنجوم ---------- */
  const criteria = [coverage, signal, cost, integrity, splicing];
  const percentage = Math.round(
    criteria.reduce((s, c) => s + c.points, 0)
  );
  const stars = Math.min(5, Math.round((percentage / 100) * 10) / 2);

  const titleAr =
    stars >= 5
      ? 'مهندس شبكات خبير — إنجاز كامل'
      : stars >= 4
        ? 'مهندس متمكن — نتيجة ممتازة'
        : stars >= 3
          ? 'ناجح — تصميم مقبول قابل للتحسين'
          : stars >= 2
            ? 'يحتاج تحسينات جوهرية'
            : 'أعد التصميم من جديد';

  return {
    stars,
    percentage,
    passed: stars >= 3,
    titleAr,
    criteria,
  };
}

/* عرض النجوم كنص للتصدير */
export const starsText = (stars: number): string =>
  '★'.repeat(Math.floor(stars)) + (stars % 1 >= 0.5 ? '⯨' : '') +
  '☆'.repeat(5 - Math.ceil(stars));
