// ===== النسب المعتمدة حسب rwservlet.xml وسلم رواتب الموظفين العراقي =====
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

export interface SalaryFieldItem {
    key: string;
    label: string;
}

export const ALLOWANCE_FIELDS: SalaryFieldItem[] = [
    { key: 'certificate_allowance', label: 'م. الشهادة' },
    { key: 'engineering_allowance', label: 'م. هندسية' },
    { key: 'legal_allowance', label: 'م. القانونية' },
    { key: 'position_allowance', label: 'م. المنصب' },
    { key: 'risk_allowance', label: 'م. الخطورة' },
    { key: 'additional_50_percent_allowance', label: 'م. اضافية 50%' },
    { key: 'transport_allowance', label: 'م. النقل' },
    { key: 'marital_allowance', label: 'م. الزوجية' },
    { key: 'children_allowance', label: 'م. الأطفال' },
];

// الحقول المعروضة في قائمة تدقيق المخصصات (مستبعد منها م.النقل وم.الأطفال بناء على طلب المشرف)
export const AUDIT_ALLOWANCE_FIELDS: SalaryFieldItem[] = [
    { key: 'certificate_allowance', label: 'م. الشهادة' },
    { key: 'engineering_allowance', label: 'م. هندسية' },
    { key: 'legal_allowance', label: 'م. القانونية' },
    { key: 'position_allowance', label: 'م. المنصب' },
    { key: 'risk_allowance', label: 'م. الخطورة' },
    { key: 'additional_50_percent_allowance', label: 'م. اضافية 50%' },
    { key: 'marital_allowance', label: 'م. الزوجية' },
];

export const DEDUCTION_FIELDS: SalaryFieldItem[] = [
    { key: 'retirement_deduction', label: 'استقطاع التقاعد' },
    { key: 'social_security_deduction', label: 'استقطاع الحماية الاجتماعية' },
    { key: 'tax_deduction_amount', label: 'الاستقطاع الضريبي' },
    { key: 'loan_deduction', label: 'استقطاع القرض' },
    { key: 'execution_deduction', label: 'مبلغ التنفيذ' },
    { key: 'school_stamp_deduction', label: 'طابع مدرسي' },
    { key: 'other_deductions', label: 'استقطاعات أخرى' },
];

// الحقول المعروضة في قائمة تدقيق الاستقطاعات (الاستقطاعات القانونية الأساسية حصراً)
export const AUDIT_DEDUCTION_FIELDS: SalaryFieldItem[] = [
    { key: 'retirement_deduction', label: 'استقطاع التقاعد' },
    { key: 'social_security_deduction', label: 'استقطاع الحماية الاجتماعية' },
    { key: 'tax_deduction_amount', label: 'الاستقطاع الضريبي' },
];

export const SALARY_FIELDS: SalaryFieldItem[] = [
    { key: 'nominal_salary', label: 'الراتب الاسمي' },
    { key: 'gross_salary', label: 'الراتب الكلي (الاجمالي)' },
    { key: 'net_salary', label: 'الراتب المستحق (الصافي)' },
];

// ===== دالة مساعدة لحساب علاوة السائقين (87,500 د.ع) غير المفصلة في عمود مستقل =====
export function getDriverAllowance(finData: any): number {
    if (!finData) return 0;
    const title = String(finData.job_title || '').trim();
    if (/سائق|سواق|سياقة/.test(title)) {
        return 87500;
    }
    return 0;
}

// ===== دالة مساعدة لاحتساب الراتب الإجمالي المستحق =====
export function getExpectedGrossSalary(finData: any): number {
    if (!finData) return 0;
    const nom = parseFloat(finData.nominal_salary) || 0;
    if (finData.is_five_year_leave) return nom;

    const allowancesSum = ALLOWANCE_FIELDS.reduce((sum, f) => sum + (parseFloat(finData[f.key]) || 0), 0);
    const driver = getDriverAllowance(finData);
    return nom + allowancesSum + driver;
}

