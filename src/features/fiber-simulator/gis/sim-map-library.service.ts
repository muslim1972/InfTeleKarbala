/**
 * ============================================================
 * خدمة مكتبة خرائط المحاكي المشتركة — جدول sim_map_library المعزول
 * ============================================================
 * النموذج: ملفات GeoJSON كاملة يرفعها حساب المطور من جهازه إلى
 * قاعدة البيانات، فتظهر في قائمة «مكتبة الخرائط» لجميع المستخدمين.
 * لا أي جلب شبكي خارجي — الخريطة إمّا من ملف المستخدم المحلي
 * أو من المكتبة المشتركة.
 *
 * الصلاحيات تُطبَّق نهائياً على مستوى RLS في الخادم (سياسات
 * sim_map_library_* وفحص sim_is_preset_manager) — الواجهة تتحقق
 * فقط لجودة الرسائل.
 *
 * العزل: لا يعتمد سوى عميل Supabase المشترك والمحوّل المحلي
 * geoJsonToSimMap (للتحقق من صحة الملف قبل الرفع وللتحويل عند
 * الفتح) — ولا يلمس أي جدول آخر.
 * الأمان: JSON.parse فقط، سقف 8MB، ولا حقن HTML (النصوص تُعرض نصاً).
 */

import { supabase } from '../../../lib/supabase';
import { geoJsonToSimMap, GisImportError } from './geojsonToSimMap';
import type { SimMap } from '../types';

const TABLE = 'sim_map_library';

/** سقف حجم ملف المكتبة — مطابق لقيد الجدول pg_column_size (8MB) */
export const LIBRARY_MAX_FILE_BYTES = 8_000_000;

/** خريطة في المكتبة — بيانات القائمة الخفيفة (بلا map_data) */
export interface LibraryEntry {
  id: string;
  label: string;
  buildings: number;
  roads: number;
  createdAt: string;
}

interface LibraryRow {
  id: string;
  label: string;
  buildings_count: number;
  roads_count: number;
  created_at: string;
}

function rowToEntry(r: LibraryRow | null | undefined): LibraryEntry | null {
  if (!r) return null;
  if (typeof r.id !== 'string' || r.id.length === 0) return null;
  if (typeof r.label !== 'string') return null;
  return {
    id: r.id,
    label: r.label,
    buildings: typeof r.buildings_count === 'number' ? r.buildings_count : 0,
    roads: typeof r.roads_count === 'number' ? r.roads_count : 0,
    createdAt: typeof r.created_at === 'string' ? r.created_at : '',
  };
}

/* ======================= القراءة (للجميع) ======================= */

/** قائمة المكتبة — قد تكون فارغة تماماً (هذا حالها الطبيعي عند البداية) */
export async function listMapLibrary(): Promise<LibraryEntry[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id,label,buildings_count,roads_count,created_at')
    .order('created_at', { ascending: true });
  if (error) throw new Error('تعذّرت قراءة مكتبة الخرائط');
  const out: LibraryEntry[] = [];
  for (const raw of (data ?? []) as unknown[]) {
    const e = rowToEntry(raw as LibraryRow);
    if (e) out.push(e);
  }
  return out;
}

/** فتح خريطة من المكتبة: جلب GeoJSON كامل + تحويل محلي إلى SimMap */
export async function loadMapFromLibrary(id: string): Promise<SimMap> {
  if (typeof id !== 'string' || id.length === 0)
    throw new Error('معرّف خريطة غير صالح');
  const { data, error } = await supabase
    .from(TABLE)
    .select('label,map_data')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) throw new Error('تعذّر تحميل الخريطة من المكتبة');
  const row = data as { label?: unknown; map_data?: unknown };
  if (row.map_data === null || typeof row.map_data !== 'object')
    throw new Error('بيانات الخريطة في المكتبة تالفة — اطلب من المطور إعادة رفعها');
  const label =
    typeof row.label === 'string' && row.label.trim() ? row.label.trim() : 'خريطة من المكتبة';
  const text = JSON.stringify(row.map_data);
  try {
    return geoJsonToSimMap(text, { name: label }).map;
  } catch (e) {
    throw new Error(
      e instanceof GisImportError ? e.message : 'تعذّر تحويل خريطة المكتبة — أعد رفعها من المطور'
    );
  }
}

/* ======================= الكتابة (حساب المطور) ======================= */

export interface LibraryUploadResult {
  entry: LibraryEntry;
}

/**
 * رفع ملف GeoJSON إلى المكتبة المشتركة:
 * تحقق الاسم والحجم والصيغة → تحليل محلي للتحقق من الصلاحية
 * (وإلا رسالة عربية دقيقة من المحوّل) → إدخال كائن GeoJSON في jsonb.
 * يرجع { entry } عند النجاح أو رسالة خطأ عربية.
 */
export async function uploadMapToLibrary(
  label: string,
  file: File
): Promise<LibraryUploadResult | string> {
  const cleanLabel = label.trim();
  if (cleanLabel.length < 2) return 'اسم الخريطة قصير جداً (حرفان على الأقل)';
  if (cleanLabel.length > 80) return 'اسم الخريطة طويل جداً (80 حرفاً كحد أقصى)';
  if (file.size > LIBRARY_MAX_FILE_BYTES)
    return `حجم الملف ${(file.size / 1_000_000).toFixed(1)}MB يتجاوز الحد 8MB — اختر منطقة أصغر`;
  const nameOk = /\.(geo)?json$/i.test(file.name) || file.type.includes('json');
  if (!nameOk) return 'الملف ليس GeoJSON/JSON — اختر ملفاً بصيغة .geojson أو .json';

  const text = await file.text();
  /* تحقق مسبق بالمحوّل المحلي: يضمن أن الملف صالح للمحاكي قبل
   * رفعه، ويعيد إحصاءات المباني والطرق لعرضها في القائمة */
  let buildings = 0;
  let roads = 0;
  try {
    const stats = geoJsonToSimMap(text, { name: cleanLabel }).stats;
    buildings = stats.buildings;
    roads = stats.roads;
  } catch (e) {
    return e instanceof GisImportError ? e.message : 'تعذّر تحليل الملف';
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return 'تعذّر تحليل JSON — الملف تالف';
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ label: cleanLabel, map_data: parsed, buildings_count: buildings, roads_count: roads })
    .select('id,label,buildings_count,roads_count,created_at')
    .single();
  if (error) {
    /* 23505: انتهاك قيد التفرد (label unique) */
    if ((error as { code?: string }).code === '23505') return 'يوجد خريطة بنفس الاسم في المكتبة';
    return 'تعذّر الرفع — تأكد أنك مسجّل بحساب المطور ثم أعد المحاولة';
  }
  const entry = rowToEntry(data as LibraryRow);
  return entry ? { entry } : 'رُفعت الخريطة لكن تعذّر تأكيد بياناتها — أعد فتح النافذة';
}

/** حذف خريطة من المكتبة — يرجع null عند النجاح أو رسالة خطأ عربية */
export async function deleteMapFromLibrary(id: string): Promise<string | null> {
  if (typeof id !== 'string' || id.length === 0) return 'معرّف خريطة غير صالح';
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  return error ? 'تعذّر الحذف — تأكد أنك مسجّل بحساب المطور ثم أعد المحاولة' : null;
}
