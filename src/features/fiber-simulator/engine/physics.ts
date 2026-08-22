/**
 * ============================================================
 * محرك الفيزياء البصرية — معايير ITU-T G.984 (GPON Class B+)
 * ============================================================
 * حسابات ميزانية القدرة البصرية (Optical Power Budget) للمنبع
 * 1490nm الهابط من الـ OLT نحو الـ ONT في المنازل.
 */

import type { SplitterRatio } from '../types';

/** التوهين في الألياف dB/km حسب الطول الموجي */
export const FIBER_ATTENUATION: Record<string, number> = {
  '1310': 0.35,
  '1490': 0.25, // المنبع الهابط في GPON
  '1550': 0.22,
};

/** الفقد النموذجي الأقصى للقواسم PLC (dB) */
export const SPLITTER_LOSS: Record<SplitterRatio, number> = {
  '1:4': 7.2,
  '1:8': 10.5,
  '1:16': 13.8,
  '1:32': 17.1,
};

export const SPLICE_LOSS_DB = 0.05; // لحام حراري (النموذجي 0.02-0.05)
export const CONNECTOR_LOSS_DB = 0.3; // كبسة/وصلة ميكانيكية

/** قدرة إرسال الـ OLT (Class B+ : من +1.5 إلى +5 dBm) — نعتمد قيمة وسطية */
export const OLT_TX_DBM = 3.0;

/** حساسية استقبال الـ ONT (Class B+) والحد التصميمي بهامش أمان */
export const ONT_SENSITIVITY_DBM = -27;
export const DESIGN_TARGET_DBM = -24; // هامش 3 dB

export interface BudgetInput {
  /** إجمالي طول الألياف بالكيلومتر */
  fiberKm: number;
  splices: number;
  connectors: number;
  /** القواسم في المسار (يدعم التعاقب مثل 1:8 ثم 1:2) */
  splitters: SplitterRatio[];
}

export interface BudgetResult {
  rxDbm: number;
  totalLossDb: number;
  parts: { label: string; lossDb: number }[];
  /** حالة الإشارة تقييمياً */
  verdict: 'excellent' | 'good' | 'marginal' | 'fail' | 'none';
}

export function computePowerBudget(input: BudgetInput, wavelength = '1490'): BudgetResult {
  const att = FIBER_ATTENUATION[wavelength] ?? FIBER_ATTENUATION['1490'];
  const fiberLoss = input.fiberKm * att;
  const spliceLoss = input.splices * SPLICE_LOSS_DB;
  const connLoss = input.connectors * CONNECTOR_LOSS_DB;
  const splitterLoss = input.splitters.reduce((s, r) => s + SPLITTER_LOSS[r], 0);

  const parts = [
    { label: `توهين الألياف (${input.fiberKm.toFixed(3)} كم × ${att} dB/km)`, lossDb: fiberLoss },
    { label: `اللحامات (${input.splices} × ${SPLICE_LOSS_DB} dB)`, lossDb: spliceLoss },
    { label: `الوصلات (${input.connectors} × ${CONNECTOR_LOSS_DB} dB)`, lossDb: connLoss },
    ...input.splitters.map((r) => ({ label: `قاسم ${r}`, lossDb: SPLITTER_LOSS[r] })),
  ];

  const totalLossDb = fiberLoss + spliceLoss + connLoss + splitterLoss;
  const rxDbm = OLT_TX_DBM - totalLossDb;

  let verdict: BudgetResult['verdict'] = 'fail';
  if (rxDbm >= DESIGN_TARGET_DBM + 3) verdict = 'excellent';
  else if (rxDbm >= DESIGN_TARGET_DBM) verdict = 'good';
  else if (rxDbm >= ONT_SENSITIVITY_DBM) verdict = 'marginal';
  else if (rxDbm > -60) verdict = 'fail';

  return { rxDbm, totalLossDb, parts, verdict };
}

export const VERDICT_META: Record<BudgetResult['verdict'], { label: string; color: string }> = {
  excellent: { label: 'ممتازة', color: '#22c55e' },
  good: { label: 'جيدة', color: '#84cc16' },
  marginal: { label: 'حدّية (أقل من الهامش التصميمي)', color: '#f59e0b' },
  fail: { label: 'غير مقبولة — دون حساسية ONT', color: '#ef4444' },
  none: { label: 'لا إشارة', color: '#64748b' },
};

/** كود الألوان العالمي للشعيرات TIA-598 */
export const FIBER_COLORS = [
  'أزرق',
  'برتقالي',
  'أخضر',
  'بني',
  'رمادي',
  'أبيض',
  'أحمر',
  'أسود',
  'أصفر',
  'بنفسجي',
  'وردي',
  'فيروزي',
];
