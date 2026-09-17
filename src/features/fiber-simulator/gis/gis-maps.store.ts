/**
 * ============================================================
 * مخزن الخرائط المستوردة (GIS) — محاكي FTTH
 * ============================================================
 * يحتفظ بالخرائط المُولدة من ملفات GeoJSON على جهاز المستخدم
 * (localStorage) ويدمجها مع الخرائط الثابتة عبر سجل الخرائط.
 *
 * العزل: لا يستورد أي واجهة — منطق نقي + zustand فقط.
 * الأمان:
 *  - التخزين same-origin فقط، ولا يتم حقن أي HTML/JS أبداً.
 *  - كل خريطة تُحمَّل من التخزين يُعاد التحقق من بنيتها بصارمة
 *    وتُرفض أي بيانات فاسدة/مُتلاعب بها (fail-closed).
 *  - سقف صارم للحجم التخزيني (يفادي إغراق الحصة).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MapBuilding, MapRoad, SimMap, Vec2 } from '../types';

const STORAGE_KEY = 'ftth-sim:gis-maps';
/** أقصى حجم تخزيني إجمالي (2MB) — الخرائط الصغيرة تحتاج بضع عشرات KB */
const MAX_STORAGE_BYTES = 2_000_000;

/* ======================= تحقق سلامة الخريطة ======================= */

function isValidVec2(p: unknown): p is Vec2 {
  return typeof p === 'object' && p !== null &&
    'x' in p && 'y' in p &&
    Number.isFinite((p as Vec2).x) && Number.isFinite((p as Vec2).y);
}

function isValidBuilding(b: unknown): b is MapBuilding {
  if (typeof b !== 'object' || b === null) return false;
  const o = b as MapBuilding;
  return (
    typeof o.id === 'string' && typeof o.label === 'string' &&
    Array.isArray(o.polygon) && o.polygon.length >= 3 && o.polygon.every(isValidVec2) &&
    isValidVec2(o.connectionPoint)
  );
}

function isValidRoad(r: unknown): r is MapRoad {
  if (typeof r !== 'object' || r === null) return false;
  const o = r as MapRoad;
  return (
    typeof o.id === 'string' && typeof o.name === 'string' &&
    Array.isArray(o.centerline) && o.centerline.length >= 2 && o.centerline.every(isValidVec2) &&
    Number.isFinite(o.width) && (o.surface === 'asphalt' || o.surface === 'soil')
  );
}

/** تحقق صارم — يرفض أي بنية غير متوقعة (fail-closed) */
export function isValidSimMap(m: unknown): m is SimMap {
  if (typeof m !== 'object' || m === null) return false;
  const o = m as SimMap;
  return (
    typeof o.id === 'string' && o.id.startsWith('gis-') &&
    typeof o.name === 'string' &&
    ['beginner', 'intermediate', 'advanced'].includes(o.level) &&
    Number.isFinite(o.widthM) && o.widthM > 0 && o.widthM < 20_000 &&
    Number.isFinite(o.heightM) && o.heightM > 0 && o.heightM < 20_000 &&
    Array.isArray(o.buildings) && o.buildings.length > 0 && o.buildings.length <= 500 &&
    o.buildings.every(isValidBuilding) &&
    Array.isArray(o.roads) && o.roads.every(isValidRoad) &&
    isValidVec2(o.exchange.point) && typeof o.exchange.label === 'string' &&
    typeof o.requirements === 'object' && o.requirements !== null &&
    Number.isFinite(o.requirements.homes) && Number.isFinite(o.requirements.minRxDbm)
  );
}

/* ======================= المخزن ======================= */

export interface GisMapsState {
  maps: SimMap[];
  /** يضيف خريطة (أو يستبدل الموجودة بنفس id) مع ضمان الحد التخزيني */
  upsert: (map: SimMap) => void;
  remove: (id: string) => void;
  has: (id: string) => boolean;
  getMapById: (id: string) => SimMap | undefined;
  clear: () => void;
}

export const useGisMaps = create<GisMapsState>()(
  persist(
    (set, get) => ({
      maps: [],

      upsert: (map) =>
        set((state) => {
          const filtered = state.maps.filter((m) => m.id !== map.id);
          let next = [map, ...filtered];
          /* ضمان السقف التخزيني — نُسقط الأقدم حتى نندرج */
          while (JSON.stringify(next).length > MAX_STORAGE_BYTES && next.length > 1) {
            next = next.slice(0, -1);
          }
          return { maps: next };
        }),

      remove: (id) => set((state) => ({ maps: state.maps.filter((m) => m.id !== id) })),

      has: (id) => get().maps.some((m) => m.id === id),

      getMapById: (id) => get().maps.find((m) => m.id === id),

      clear: () => set({ maps: [] }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      /* نُصرّح بالحقل الوحيد — لا نُخزن شيئاً غير الخرائط */
      partialize: (state) => ({ maps: state.maps }),
      /* فلترة دفاعية عند القراءة: الخرائط غير الصالحة تُسقط صامتة */
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.maps = state.maps.filter(isValidSimMap);
      },
      version: 1,
    }
  )
);
