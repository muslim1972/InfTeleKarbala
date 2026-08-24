/**
 * ============================================================
 * مخزن الطبقة التعليمية — الجولة + التقدم + سجل الأخطاء
 * ============================================================
 * مخزن مستقل بلا تاريخ تراجع (بيانات جلستية تعليمية).
 * الجولة التدريبية تُفتح تلقائياً عند كل تشغيل للمحاكي،
 * أما سجل الأخطاء والاستكشاف فخاصة بالجلسة الحالية.
 */

import { create } from 'zustand';
import type { InfoKey } from '../education/element-info';

export type EduSeverity = 'info' | 'warn' | 'error';

export interface ErrorEntry {
  id: string;
  at: number;
  code: string;
  severity: EduSeverity;
  titleAr: string;
  messageAr: string;
  /** الدرس المستفاد — جوهر القيمة التدريبية */
  lessonAr: string;
}

interface EduState {
  /** هل نافذة الجولة مفتوحة الآن؟ */
  tourOpen: boolean;

  /** سجل الأخطاء التعليمية بالجلسة الحالية */
  errors: ErrorEntry[];
  /** العناصر التي استكشفها المستخدم بوضع التلميح */
  explored: InfoKey[];

  openTour: () => void;
  closeTour: () => void;

  logError: (e: {
    code: string;
    severity: EduSeverity;
    titleAr: string;
    messageAr: string;
    lessonAr: string;
  }) => void;
  clearErrors: () => void;
  markExplored: (key: InfoKey) => void;
}

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** أقصى عدد أخطاء محفوظة — نُبقي الأحدث لتجنب تضخم الذاكرة */
const MAX_ERRORS = 40;

export const useEduStore = create<EduState>()((set) => ({
  tourOpen: false,
  errors: [],
  explored: [],

  openTour: () => set({ tourOpen: true }),
  closeTour: () => set({ tourOpen: false }),

  logError: (e) =>
    set((s) => ({
      errors: [{ id: uid(), at: Date.now(), ...e }, ...s.errors].slice(0, MAX_ERRORS),
    })),
  clearErrors: () => set({ errors: [] }),
  markExplored: (key) =>
    set((s) => (s.explored.includes(key) ? s : { explored: [...s.explored, key] })),
}));
