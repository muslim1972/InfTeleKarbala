import { supabase } from '../lib/supabase';

export interface ProfileDetails {
    id: string;
    full_name: string;
    job_number?: string;
    job_title?: string;
    department_id?: string;
    department_name?: string;
    role?: string;
    engineering_allowance?: number;
}

/**
 * Fetches profile details, financial records, and department names for a given list of user IDs.
 * Returns a map of user_id -> ProfileDetails for fast O(1) lookups.
 * Useful for resolving IDs in lists (like Leave Requests, Penalities, Tasks).
 */
export async function fetchProfilesMap(userIds: string[]): Promise<Record<string, ProfileDetails>> {
    const uniqueIds = [...new Set(userIds.filter(id => id && id.trim() !== ''))];
    if (uniqueIds.length === 0) return {};

    const profileMap: Record<string, ProfileDetails> = {};
    
    // 1. Fetch profiles
    const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select('id, full_name, job_number, job_title, department_id, role')
        .in('id', uniqueIds);

    if (profError) {
        console.error("Error fetching profiles map:", profError);
        return {};
    }

    if (profiles) {
        profiles.forEach(p => {
            profileMap[p.id] = { ...p } as ProfileDetails;
        });
    }

    // 2. Fetch financial records (often needed for engineers or positions)
    const { data: finData } = await supabase
        .from('financial_records')
        .select('user_id, engineering_allowance')
        .in('user_id', uniqueIds);
    
    if (finData) {
        finData.forEach(f => {
            if (profileMap[f.user_id]) {
                profileMap[f.user_id].engineering_allowance = f.engineering_allowance || 0;
            }
        });
    }

    // 3. Fetch departments
    const deptIds = [...new Set(profiles?.map(p => p.department_id).filter(Boolean) as string[])];
    if (deptIds.length > 0) {
        const { data: depts } = await supabase
            .from('departments')
            .select('id, name')
            .in('id', deptIds);
            
        const deptMap: Record<string, string> = {};
        if (depts) {
            depts.forEach(d => { deptMap[d.id] = d.name; });
            
            // Assign back to profiles
            Object.values(profileMap).forEach(p => {
                if (p.department_id && deptMap[p.department_id]) {
                    p.department_name = deptMap[p.department_id];
                }
            });
        }
    }

    return profileMap;
}

/**
 * تنظيف النصوص الإدارية (الأقسام، الشعب، الوحدات) من الزيادات
 * مثل: (/) أو (/كربلاء) أو (/ م.اتصالات كربلاء)
 */
export function cleanText(text: any): string {
    if (!text || typeof text !== 'string') return String(text || '');
    
    let cleaned = text.trim();
    
    // 1. إزالة كل ما بعد وحول العلامات المائلة أو الواصلة
    // مثال: "قسم المالي والاداري/ كربلاء" -> "قسم المالي والاداري"
    if (cleaned.includes('/') || (cleaned.includes('-') && !cleaned.startsWith('-'))) {
        const separator = cleaned.includes('/') ? '/' : '-';
        cleaned = cleaned.split(separator)[0].trim();
    }
    
    // 2. إزالة اللواحق الشائعة التي قد تأتي بدون علامة مائلة
    const suffixesToRemove = [
        /\s+كربلاء\s*$/,
        /\s+م\.اتصالات كربلاء\s*$/,
        /\s+م\.اتصالات\s*$/,
        /\s+اتصالات كربلاء\s*$/
    ];
    
    suffixesToRemove.forEach(pattern => {
        cleaned = cleaned.replace(pattern, '').trim();
    });
    
    // 3. تأكيد إزالة أي علامات مائلة متبقية في النهاية
    cleaned = cleaned.replace(/\/.*$/, '').trim();
    
    return cleaned;
}

/**
 * توحيد النصوص لغرض المقارنة والمطابقة البرمجية
 * تعالج مشاكل المسافات، الحروف المتشابهة (ه/ة، ي/ى)، وحالة الأحرف الإنجليزية
 */
export function normalizeForComparison(text: any): string {
    if (!text || typeof text !== 'string') return '';
    
    const normalized = text
        .trim()
        .replace(/\s+/g, ' ') // تحويل المسافات المتعددة لمسافة واحدة
        .replace(/[إأآ]/g, 'ا') // توحيد الألف
        .replace(/ة/g, 'ه')     // توحيد ه/ة
        .replace(/ى/g, 'ي')     // توحيد ي/ى
        .replace(/[\u064B-\u065F\u0670]/g, '') // حذف الحركات
        .toLowerCase();        // تحويل الإنجليزي لأحرف صغيرة

    // تقسيم الكلمات وترتيبها أبجدياً لمعالجة اختلاف ترتيب الكلمات (مثل: شعبة GIS مقابل GIS شعبة)
    return normalized.split(' ').sort().join(' ');
}

/**
 * تنظيف مسمى الشهادة من الزيادات مثل النسب المئوية
 */
export function cleanCertificate(text: any): string {
    if (!text || typeof text !== 'string') return String(text || '');
    
    let cleaned = text.trim();
    
    // إزالة "بنسبة ...%" أو أي شيء يبدأ بـ "بنسبة"
    if (cleaned.includes('بنسبة')) {
        cleaned = cleaned.split('بنسبة')[0].trim();
    }
    
    // توحيد المسميات الشائعة
    if (cleaned.includes('بكلوريوس') || cleaned.includes('بكالوريوس')) cleaned = 'بكلوريوس';
    if (cleaned.includes('ماجستير')) cleaned = 'ماجستير';
    if (cleaned.includes('دكتوراه')) cleaned = 'دكتوراه';
    
    return cleaned;
}

export function cleanFinancialAmount(val: any): number {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    
    // تحويل الأرقام العربية (٠١٢٣٤٥٦٧٨٩) إلى إنجليزية
    const arabicDigits: Record<string, string> = {
        '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
        '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
    };
    
    let cleaned = String(val).replace(/[٠-٩]/g, d => arabicDigits[d]);
    
    // إزالة الفواصل (العربية والإنجليزية) وأي أحرف غير رقمية عدا النقطة العشرية
    cleaned = cleaned.replace(/[،,]/g, '').replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    
    return isNaN(num) ? 0 : num;
}
