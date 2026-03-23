// ===== النسب المعتمدة حسب rwservlet.xml =====
export const APPROVED_PERCENTAGES: Record<string, number | null> = {
    certificate_allowance: null,
    engineering_allowance: null,
    legal_allowance: null,
    transport_allowance: null,
    marital_allowance: null,
    children_allowance: null,
    position_allowance: null,
    risk_allowance: null,
    additional_50_percent_allowance: null,
    tax_deduction_amount: null,
    loan_deduction: null,
    execution_deduction: null,
    retirement_deduction: 10,
    school_stamp_deduction: null,
    social_security_deduction: 0.25,
    other_deductions: null,
};

export const ALLOWANCE_FIELDS = [
    { key: 'certificate_allowance', label: 'م. الشهادة' },
    { key: 'engineering_allowance', label: 'م. هندسية' },
    { key: 'legal_allowance', label: 'م. القانونية' },
    { key: 'position_allowance', label: 'م. المنصب' },
    { key: 'risk_allowance', label: 'م. الخطورة' },
    { key: 'additional_50_percent_allowance', label: 'م. اضافية 50%' },
];

export const DEDUCTION_FIELDS = [
    { key: 'retirement_deduction', label: 'استقطاع التقاعد' },
    { key: 'social_security_deduction', label: 'استقطاع الحماية الاجتماعية' },
    { key: 'tax_deduction_amount', label: 'الاستقطاع الضريبي' },
];

export const SALARY_FIELDS = [
    { key: 'nominal_salary', label: 'الراتب الاسمي' },
    { key: 'gross_salary', label: 'الراتب الكلي (الاجمالي)' },
    { key: 'net_salary', label: 'الراتب المستحق (الصافي)' },
];

// ===== دالة مساعدة للتحقق من استحقاق المخصصات القانونية =====
export function getLegalAllowancePercentage(finData: any): number {
    const title = finData.job_title ? finData.job_title.trim() : '';
    const cert = finData.certificate_text ? finData.certificate_text.trim() : '';
    const normalizedCert = cert.replace(/[0-9%.\s\-\(\)]/g, '');

    // العناوين القانونية المحددة بدقة
    const legalTitles = [
        'مستشار قانوني',
        'مستشار قانوني اقدم',
        'مستشار قانوني اقدم اول',
        'مشاور قانوني',
        'مشاور قانوني اقدم',
        'مشاور قانوني اقدم اول',
        'ر مستشارين',
        'ر مستشارين اقدم',
        'ر مستشارين اقدم اول',
        'ر مشاورين',
        'ر مشاورين اقدم',
        'ر مشاورين اقدم اول'
    ];
    const isLegalTitle = legalTitles.some(t => title === t || title.includes(t));
    const isBachelor = normalizedCert.includes('بكلوريوس') || normalizedCert.includes('بكالوريوس');

    if (isLegalTitle && isBachelor) return 30;
    return 0;
}

// ===== الدالة المساعدة لحل النسبة المعتمدة =====
export function resolveApprovedPercentage(fieldKey: string, finData: any): number | null {
    if (!finData) return null;

    // === إجازة 5 سنوات: تصفير المخصصات ===
    if (finData.is_five_year_leave) {
        const isAllowance = ALLOWANCE_FIELDS.some(f => f.key === fieldKey);
        if (isAllowance) return 0;
    }
    if (fieldKey === 'certificate_allowance') {
        let t = finData.certificate_text ? finData.certificate_text.trim() : '';
        const normalized = t.replace(/[0-9%.\s\-\(\)]/g, '');

        if (normalized.includes('دكتوراه')) return 150;
        if (normalized.includes('ماجستير')) return 125;
        if (normalized.includes('دبلومعالي')) return 55; // دبلوم عالي
        if (normalized.includes('بكلوريوس') || normalized.includes('بكالوريوس')) return 45;
        if (normalized.includes('دبلوم') || normalized.includes('معهد')) return 35; // دبلوم أو معهد
        if (normalized.includes('اعدادية') || normalized.includes('إعدادية')) return 25;
        if (normalized.includes('توسطة')) return 15; // متوسطة
        if (normalized.includes('بتدائية') || normalized.includes('إبتدائية')) return 15;
        if (normalized.includes('يقرأ') || normalized.includes('أمي')) return 15;

        return 0; // Default
    }
    if (fieldKey === 'engineering_allowance') {
        const title = finData.job_title ? finData.job_title.trim() : '';
        const engineeringTitles = ['م مهندس', 'مهندس', 'ر مهندسين', 'ر مهندسين اقدم', 'ر مهندسين اقدم اول'];
        const isEngineer = engineeringTitles.some(t => title === t || title.includes(t));
        if (isEngineer) return 35;
        return 0;
    }
    if (fieldKey === 'legal_allowance') {
        return getLegalAllowancePercentage(finData);
    }
    if (fieldKey === 'risk_allowance') {
        const legalPct = getLegalAllowancePercentage(finData);
        if (legalPct === 30) return 0; // إذا كان مستحقاً للقانونية، تحجب الخطورة
        return 30;
    }
    if (fieldKey === 'position_allowance') {
        const val = parseFloat(finData.position_allowance) || 0;
        return val > 0 ? 15 : 0;
    }
    if (fieldKey === 'additional_50_percent_allowance') {
        const val = parseFloat(finData.additional_50_percent_allowance) || 0;
        return val > 0 ? 50 : 0;
    }
    const fixed = APPROVED_PERCENTAGES[fieldKey];
    if (fixed !== undefined && fixed !== null) return fixed;
    const nomSal = parseFloat(finData.nominal_salary) || 0;
    const storedVal = parseFloat(finData[fieldKey]) || 0;
    if (nomSal > 0 && storedVal > 0) {
        return Math.round((storedVal / nomSal) * 10000) / 100;
    }
    return null;
}
