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

/** هل يحق للمستخدم الوصول لبطاقة / واجهة الموارد البشرية؟ */
export function canAccessHR(user: any): boolean {
    if (!user) return false;
    if (isDeveloperLevel(user.admin_role)) return true;
    if (user.admin_role === 'hr' || user.admin_role === 'general') return true;
    if (user.can_view_requests === true) return true;

    // حسابات خاصة وتجريبية ومسؤولة شعبة الموارد البشرية
    const name = user.full_name || '';
    const username = user.username || '';
    if (
        name.includes('مسلم عقيل') ||
        name.includes('مسلم قيل') ||
        name.includes('أسيل جبار') ||
        name.includes('اسيل جبار') ||
        name.includes('تجريبي') ||
        username.includes('تجريبي') ||
        username === 'test' ||
        username === 'test2'
    ) {
        return true;
    }
    return false;
}