// ===== دالة مساعدة لاحتساب الراتب الصافي المستحق =====
export function getExpectedNetSalary(finData: any): number {
    if (!finData) return 0;
    const nom = parseFloat(finData.nominal_salary) || 0;
    if (finData.is_five_year_leave) {
        const ret = Math.round(nom * 0.25);
        const soc = Math.round(nom * 0.0025);
        return nom - ret - soc;
    }

    const gross = parseFloat(finData.gross_salary) || getExpectedGrossSalary(finData);
    const totalDeductions = parseFloat(finData.total_deductions);
    if (!isNaN(totalDeductions) && totalDeductions >= 0) {
        return gross - totalDeductions;
    }

    const allDeductions = DEDUCTION_FIELDS.reduce((sum, f) => sum + (parseFloat(finData[f.key]) || 0), 0);
    return gross - allDeductions;
}

// ===== دالة مساعدة للتحقق من استحقاق المخصصات القانونية =====
// ===== دالة مساعدة لحساب مخصصات المنصب بدقة وفق الهيكل الإداري =====
export function getPositionAllowancePercentage(finData: any): number {
    if (!finData) return 0;
    const pos = String(finData.position_title || finData.administrative_position || '').trim();
    if (!pos || pos === 'بدون منصب' || pos === 'متقاعد') return 0;

    const parts = pos.split('/').map(p => p.trim());
    let maxPct = 0;

    for (const part of parts) {
        if (/بديل/.test(part)) continue; // أدوار البديل لا تمنح مخصصات منصب
        if (/مدير\s*المديرية/.test(part) && !/معاون/.test(part)) {
            maxPct = Math.max(maxPct, 25); // مدير المديرية 25%
        } else if (/معاون\s*مدير\s*المديرية|مدير\s*قسم|مسؤول\s*قسم/.test(part)) {
            maxPct = Math.max(maxPct, 20); // معاون مدير المديرية أو مدير قسم 20%
        } else if (/مسؤول\s*شعبة|مسؤول\s*الشعبة|مسؤول\s*مجمع|مسؤول\s*المجمع/.test(part)) {
            maxPct = Math.max(maxPct, 15); // مسؤول شعبة أو مجمع 15%
        }
    }
    return maxPct;
}

export function getLegalAllowancePercentage(finData: any): number {
    const title = finData.job_title ? finData.job_title.trim() : '';
    const cert = finData.certificate_text ? finData.certificate_text.trim() : '';
    const normalizedCert = cert.replace(/[0-9%.\s\-()]/g, '');

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
    const isLegalTitle = legalTitles.some(t => title === t || title.includes(t)) || /قانوني|مشاور|مستشار\s*قانوني/.test(title);
    const isBachelor = normalizedCert.includes('بكلوريوس') || normalizedCert.includes('بكالوريوس');

    if (isLegalTitle && isBachelor) return 30;
    return 0;
}

