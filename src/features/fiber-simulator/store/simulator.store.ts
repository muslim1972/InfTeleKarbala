/**
 * ============================================================
 * مخزن حالة المحاكي — zustand + zundo (تراجع/إعادة)
 * ============================================================
 * ميزة معزولة: هذا الملف لا يستورد أي شيء من التطبيق الأساسي.
 * يخزّن التاريخ (Undo/Redo) لكيانات المشروع فقط؛ الخيارات
 * وإطار العرض (Viewport) تبقى خارج التاريخ.
 */

import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { temporal } from 'zundo';
import {
  emptyEntities,
  type EntityKind,
  type PhaseId,
  type ProjectEntities,
  type SimMap,
  type SplitterRatio,
  type StructureKind,
  type ToolId,
  type TrenchMethod,
  type TrenchRoute,
  type Vec2,
} from '../types';

/* ===================== أدوات مساعدة ===================== */

const uid = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
};

/** الأنابيب الافتراضية عند اختيار طريقة الحفر */
export const defaultDuctsFor = (m: TrenchMethod): TrenchRoute['ducts'] => {
  if (m === 'micro') return { hdpe32: 0, hdpe40: 0, micro7: 1 };
  if (m === 'aerial') return { hdpe32: 0, hdpe40: 0, micro7: 0 };
  return { hdpe32: 1, hdpe40: 0, micro7: 0 };
};

/* ===================== شكل الحالة ===================== */

export interface TrenchDraft {
  points: Vec2[];
  method: TrenchMethod;
}

export interface DropDraft {
  fromFatId: string | null;
  points: Vec2[];
}

export interface SimulatorState {
  mapId: string;

  /** كيانات المشروع — الجزء الوحيد المشمول بتاريخ التراجع */
  entities: ProjectEntities;

  phase: PhaseId;
  tool: ToolId;
  selectedIds: string[];

  /* مسودات الرسم الجاري */
  trenchDraft: TrenchDraft | null;
  trenchMethod: TrenchMethod;
  dropDraft: DropDraft | null;

  /* خيارات الأدوات */
  cabinetCapacity: 96 | 288;
  fatPorts: 16 | 32;
  fatSplitter: SplitterRatio;

  /* القياس */
  measureFrom: Vec2 | null;
  measureTo: Vec2 | null;

  /* إطار العرض (خارج التاريخ) */
  viewport: { scale: number; tx: number; ty: number };
  /** عدّاد طلبات «ملاءمة العرض» — يزداد كل مرة يُطلب فيها fit */
  fitSignal: number;

  /* ===================== الأفعال ===================== */
  setTool: (t: ToolId) => void;
  setPhase: (p: PhaseId) => void;
  setTrenchMethod: (m: TrenchMethod) => void;
  /** تغيير طريقة الحفر لمسار قائم بعد إنشائه */
  setTrenchMethodFor: (routeId: string, m: TrenchMethod) => void;
  setTrenchDucts: (routeId: string, ducts: TrenchRoute['ducts']) => void;
  setCabinetCapacity: (c: 96 | 288) => void;
  setFatPorts: (p: 16 | 32) => void;
  setFatSplitter: (s: SplitterRatio) => void;
  setSelection: (ids: string[]) => void;

  loadMap: (map: SimMap) => void;
  loadEntities: (entities: ProjectEntities) => void;
  clearAll: () => void;

  beginTrench: (p: Vec2) => void;
  extendTrench: (p: Vec2) => void;
  undoTrenchPoint: () => void;
  commitTrench: () => void;
  cancelTrench: () => void;

  placeStructure: (kind: StructureKind, x: number, y: number) => void;
  placeCabinet: (x: number, y: number) => void;
  placeFat: (x: number, y: number) => void;
  setFatSplitterFor: (fatId: string, s: SplitterRatio | null) => void;

  beginDrop: (fatId: string, p: Vec2) => void;
  extendDrop: (p: Vec2) => void;
  commitDrop: (buildingId: string) => void;
  cancelDrop: () => void;

  removeEntity: (kind: EntityKind, id: string) => void;

  /** تحريك كيان موضوع (منشأة/كبينة/FAT) إلى إحداثيات جديدة — مشمول بالتراجع */
  moveEntity: (kind: 'structure' | 'cabinet' | 'fat', id: string, x: number, y: number) => void;

