/**
 * ============================================================
 * قوالب OSM المخصصة لكل مستخدم — محاكي FTTH
 * ============================================================
 * القوالب الأساسية (OSM_PRESETS) بيد المطور وتأتي مع الكود.
 * هذا المخزن يتيح لكل مستخدم إضافة قوالبه الخاصة (اسم + صندوق
 * إحاطة) لتظهر بجانب الأساسية في نافذة الاستيراد — تُحفظ في
 * localStorage متصفحه فقط، فلا يمس تعديله بقية المستخدمين ولا
 * يحتاج أي تغيير على قاعدة البيانات.
 *
 * العزل: مخزن مستقل لا يعتمد سوى على أنواع osm-areas.
 * الأمان:
 *  - تحقق صارم fail-closed عند الحفظ وعند إعادة القراءة.
 *  - سقف عددي للقوالب وحدود حجم للصندوق (100م–5كم للضلع).
 *  - النص الحر الوحيد هو الاسم — يُعرض نصاً فقط (لا حقن HTML).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { BBox, OsmPreset } from './osm-areas';

const STORAGE_KEY = 'ftth-sim:osm-custom-presets';
/** سقف عدد القوالب المخصصة — يمنع إغراق الحصة التخزينية */
const MAX_PRESETS = 30;
/** حدود صندوق الإحاطة: من ~100م إلى ~5كم لكل ضلع (حقول تدريب FTTH) */
const MIN_SPAN_DEG = 0.001;
const MAX_SPAN_DEG = 0.05;

function finiteIn(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}

/** تحقق صارم — يرفض أي بنية غير متوقعة (fail-closed) */
export function isValidCustomPreset(p: unknown): p is OsmPreset {
  if (typeof p !== 'object' || p === null) return false;
  const o = p as OsmPreset;
  const b: Partial<BBox> | null =
    typeof o.bbox === 'object' && o.bbox !== null ? o.bbox : null;
  if (b === null) return false;
  const { south, west, north, east } = b;
  return (
    typeof o.id === 'string' && o.id.startsWith('cus-') && o.id.length <= 40 &&
    typeof o.label === 'string' && o.label.trim().length >= 2 && o.label.length <= 60 &&
    typeof o.hint === 'string' && o.hint.length <= 120 &&
    finiteIn(south, -90, 90) && finiteIn(north, -90, 90) &&
    finiteIn(west, -180, 180) && finiteIn(east, -180, 180) &&
    north - south >= MIN_SPAN_DEG && north - south <= MAX_SPAN_DEG &&
    east - west >= MIN_SPAN_DEG && east - west <= MAX_SPAN_DEG
  );
}

/* ======================= المخزن ======================= */

export interface OsmCustomPresetsState {
  presets: OsmPreset[];
  /**
   * يضيف قالباً جديداً بعد التحقق الصارم.
   * يرجع القالب المضاف عند النجاح، أو رسالة خطأ عربية عند الرفض.
   */
  add: (input: {
    label: string;
    south: number;
    west: number;
    north: number;
    east: number;
  }) => OsmPreset | string;
  remove: (id: string) => void;
}

export const useOsmCustomPresets = create<OsmCustomPresetsState>()(
  persist(
    (set, get) => ({
      presets: [],

      add: ({ label, south, west, north, east }) => {
        const clean = label.trim().slice(0, 60);
        if (clean.length < 2) return 'اسم المنطقة قصير جداً (حرفان على الأقل)';
        if (get().presets.length >= MAX_PRESETS)
          return `الحد الأقصى ${MAX_PRESETS} قوالب مخصصة — احذف قالباً قديماً أولاً`;
        if (get().presets.some((p) => p.label === clean))
          return 'يوجد قالب مخصص بنفس الاسم';
        /* وصف تلقائي يوضح أبعاد المنطقة التقريبية للمستخدم */
        const wM = Math.round(
          (east - west) * 111320 * Math.cos(((south + north) / 2) * (Math.PI / 180))
        );
        const hM = Math.round((north - south) * 110574);
        const candidate: OsmPreset = {
          id: `cus-${Date.now().toString(36)}`,
          label: clean,
          hint: `قالبي · ~${wM}×${hM}م`,
          bbox: { south, west, north, east },
        };
        if (!isValidCustomPreset(candidate))
          return 'إحداثيات غير صالحة — تأكد من الترتيب (جنوب<شمال، غرب<شرق) ومن الحجم (100م–5كم للضلع)';
        set((state) => ({ presets: [candidate, ...state.presets] }));
        return candidate;
      },

      remove: (id) =>
        set((state) => ({ presets: state.presets.filter((p) => p.id !== id) })),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      /* نُصرّح بالحقل الوحيد — لا نُخزن شيئاً غير القوالب */
      partialize: (state) => ({ presets: state.presets }),
      /* فلترة دفاعية عند القراءة: القوالب غير الصالحة تُسقط صامتة */
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.presets = state.presets.filter(isValidCustomPreset);
      },
      version: 1,
    }
  )
);