// ===== الدالة المساعدة لحل النسبة المعتمدة =====
export function resolveApprovedPercentage(fieldKey: string, finData: any): number | null {
    if (!finData) return null;

    const jobNum = finData.job_number ? String(finData.job_number).trim() : '';
    const title = finData.job_title ? finData.job_title.trim() : '';

    // === العقود والأجور اليومية: استثناء تام من المخصصات الوزارية ===
    const isContractOrDaily = (jobNum.startsWith('143264') || /عقد|اجير|أجير/.test(title));
    if (isContractOrDaily) {
        if (ALLOWANCE_FIELDS.some(f => f.key === fieldKey)) return 0;
        return 0;
    }

    // === إجازة 5 سنوات: تصفير المخصصات وتعديل نسبة التقاعد إلى 25% ===
    const nom = parseFloat(finData.nominal_salary) || 0;
    const gross = parseFloat(finData.gross_salary) || 0;
    const certAll = parseFloat(finData.certificate_allowance) || 0;
    const isFiveYear = (finData.is_five_year_leave && Math.abs(gross - nom) < 10 && certAll === 0) || (
        gross > 0 &&
        Math.abs(gross - nom) < 10 &&
        certAll === 0 &&
        (parseFloat(finData.risk_allowance) || 0) === 0
    );

    if (isFiveYear) {
        const isAllowance = ALLOWANCE_FIELDS.some(f => f.key === fieldKey);
        if (isAllowance) return 0;
        if (fieldKey === 'retirement_deduction') return 25;
        if (fieldKey === 'social_security_deduction') return 0.25;
    }

    // --- 1. مخصصات الشهادة ---
    if (fieldKey === 'certificate_allowance') {
        // إذا كان الموظف لديه نسبة م.الشهادة مسجلة في السجل المالي، تعتمد فوراً كأساس استحقاق
        const storedCertPct = parseFloat(finData.certificate_percentage);
        if (!isNaN(storedCertPct) && storedCertPct > 0) {
            return storedCertPct;
        }

        const t = finData.certificate_text ? finData.certificate_text.trim() : '';
        const normalized = t.replace(/[0-9%.\s\-()]/g, '');

        if (normalized.includes('دكتوراه')) return 150;
        if (normalized.includes('ماجستير')) return 125;
        if (normalized.includes('دبلومعالي')) return 55; // دبلوم عالي
        if (normalized.includes('بكلوريوس') || normalized.includes('بكالوريوس')) return 45;
        if (normalized.includes('دبلوم') || normalized.includes('معهد')) return 35; // دبلوم أو معهد
        if (normalized.includes('اعدادية') || normalized.includes('إعدادية')) return 25;
        if (normalized.includes('توسطة')) return 15; // متوسطة
        if (normalized.includes('بتدائية') || normalized.includes('إبتدائية') || normalized.includes('دونالابتدائية')) return 15;
        if (normalized.includes('يقرأ') || normalized.includes('أمي')) return 15;

        return 0; // Default
    }

    // --- 2. مخصصات هندسية ---
    if (fieldKey === 'engineering_allowance') {
        // المستوى الأول: إذا كانت نسبة الهندسية مسجلة في السجل المالي/الإكسل
        const storedEngPct = parseFloat(finData.engineering_percentage);
        if (!isNaN(storedEngPct) && storedEngPct > 0) {
            return storedEngPct;
        }

        // الاستنباط الذكي للمستوى الثاني:
        const currentEngVal = parseFloat(finData.engineering_allowance) || 0;
        if (nom > 0 && currentEngVal > 0 && Math.abs(currentEngVal - (nom * 0.35)) < 10) {
            return 35;
        }

        const isEngineer = /مهندس|هندس/.test(title);
        const cert = finData.certificate_text ? finData.certificate_text.trim() : '';
        const isBachelorOrHigher = cert.includes('بكلوريوس') || cert.includes('بكالوريوس') || cert.includes('ماجستير') || cert.includes('دكتوراه') || cert.includes('دبلوم عالي');
        if (isEngineer && isBachelorOrHigher) return 35;

        return 0;
    }

    // --- 3. مخصصات القانونية ---
    if (fieldKey === 'legal_allowance') {
        return getLegalAllowancePercentage(finData);
    }

    // --- 4. مخصصات الخطورة ---
    if (fieldKey === 'risk_allowance') {
        const grade = parseInt(finData.salary_grade, 10);
        if ([8, 9, 10].includes(grade)) return 0; // الدرجات 8 و 9 و 10 خطورتهم صفر وتستحق مخصصات إضافية 50%
        const legalPct = getLegalAllowancePercentage(finData);
        if (legalPct === 30) return 0; // إذا كان مستحقاً للقانونية، تحجب الخطورة
        return 30; // غير القانوني يستحق 30% خطورة
    }

    // --- 5. مخصصات المنصب (النسب الوزارية المعتمدة الرسمية) ---
    if (fieldKey === 'position_allowance') {
        return getPositionAllowancePercentage(finData);
    }

    // --- 6. المخصصات الإضافية 50% ---
    if (fieldKey === 'additional_50_percent_allowance') {
        const grade = parseInt(finData.salary_grade, 10);
        return [8, 9, 10].includes(grade) ? 50 : 0;
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
