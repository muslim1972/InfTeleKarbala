/**
 * snapshots.ts - أدوات نظام النسخ الشهرية (Monthly Snapshots)
 * واجهة التعامل مع جداول ودوال النسخ على قاعدة البيانات:
 * - sync_active_monthly_snapshot : مزامنة النسخة المعروضة مع الحالة الحالية
 * - commit_monthly_snapshot      : إنشاء نسخة جديدة مسماة من الحالة الحالية
 * - activate_monthly_snapshot    : تفعيل نسخة تاريخية (تستبدل المعروضة في كل التطبيق)
 * - delete_monthly_snapshot      : حذف نسخة (للمطور)
 */
import { supabase } from '../lib/supabase';

export interface MonthlySnapshot {
    id: string;
    name: string;
    created_by: string | null;
    created_by_name: string | null;
    source: string;
    financial_count: number;
    profile_count: number;
    is_active: boolean;
    created_at: string;
    governorate?: string;
}

// الأشهر العراقية مع صيغة الترتيب المعتمدة من المستخدم
// (حزيران = الشهر السادس، آب = الثامن، تموز = السابع ...)
export const IRAQI_MONTHS = [
    'كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
    'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'
];
export const IRAQI_MONTH_ORDINALS = [
    'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس',
    'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'
];

/** اقتراح اسم النسخة الحالي بصيغة «شهر آب الثامن 2026» */
export function suggestSnapshotName(date: Date = new Date()): string {
    const m = date.getMonth();
    return snapshotNameFromMonth(m, date.getFullYear());
}

/** بناء اسم النسخة من رقم الشهر (0-11) والسنة */
export function snapshotNameFromMonth(monthIndex: number, year: number): string {
    return `شهر ${IRAQI_MONTHS[monthIndex]} ${IRAQI_MONTH_ORDINALS[monthIndex]} ${year}`;
}

/** تحليل اسم نسخة «شهر آب الثامن 2026» إلى {month, year} — null إن لم يطابق الصيغة */
export function parseSnapshotName(name: string): { month: number; year: number } | null {
    const trimmed = (name || '').trim();
    for (let m = 0; m < IRAQI_MONTHS.length; m++) {
        const pattern = `شهر ${IRAQI_MONTHS[m]} ${IRAQI_MONTH_ORDINALS[m]} (\\d{4})`;
        const match = trimmed.match(new RegExp(`^${pattern}$`));
        if (match) return { month: m, year: parseInt(match[1], 10) };
    }
    return null;
}

/**
 * استنتاج اسم النسخة الشهرية بذكاء من اسم الملف المرفوع
 * يدعم:
 * - راتب شهر 10 / شهر-10 / شهر_10 / 10-2026 / 2026-10
 * - تشرين الاول / تشرين الأول / ت1 / ت2 / ك1 / ك2
 * - أسماء الأشهر الصريحة
 */
export function detectSnapshotNameFromFileName(fileName: string): string | null {
    if (!fileName) return null;
    const clean = fileName.toLowerCase().replace(/[\-_]/g, ' ');

    // 1. استخراج السنة (إذا وجدت 202X) وإلا السنة الحالية
    const yearMatch = clean.match(/202[4-9]/);
    const targetYear = yearMatch ? parseInt(yearMatch[0], 10) : new Date().getFullYear();

    // 2. البحث بالاختصارات العراقية الشائعة (ت1، ت2، ك1، ك2) قبل البحث العام
    if (/\bت\s*1\b|\bت1\b/.test(clean)) return snapshotNameFromMonth(9, targetYear); // تشرين الأول
    if (/\bت\s*2\b|\bت2\b/.test(clean)) return snapshotNameFromMonth(10, targetYear); // تشرين الثاني
    if (/\bك\s*1\b|\bك1\b/.test(clean)) return snapshotNameFromMonth(11, targetYear); // كانون الأول
    if (/\bك\s*2\b|\bك2\b/.test(clean)) return snapshotNameFromMonth(0, targetYear); // كانون الثاني

    // 3. البحث برقم الشهر (مثال: شهر 10 أو شهر 8 أو شهر 08 أو شهر (10))
    const monthNumMatch = clean.match(/شهر\s*[\(\[]?\s*(\d{1,2})\s*[\)\]]?/);
    if (monthNumMatch) {
        const num = parseInt(monthNumMatch[1], 10);
        if (num >= 1 && num <= 12) {
            return snapshotNameFromMonth(num - 1, targetYear);
        }
    }

    // 4. البحث بالأسماء الصريحة
    for (let m = 0; m < IRAQI_MONTHS.length; m++) {
        const mName = IRAQI_MONTHS[m];
        const normMName = mName.replace(/[أإآ]/g, 'ا');
        const normClean = clean.replace(/[أإآ]/g, 'ا');
        if (normClean.includes(normMName)) {
            return snapshotNameFromMonth(m, targetYear);
        }
    }

    return null;
}

