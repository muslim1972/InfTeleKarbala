/**
 * ============================================================
 * مخزن حالة مختبر اللحام والاختبار — محاكي FTTH
 * ============================================================
 * مخزن مستقل وصغير عن مخزن التصميم (بلا تاريخ تراجع):
 * يسجّل نتيجة كل لحامة وكل قياس وفحص VFL حتى التقييم النهائي.
 */

import { create } from 'zustand';
import type { ScoreResult } from '../engine/scoring';

export interface SpliceRecord {
  dropId: string;
  buildingId: string;
  /** رقم الليفة في التسلسل اللوني TIA-598 (0..11) */
  fiberIndex: number;
  correctColor: boolean;
  /** فقد اللحامة المقاس فعلياً dB */
  lossDb: number;
  at: number;
}

export interface MeasurementRecord {
  dropId: string;
  buildingId: string;
  /** القراءة بمقياس القدرة dBm */
  rxDbm: number;
  pass: boolean;
  at: number;
}

interface LabState {
  splices: Record<string, SpliceRecord>;
  measurements: Record<string, MeasurementRecord>;
  /** فحص الفاحص الضوئي VFL لكل إسقاط (استمرارية المسار) */
  vfl: Record<string, boolean>;
  finalScore: ScoreResult | null;

  recordSplice: (r: SpliceRecord) => void;
  recordMeasurement: (m: MeasurementRecord) => void;
  recordVfl: (dropId: string) => void;
  setFinalScore: (s: ScoreResult | null) => void;
  resetLab: () => void;
}

export const useLabStore = create<LabState>()((set) => ({
  splices: {},
  measurements: {},
  vfl: {},
  finalScore: null,

  recordSplice: (r) => set((s) => ({ splices: { ...s.splices, [r.dropId]: r } })),
  recordMeasurement: (m) =>
    set((s) => ({ measurements: { ...s.measurements, [m.dropId]: m } })),
  recordVfl: (dropId) => set((s) => ({ vfl: { ...s.vfl, [dropId]: true } })),
  setFinalScore: (finalScore) => set({ finalScore }),
  resetLab: () => set({ splices: {}, measurements: {}, vfl: {}, finalScore: null }),
}));

/* إحصاءات اللحام لمحرك التقييم */
export const spliceStats = (s: LabState): {
  done: number;
  total: number;
  avgLossDb: number | null;
} => {
  const all = Object.values(s.splices);
  const avg =
    all.length > 0
      ? all.reduce((a, r) => a + r.lossDb, 0) / all.length
      : null;
  return { done: all.length, total: 0, avgLossDb: avg };
};
