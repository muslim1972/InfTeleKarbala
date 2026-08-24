/**
 * ============================================================
 * محاكي بناء شبكات الألياف الضوئية (FTTH Simulator)
 * ميزة معزولة بالكامل — الأنواع الأساسية
 * ============================================================
 * جميع إحداثيات الخرائط بالمتر (World Units) وليس بالبكسل.
 */

export interface Vec2 {
  x: number;
  y: number;
}

/* ===================== الخريطة (Static Map Schema) ===================== */

export interface MapBuilding {
  id: string;
  label: string; // H1..H16
  polygon: Vec2[];
  connectionPoint: Vec2; // نقطة دخول الكابل للمنزل (تواجه الزقاق)
}

export interface MapRoad {
  id: string;
  name: string;
  centerline: Vec2[];
  width: number; // العرض بالمتر
  surface: 'asphalt' | 'soil';
}

export interface SimMap {
  id: string;
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  widthM: number;
  heightM: number;
  buildings: MapBuilding[];
  roads: MapRoad[];
  exchange: { point: Vec2; label: string };
  requirements: {
    homes: number;
    minRxDbm: number; // الحد الأدنى للإشارة عند المنزل
    maxDropMeters: number; // أقصى طول كابل إسقاط
    /** الكلفة المرجعية للدار الواحدة ($) — تُستخدم في معيار كفاءة الكلفة */
    budgetPerHomeUSD?: number;
    notes?: string;
  };
}

/* ===================== كيانات المشروع (Design Entities) ===================== */

export type TrenchMethod = 'open_asphalt' | 'open_soil' | 'micro' | 'hdd' | 'aerial';

export interface TrenchRoute {
  id: string;
  points: Vec2[];
  method: TrenchMethod;
  /** عدد الأنابيب داخل المسار */
  ducts: { hdpe32: number; hdpe40: number; micro7: number };
}

export type StructureKind = 'manhole' | 'handhole';

export interface Structure {
  id: string;
  kind: StructureKind;
  x: number;
  y: number;
}

export interface Cabinet {
  /** FDC — كبينة التوزيع الرئيسية (تحتوي ODF) */
  id: string;
  x: number;
  y: number;
  capacityF: 96 | 288;
}

export type SplitterRatio = '1:4' | '1:8' | '1:16' | '1:32';

export interface FatBox {
  /** FAT / صندوق التوزيع الطرفي مع القاسم البصري */
  id: string;
  x: number;
  y: number;
  ports: 16 | 32;
  splitter: SplitterRatio | null;
}

export interface DropCable {
  id: string;
  fromFatId: string;
  toBuildingId: string;
  points: Vec2[];
}

export interface ProjectEntities {
  trenches: TrenchRoute[];
  structures: Structure[];
  cabinets: Cabinet[];
  fats: FatBox[];
  drops: DropCable[];
}

export const emptyEntities = (): ProjectEntities => ({
  trenches: [],
  structures: [],
  cabinets: [],
  fats: [],
  drops: [],
});

export type EntityKind = 'trench' | 'structure' | 'cabinet' | 'fat' | 'drop';

/* ===================== الأدوات والأطوار ===================== */

export type ToolId =
  | 'select'
  | 'pan'
  | 'measure'
  | 'trench'
  | 'manhole'
  | 'handhole'
  | 'fdc'
  | 'fat'
  | 'drop'
  | 'eraser'
  | 'hint';

export type PhaseId = 'civil' | 'optical' | 'splicing' | 'testing';