  setMeasure: (from: Vec2 | null, to: Vec2 | null) => void;
  setViewport: (v: SimulatorState['viewport']) => void;
  requestFit: () => void;
}

/* ===================== إنشاء المخزن ===================== */

export const useSimulatorStore = create<SimulatorState>()(
  temporal(
    (set, get) => ({
      mapId: 'alley-16',
      entities: emptyEntities(),

      phase: 'civil',
      tool: 'select',
      selectedIds: [],

      trenchDraft: null,
      trenchMethod: 'open_asphalt',
      dropDraft: null,

      cabinetCapacity: 96,
      fatPorts: 16,
      fatSplitter: '1:16',

      measureFrom: null,
      measureTo: null,

      viewport: { scale: 4, tx: 0, ty: 0 },
      fitSignal: 0,

      setTool: (t) => set({ tool: t, trenchDraft: null, dropDraft: null }),
      setPhase: (p) => set({ phase: p }),
      setTrenchMethod: (m) => {
        const d = get().trenchDraft;
        set({ trenchMethod: m, trenchDraft: d ? { ...d, method: m } : null });
      },
      setTrenchMethodFor: (routeId, m) =>
        set((s) => ({
          entities: {
            ...s.entities,
            trenches: s.entities.trenches.map((r) => (r.id === routeId ? { ...r, method: m } : r)),
          },
        })),
      setTrenchDucts: (routeId, ducts) =>
        set((s) => ({
          entities: {
            ...s.entities,
            trenches: s.entities.trenches.map((r) =>
              r.id === routeId ? { ...r, ducts } : r
            ),
          },
        })),
      setCabinetCapacity: (c) => set({ cabinetCapacity: c }),
      setFatPorts: (p) => set({ fatPorts: p }),
      setFatSplitter: (sp) => set({ fatSplitter: sp }),
      setSelection: (ids) => set({ selectedIds: ids }),

      loadMap: (map) =>
        set({
          mapId: map.id,
          entities: emptyEntities(),
          trenchDraft: null,
          dropDraft: null,
          selectedIds: [],
          measureFrom: null,
          measureTo: null,
          viewport: { scale: 4, tx: 0, ty: 0 },
        }),
      loadEntities: (entities) => set({ entities, selectedIds: [], trenchDraft: null, dropDraft: null }),
      clearAll: () => set({ entities: emptyEntities(), selectedIds: [], trenchDraft: null, dropDraft: null }),

      beginTrench: (p) =>
        set((s) => ({
          trenchDraft: { points: [p], method: s.trenchMethod },
        })),
      extendTrench: (p) =>
        set((s) =>
          s.trenchDraft
            ? { trenchDraft: { ...s.trenchDraft, points: [...s.trenchDraft.points, p] } }
            : {}
        ),
      undoTrenchPoint: () =>
        set((s) => {
          if (!s.trenchDraft) return {};
          const pts = s.trenchDraft.points.slice(0, -1);
          return { trenchDraft: pts.length ? { ...s.trenchDraft, points: pts } : null };
        }),
      commitTrench: () =>
        set((s) => {
          const d = s.trenchDraft;
          if (!d || d.points.length < 2) return { trenchDraft: null };
          const route: TrenchRoute = {
            id: uid(),
            points: d.points,
            method: d.method,
            ducts: defaultDuctsFor(d.method),
          };
          return {
            entities: { ...s.entities, trenches: [...s.entities.trenches, route] },
            trenchDraft: null,
            selectedIds: [route.id],
          };
        }),
      cancelTrench: () => set({ trenchDraft: null }),

      placeStructure: (kind, x, y) =>
        set((s) => ({
          entities: {
            ...s.entities,
            structures: [
              ...s.entities.structures,
              { id: uid(), kind, x, y },
            ],
          },
        })),
      placeCabinet: (x, y) =>
        set((s) => {
          const cab = { id: uid(), x, y, capacityF: s.cabinetCapacity };
          return {
            entities: { ...s.entities, cabinets: [...s.entities.cabinets, cab] },
            selectedIds: [cab.id],
          };
        }),
      placeFat: (x, y) =>
        set((s) => {
          const fat = {
            id: uid(),
            x,
            y,
            ports: s.fatPorts,
            splitter: s.fatSplitter,
          };
          return {
            entities: { ...s.entities, fats: [...s.entities.fats, fat] },
            selectedIds: [fat.id],
          };
        }),
      setFatSplitterFor: (fatId, sp) =>
        set((s) => ({
          entities: {
            ...s.entities,
            fats: s.entities.fats.map((f) =>
              f.id === fatId ? { ...f, splitter: sp } : f
            ),
          },
        })),

      beginDrop: (fatId, p) => set({ dropDraft: { fromFatId: fatId, points: [p] } }),
      extendDrop: (p) =>
        set((s) =>
          s.dropDraft
            ? { dropDraft: { ...s.dropDraft, points: [...s.dropDraft.points, p] } }
            : {}
        ),
      commitDrop: (buildingId) =>
        set((s) => {
          const d = s.dropDraft;
          if (!d || !d.fromFatId || d.points.length < 2) return { dropDraft: null };
          const drop = {
            id: uid(),
            fromFatId: d.fromFatId,
            toBuildingId: buildingId,
            points: d.points,
          };
          return {
            entities: { ...s.entities, drops: [...s.entities.drops, drop] },
            dropDraft: null,
            selectedIds: [drop.id],
          };
        }),
      cancelDrop: () => set({ dropDraft: null }),

      removeEntity: (kind, id) =>
        set((s) => {
          const e = s.entities;
          const next: ProjectEntities = {
            trenches: kind === 'trench' ? e.trenches.filter((r) => r.id !== id) : e.trenches,
            structures:
              kind === 'structure' ? e.structures.filter((r) => r.id !== id) : e.structures,
            cabinets: kind === 'cabinet' ? e.cabinets.filter((r) => r.id !== id) : e.cabinets,
            // حذف FAT يتضمن حذف إسقاطاته المرتبطة
            fats:
              kind === 'fat'
                ? e.fats.filter((r) => r.id !== id)
                : e.fats,
            drops:
              kind === 'drop'
                ? e.drops.filter((r) => r.id !== id)
                : kind === 'fat'
                  ? e.drops.filter((r) => r.fromFatId !== id)
                  : e.drops,
          };
          return { entities: next, selectedIds: s.selectedIds.filter((x) => x !== id) };
        }),

      moveEntity: (kind, id, x, y) =>
        set((s) => {
          const mv = <T extends { id: string; x: number; y: number }>(arr: T[]): T[] =>
            arr.map((r) => (r.id === id ? { ...r, x, y } : r));
          const e = s.entities;
          return {
            entities: {
              ...e,
              structures: kind === 'structure' ? mv(e.structures) : e.structures,
              cabinets: kind === 'cabinet' ? mv(e.cabinets) : e.cabinets,
              fats: kind === 'fat' ? mv(e.fats) : e.fats,
            },
          };
        }),

      setMeasure: (from, to) => set({ measureFrom: from, measureTo: to }),
      setViewport: (v) => set({ viewport: v }),
      requestFit: () => set((s) => ({ fitSignal: s.fitSignal + 1 })),
    }),
    {
      /* التاريخ يقتصر على الكيانات فقط */
      limit: 80,
      partialize: (state) => ({ entities: state.entities }) as SimulatorState,
      equality: (past, current) => past.entities === current.entities,
    }
  )
);

/* ===================== اختصارات التراجع/الإعادة ===================== */

const temporalStore = useSimulatorStore.temporal;

export const simUndo = (): void => temporalStore.getState().undo();
export const simRedo = (): void => temporalStore.getState().redo();
export const simClearHistory = (): void => temporalStore.getState().clear();

const subscribeTemporal = temporalStore.subscribe;

/** هل توجد خطوات يمكن التراجع عنها؟ */
export const useCanUndo = (): boolean =>
  useSyncExternalStore(
    subscribeTemporal,
    () => temporalStore.getState().pastStates.length > 0
  );

/** هل توجد خطوات معادة يمكن استرجاعها؟ */
export const useCanRedo = (): boolean =>
  useSyncExternalStore(
    subscribeTemporal,
    () => temporalStore.getState().futureStates.length > 0
  );
