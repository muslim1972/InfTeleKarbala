/**
 * أدوات الصلاحيات الموحدة (ملف معزول)
 * المطور ومشرف IT يتشاركان نفس مستوى الصلاحيات القصوى (isDeveloperLevel).
 */

/** الأدوار ذات المستوى الأعلى (مطابقة 100% لصلاحيات المطور) */
export const DEVELOPER_LEVEL_ROLES = ['developer', 'it_supervisor'] as const;

/** هل الدور ضمن مستوى المطور؟ (مطور / مشرف IT) */
export function isDeveloperLevel(adminRole?: string | null): boolean {
    return adminRole === 'developer' || adminRole === 'it_supervisor';
}
