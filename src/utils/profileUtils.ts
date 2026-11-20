import { supabase } from '../lib/supabase';
import { CERTIFICATES } from '../constants/certificates';

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
            .rpc('get_departments_bypass_rls')
            .select('id, name')
            .in('id', deptIds);
            
        const deptMap: Record<string, string> = {};
        if (depts && Array.isArray(depts)) {
            depts.forEach((d: any) => { deptMap[d.id] = d.name; });
            
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
 * تنظيف مسمى الشهادة من الزيادات مثل النسب المئوية وتوحيد المسميات الرسمية
 */
export function cleanCertificate(text: any): string {
    if (!text || typeof text !== 'string') return String(text || '');
    
    let cleaned = text.trim();
    // إزالة الفراغات المزدوجة وتطبيع المسافات
    const normalized = cleaned.replace(/\s+/g, ' ');
    const noSpaces = cleaned.replace(/\s+/g, '');
    
    // 1. الدبلوم العالي بكل صيغه أولاً (قبل الدبلوم العادي قطعاً)
    if (
        normalized.includes('دبلوم عالي') || 
        normalized.includes('دبلو م عالي') || 
        noSpaces.includes('دبلومعالي')
    ) {
        return 'دبلوم عالي';
    }

    // 2. الدبلوم العادي / معهد (35%)
    if (normalized.includes('دبلوم') || normalized.includes('معهد')) {
        return 'دبلوم';
    }

    // 3. البكالوريوس
    if (normalized.includes('بكلوريوس') || normalized.includes('بكالوريوس') || normalized.includes('بكاوريوس') || normalized.includes('بكلويوس')) {
        return 'بكلوريوس';
    }

    // 4. الدراسات العليا الأخرى
    if (normalized.includes('ماجستير')) return 'ماجستير';
    if (normalized.includes('دكتوراه')) return 'دكتوراه';

    // 5. الشهادات الثانوية والأساسية
    if (normalized.includes('الاعدادية') || normalized.includes('اعدادية')) return 'الاعدادية';
    if (normalized.includes('المتوسطة') || normalized.includes('متوسطة')) return 'المتوسطة';
    if (normalized.includes('دون الابتدائية') || normalized.includes('يقرأ ويكتب') || normalized.includes('يقرا ويكتب')) return 'دون الابتدائية';
    if (normalized.includes('الابتدائية') || normalized.includes('ابتدائية') || normalized.includes('ابتدائيه')) return 'الابتدائية';
    if (normalized.includes('أمي') || normalized.includes('امي')) return 'أمي';
    
    // إزالة "بنسبة ...%" أو أي شيء يبدأ بـ "بنسبة" / "بنسبه"
    if (cleaned.includes('بنسبة')) {
        cleaned = cleaned.split('بنسبة')[0].trim();
    } else if (cleaned.includes('بنسبه')) {
        cleaned = cleaned.split('بنسبه')[0].trim();
    }
    
    // إزالة الأرقام العربية والإنجليزية وعلامة %
    cleaned = cleaned.replace(/[0-9\u0660-\u0669%]/g, '').trim();
    
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


/**
 * تحليل خلية الشهادة واستخراج الاسم والنسبة معاً، وتدقيق النسبة حسب المعايير
 */
export function extractCertificateData(val: any): { certName: string, certPerc: number } | null {
    if (!val) return null;
    let strVal = String(val).trim();
    
    // 1. تحويل الأرقام العربية إلى إنجليزية
    const arabicDigits: Record<string, string> = {
        '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
        '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
    };
    strVal = strVal.replace(/[٠-٩]/g, d => arabicDigits[d]);
    
    // 2. استخراج النسبة
    let extractedPerc = 0;
    const percMatch = strVal.match(/(\d+)\s*%/);
    if (percMatch) {
        extractedPerc = parseInt(percMatch[1], 10);
    } else {
        const numMatch = strVal.match(/(\d+)/);
        if (numMatch) {
            extractedPerc = parseInt(numMatch[1], 10);
        }
    }
    
    // 3. استخراج اسم الشهادة
    const certName = cleanCertificate(strVal);
    
    // 4. تدقيق الشهادة والنسبة
    const certDef = CERTIFICATES.find(c => 
        certName === c.label || 
        (c.aliases && c.aliases.includes(certName)) ||
        (certName === 'بكالوريوس' && c.label === 'بكلوريوس') ||
        (certName === 'بكلوريوس' && c.label === 'بكالوريوس')
    );
    
    if (certDef && certDef.percentage === extractedPerc) {
        // إذا طابقت النسبة المستخرجة الجدول الموجود في الكود
        return { certName: certDef.label, certPerc: extractedPerc };
    }
    
    if (certDef) {
        // إذا كان هناك شهادة معروفة لكن النسبة مختلفة أو غير موجودة في النص،
        // نعتمد على النسبة الصحيحة من الجدول حفاظاً على سلامة البيانات
        return { certName: certDef.label, certPerc: certDef.percentage };
    }
    
    return null;
}



/**
 * استخراج الاسم الثلاثي الذكي مع مراعاة وحماية الأسماء المركبة من البتر
 * (مثل: عبد الله، عبد الرحمن، عبد الحسن، أبو الحسن، نور الهدى، علاء الدين، فاطمة الزهراء)
 */
export function getSmartTripleName(fullName: string): string {
    if (!fullName || typeof fullName !== 'string') return '';
    const clean = fullName.trim().replace(/\s+/g, ' ');
    const rawWords = clean.split(' ');
    const mergedTokens: string[] = [];

    const compoundPrefixes = new Set([
        'عبد', 'ابو', 'أبو', 'ابن', 'بن', 'ام', 'أم', 'آل', 'ذو', 'ذا', 'ذي'
    ]);
    const compoundSuffixes = new Set([
        'الدين', 'الهدى', 'الزهراء', 'البنين', 'الاسلام', 'الإسلام', 'الله'
    ]);

    for (let i = 0; i < rawWords.length; i++) {
        const word = rawWords[i];
        const nextWord = rawWords[i + 1];

        if (compoundPrefixes.has(word) && nextWord) {
            mergedTokens.push(word + ' ' + nextWord);
            i++; // تخطي الكلمة التالية لأنها دمجت
        } else if (nextWord && compoundSuffixes.has(nextWord)) {
            mergedTokens.push(word + ' ' + nextWord);
            i++; // تخطي الكلمة التالية لأنها دمجت
        } else {
            mergedTokens.push(word);
        }
    }

    // إرجاع أول 3 مقاطع اسمية مدمجة
    return mergedTokens.slice(0, 3).join(' ');
}

/**
 * توحيد وصياغة التسلسل الإداري (مكان العمل) بسلسلة مقروءة ومرتبة دون تكرار
 * النمط: القسم / الشعبة / الوحدة
 * أو: كربلاء / شعبة القدرة (للشعب الرئيسية والمجمعات التابعة للإدارة)
 */
export function formatWorkplaceHierarchy(
    deptText?: string | null,
    sectionText?: string | null,
    unitText?: string | null,
    defaultGov: string = 'كربلاء'
): string {
    const cleanDept = cleanText(deptText);
    const cleanSec = cleanText(sectionText);
    const cleanUnit = cleanText(unitText);

    // إذا تطابق القسم والشعبة
    if (cleanDept && cleanSec && cleanDept === cleanSec) {
        return cleanDept.startsWith('شعبة') || cleanDept.startsWith('الشعبة') || cleanDept.startsWith('مجمع')
            ? `${defaultGov} / ${cleanDept}`
            : cleanDept;
    }

    const parts: string[] = [];

    if (cleanDept && cleanDept !== 'مديرية الاتصالات' && !cleanDept.includes('مديرية اتصالات')) {
        parts.push(cleanDept);
    } else {
        parts.push(defaultGov);
    }

    if (cleanSec && cleanSec !== cleanDept) {
        parts.push(cleanSec);
    }

    if (cleanUnit && cleanUnit !== cleanSec && cleanUnit !== cleanDept) {
        parts.push(cleanUnit);
    }

    if (parts.length === 0) return `مديرية اتصالات ${defaultGov}`;
    return parts.join(' / ');
}
