/**
 * ============================================================
 * مخزن الطبقة التعليمية — الجولة + التقدم + سجل الأخطاء
 * ============================================================
 * مخزن مستقل بلا تاريخ تراجع (بيانات جلستية تعليمية).
 * «هل رأى المستخدم الجولة؟» تُخزَّن في localStorage لتبقى
 * بين الجلسات، أما سجل الأخطاء فخاصة بالجلسة الحالية.
 */

import { create } from 'zustand';
import type { InfoKey } from '../education/element-info';

const TOUR_SEEN_KEY = 'fiber_sim_tour_seen_v1';

const readTourSeen = (): boolean => {
  try {
    return window.localStorage.getItem(TOUR_SEEN_KEY) === '1';
  } catch {
    return false;
  }
};

const writeTourSeen = (v: boolean) => {
  try {
    window.localStorage.setItem(TOUR_SEEN_KEY, v ? '1' : '0');
  } catch {
    /* وضع خاص/تخزين معطل — نتجاهل بهدوء */
  }
};

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
  /** هل شاهد المستخدم الجولة التدريبية من قبل؟ */
  tourSeen: boolean;
  /** هل نافذة الجولة مفتوحة الآن؟ */
  tourOpen: boolean;

  /** سجل الأخطاء التعليمية بالجلسة الحالية */
  errors: ErrorEntry[];
  /** العناصر التي استكشفها المستخدم بوضع التلميح */
  explored: InfoKey[];

  openTour: () => void;
  closeTour: () => void;
  markTourSeen: () => void;

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
  tourSeen: readTourSeen(),
  tourOpen: false,
  errors: [],
  explored: [],

  openTour: () => set({ tourOpen: true }),
  closeTour: () => set({ tourOpen: false }),
  markTourSeen: () => {
    writeTourSeen(true);
    set({ tourSeen: true });
  },

  logError: (e) =>
    set((s) => ({
      errors: [{ id: uid(), at: Date.now(), ...e }, ...s.errors].slice(0, MAX_ERRORS),
    })),
  clearErrors: () => set({ errors: [] }),
  markExplored: (key) =>
    set((s) => (s.explored.includes(key) ? s : { explored: [...s.explored, key] })),
}));