/** جلب كل النسخ (الأحدث أولاً) — لمحافظة محددة أو الكل */
export async function listMonthlySnapshots(governorate?: string): Promise<MonthlySnapshot[]> {
    let query = supabase
        .from('monthly_snapshots')
        .select('*')
        .order('created_at', { ascending: false });
    if (governorate) query = query.eq('governorate', governorate);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as MonthlySnapshot[];
}

/** جلب النسخة المعروضة حالياً لمحافظة محددة */
export async function fetchActiveSnapshot(governorate: string = 'karbala'): Promise<MonthlySnapshot | null> {
    const { data, error } = await supabase
        .from('monthly_snapshots')
        .select('*')
        .eq('is_active', true)
        .eq('governorate', governorate)
        .maybeSingle();
    if (error) throw error;
    return (data as MonthlySnapshot) || null;
}

/** مزامنة النسخة المعروضة مع الحالة الحالية (يُستدعى قبل أي حقن بيانات جديد) */
export async function syncActiveSnapshot(governorate: string = 'karbala'): Promise<void> {
    const { error } = await supabase.rpc('sync_active_monthly_snapshot', { p_governorate: governorate });
    if (error) throw error;
}

/**
 * اعتماد نسخة بالاسم المحدد من الحالة الحالية.
 * إن كان الاسم موجوداً مسبقاً → استبدال (Replacement): يُحذف محتوى النسخة القديم
 * ويُحفظ المحتوى الحالي مكانها وتصبح النسخة المعروضة. وإلا → إنشاء نسخة جديدة معروضة.
 * ملاحظة: p_sync_current = false لأن العميل زامن النسخة المعروضة *قبل* الحقن،
 * والمزامنة هنا بعد الحقن ستلتقط البيانات الجديدة في النسخة القديمة (تدمير).
 */
export async function commitMonthlySnapshot(
    name: string,
    source: string = 'excel',
    creatorName?: string | null,
    governorate: string = 'karbala'
): Promise<string> {
    const { data, error } = await supabase.rpc('commit_monthly_snapshot', {
        p_name: name,
        p_source: source,
        p_creator_name: creatorName ?? null,
        p_governorate: governorate,
        p_sync_current: false
    });
    if (error) throw error;
    return data as string;
}

/** تفعيل بطاقة محافظة (يُستدعى تلقائياً بعد أول رفع ناجح لها) */
export async function enableGovernorateCard(governorate: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('enable_governorate_card', { p_governorate: governorate });
    if (error) throw error;
    return Boolean(data);
}

/** تفعيل نسخة تاريخية (تستبدل المعروضة في كل التطبيق) */
export async function activateMonthlySnapshot(
    snapshotId: string
): Promise<{ restored: number; name: string }> {
    const { data, error } = await supabase.rpc('activate_monthly_snapshot', {
        p_snapshot_id: snapshotId
    });
    if (error) throw error;
    return { restored: Number(data?.restored ?? 0), name: String(data?.name ?? '') };
}

/** حذف نسخة (للمطور فقط) */
export async function deleteMonthlySnapshot(snapshotId: string): Promise<void> {
    const { error } = await supabase.rpc('delete_monthly_snapshot', {
        p_snapshot_id: snapshotId
    });
    if (error) throw error;
}

/** تعديل اسم نسخة شهرية (للمطور والمشرف) */
export async function renameMonthlySnapshot(snapshotId: string, newName: string): Promise<void> {
    const { error } = await supabase.rpc('rename_monthly_snapshot', {
        p_snapshot_id: snapshotId,
        p_new_name: newName.trim()
    });
    if (error) throw error;
}

/** هل المستخدم مطور؟ (صلاحية الحذف والأدوات) */
export function isDeveloper(user: { admin_role?: string } | null | undefined): boolean {
    return user?.admin_role === 'developer' || user?.admin_role === 'it_supervisor';
}

export interface HistoricalUserData {
    ok: boolean;
    snapshot_id: string;
    snapshot_name: string;
    governorate?: string;
    user_id: string;
    financial: any | null;
    profile: any | null;
}

/** جلب بيانات موظف محدد في شهر تاريخي محدد (للقراءة والاستعراض فقط دون مساس بقاعدة البيانات) */
export async function fetchHistoricalUserData(
    snapshotId: string,
    userId: string
): Promise<HistoricalUserData> {
    const { data, error } = await supabase.rpc('get_historical_user_data', {
        p_snapshot_id: snapshotId,
        p_target_user_id: userId
    });
    if (error) throw error;
    return data as HistoricalUserData;
}

