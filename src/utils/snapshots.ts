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
}

// الأشهر العراقية مع صيغة الترتيب المعتمدة من المستخدم
// (حزيران = الشهر السادس، آب = الثامن، تموز = السابع ...)
const IRAQI_MONTHS = [
    'كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
    'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'
];
const IRAQI_MONTH_ORDINALS = [
    'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس',
    'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'
];

/** اقتراح اسم النسخة الحالي بصيغة «شهر آب الثامن 2026» */
export function suggestSnapshotName(date: Date = new Date()): string {
    const m = date.getMonth();
    return `شهر ${IRAQI_MONTHS[m]} ${IRAQI_MONTH_ORDINALS[m]} ${date.getFullYear()}`;
}

/** جلب كل النسخ (الأحدث أولاً) */
export async function listMonthlySnapshots(): Promise<MonthlySnapshot[]> {
    const { data, error } = await supabase
        .from('monthly_snapshots')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as MonthlySnapshot[];
}

/** جلب النسخة المعروضة حالياً */
export async function fetchActiveSnapshot(): Promise<MonthlySnapshot | null> {
    const { data, error } = await supabase
        .from('monthly_snapshots')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();
    if (error) throw error;
    return (data as MonthlySnapshot) || null;
}

/** مزامنة النسخة المعروضة مع الحالة الحالية (يُستدعى قبل أي حقن بيانات جديد) */
export async function syncActiveSnapshot(): Promise<void> {
    const { error } = await supabase.rpc('sync_active_monthly_snapshot');
    if (error) throw error;
}

/**
 * إنشاء نسخة جديدة مسماة من الحالة الحالية بعد الحقن.
 * ملاحظة: p_sync_current = false لأن العميل زامن النسخة المعروضة *قبل* الحقن،
 * والمزامنة هنا بعد الحقن ستلتقط البيانات الجديدة في النسخة القديمة (تدمير).
 */
export async function commitMonthlySnapshot(
    name: string,
    source: string = 'excel',
    creatorName?: string | null
): Promise<string> {
    const { data, error } = await supabase.rpc('commit_monthly_snapshot', {
        p_name: name,
        p_source: source,
        p_creator_name: creatorName ?? null,
        p_sync_current: false
    });
    if (error) throw error;
    return data as string;
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

/** هل المستخدم مطور؟ (صلاحية الحذف والأدوات) */
export function isDeveloper(user: { admin_role?: string } | null | undefined): boolean {
    return user?.admin_role === 'developer';
}
