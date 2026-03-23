export type PatcherStep = 'upload' | 'map' | 'preview' | 'executing' | 'done' | 'manual_search' | 'manual_edit';
export type PatcherMode = 'patch' | 'sync' | 'manual';

export interface MatchResult {
    status: 'match' | 'missing' | 'new_record';
    recordId?: string; // For updates
    profileId?: string; // For inserts (new_record)
    currentName?: string;
    excelName: string;
    oldValue?: any;
    newValue: any;
    rawRow?: any[];
}

export const dbFields = [
    { label: 'الراتب الاسمي (Nominal Salary)', value: 'nominal_salary' },
    { label: 'الراتب الكلي (Gross Salary)', value: 'gross_salary' },
    { label: 'الراتب الصافي (Net Salary)', value: 'net_salary' },
    { label: 'مخصصات الشهادة', value: 'certificate_allowance' },
    { label: 'مخصصات هندسية', value: 'engineering_allowance' },
    { label: 'مخصصات الخطورة', value: 'risk_allowance' },
    { label: 'مخصصات الزوجية', value: 'marital_allowance' },
    { label: 'مخصصات الأطفال', value: 'children_allowance' },
    { label: 'استقطاع الضمان', value: 'social_security_deduction' },
    { label: 'استقطاع الضريبة', value: 'tax_deduction_amount' },
    { label: 'رصيد الاجازات المتبقي (أيام)', value: 'remaining_leaves_balance' },
    { label: 'تاريخ نفاذ الرصيد', value: 'leaves_balance_expiry_date' },
    { label: 'رقم الايبان (IBAN)', value: 'iban' },
];

export const normalizeText = (text: string) => {
    if (!text) return '';
    return String(text)
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove hidden characters (ZWSP, etc)
        .trim()
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا') // Normalize Alef
        .replace(/ة/g, 'ه') // Normalize Ta Marbuta to Ha
        .replace(/ى/g, 'ي') // Normalize Ya
        .replace(/عبد\s+ال/g, 'عبدال') // Normalize "Abd Al" to "Abdal" (no space)
        .replace(/عبدال/g, 'عبد ال') // Standardize to "Abd Al" (with space) for consistency
        .replace(/\s+/g, ' '); // Normalize multiple spaces to single
};

export const cleanValue = (val: any, field: string) => {
    // List of fields that MUST be numeric
    const numericFields = [
        'nominal_salary', 'salary_grade', 'salary_stage',
        'children_count', 'gross_salary', 'net_salary',
        'base_rate', 'transport_allowance', 'risk_allowance',
        'food_allowance', 'children_allowance',
        'social_security_deduction', 'tax_deduction_amount',
        'remaining_leaves_balance'
    ];

    if (numericFields.includes(field)) {
        if (typeof val === 'number') return val;
        if (val === null || val === undefined || val === '') return 0;
        const strVal = String(val).trim().replace(/,/g, '');
        if (strVal === '') return 0;
        const num = parseFloat(strVal);
        return isNaN(num) ? 0 : num;
    }

    if (val === null || val === undefined || val === '') return null;
    return String(val).trim();
};
