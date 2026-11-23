const fs = require('fs');

let content = fs.readFileSync('D:/InfTeleKarbala/src/utils/salaryRules.ts', 'utf8');

// 1. Add AUDIT_ALLOWANCE_FIELDS and AUDIT_DEDUCTION_FIELDS
if (!content.includes('AUDIT_ALLOWANCE_FIELDS')) {
    const allowanceFieldsBlock = `export const ALLOWANCE_FIELDS = [
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
export const AUDIT_ALLOWANCE_FIELDS = [
    { key: 'certificate_allowance', label: 'م. الشهادة' },
    { key: 'engineering_allowance', label: 'م. هندسية' },
    { key: 'legal_allowance', label: 'م. القانونية' },
    { key: 'position_allowance', label: 'م. المنصب' },
    { key: 'risk_allowance', label: 'م. الخطورة' },
    { key: 'additional_50_percent_allowance', label: 'م. اضافية 50%' },
    { key: 'marital_allowance', label: 'م. الزوجية' },
];`;

    content = content.replace(/export const ALLOWANCE_FIELDS = \[[\s\S]*?\];/, allowanceFieldsBlock);
}

if (!content.includes('AUDIT_DEDUCTION_FIELDS')) {
    const deductionFieldsBlock = `export const DEDUCTION_FIELDS = [
    { key: 'retirement_deduction', label: 'استقطاع التقاعد' },
    { key: 'social_security_deduction', label: 'استقطاع الحماية الاجتماعية' },
    { key: 'tax_deduction_amount', label: 'الاستقطاع الضريبي' },
    { key: 'loan_deduction', label: 'استقطاع القرض' },
    { key: 'execution_deduction', label: 'مبلغ التنفيذ' },
    { key: 'school_stamp_deduction', label: 'طابع مدرسي' },
    { key: 'other_deductions', label: 'استقطاعات أخرى' },
];

// الحقول المعروضة في قائمة تدقيق الاستقطاعات (الاستقطاعات القانونية الأساسية حصراً)
export const AUDIT_DEDUCTION_FIELDS = [
    { key: 'retirement_deduction', label: 'استقطاع التقاعد' },
    { key: 'social_security_deduction', label: 'استقطاع الحماية الاجتماعية' },
    { key: 'tax_deduction_amount', label: 'الاستقطاع الضريبي' },
];`;

    content = content.replace(/export const DEDUCTION_FIELDS = \[[\s\S]*?\];/, deductionFieldsBlock);
}

// 2. Add getPositionAllowancePercentage helper
if (!content.includes('function getPositionAllowancePercentage')) {
    const posFunc = `// ===== دالة مساعدة لحساب مخصصات المنصب بدقة وفق الهيكل الإداري =====
export function getPositionAllowancePercentage(finData: any): number {
    if (!finData) return 0;
    const pos = String(finData.position_title || finData.administrative_position || '').trim();
    if (!pos || pos === 'بدون منصب' || pos === 'متقاعد') return 0;

    const parts = pos.split('/').map(p => p.trim());
    let maxPct = 0;

    for (const part of parts) {
        if (/بديل/.test(part)) continue; // أدوار البديل لا تمنح مخصصات منصب
        if (/مدير\\s*المديرية/.test(part) && !/معاون/.test(part)) {
            maxPct = Math.max(maxPct, 25); // مدير المديرية 25%
        } else if (/معاون\\s*مدير\\s*المديرية|مدير\\s*قسم|مسؤول\\s*قسم/.test(part)) {
            maxPct = Math.max(maxPct, 20); // معاون مدير المديرية أو مدير قسم 20%
        } else if (/مسؤول\\s*شعبة|مسؤول\\s*الشعبة|مسؤول\\s*مجمع|مسؤول\\s*المجمع/.test(part)) {
            maxPct = Math.max(maxPct, 15); // مسؤول شعبة أو مجمع 15%
        }
    }
    return maxPct;
}
`;
    content = content.replace('export function getLegalAllowancePercentage', posFunc + '\nexport function getLegalAllowancePercentage');
}

// 3. Update resolveApprovedPercentage for risk, position, additional_50
const oldRiskAndPos = `    // --- 4. مخصصات الخطورة ---
    if (fieldKey === 'risk_allowance') {
        const legalPct = getLegalAllowancePercentage(finData);
        if (legalPct === 30) return 0; // إذا كان مستحقاً للقانونية، تحجب الخطورة
        return 30; // غير القانوني يستحق 30% خطورة
    }

    // --- 5. مخصصات المنصب (النسب الوزارية المعتمدة الرسمية) ---
    if (fieldKey === 'position_allowance') {
        const pos = String(finData.administrative_position || finData.position || '').trim();
        const fullText = \`\${pos} \${title}\`.trim();

        if (/مدير\\s*المديرية|مدير\\s*مديرية/i.test(fullText) && !/معاون/i.test(fullText) && !/مكتب/i.test(fullText)) {
            return 25; // مدير المديرية 25%
        }
        if (/معاون\\s*مدير/i.test(fullText)) {
            return 20; // معاون مدير المديرية 20%
        }
        if (/مدير\\s*قسم|مسؤول\\s*قسم|مسئول\\s*قسم|مدير\\s*القسم|مسؤول\\s*القسم/i.test(fullText)) {
            return 20; // مدير قسم أو مسؤول قسم 20%
        }
        if (/مسؤول\\s*شعبة|مسئول\\s*شعبة|مسؤول\\s*الشعبة|مسؤول\\s*مجمع|مسؤول\\s*المجمع/i.test(fullText)) {
            return 15; // مسؤول شعبة أو مجمع 15%
        }
        if (/مسؤول\\s*وحدة|مسئول\\s*وحدة|مسؤول\\s*الوحدة/i.test(fullText)) {
            return 0; // مسؤول وحدة لا شيء
        }

        // التحقق الذكي من النسبة المدفوعة فعلياً إن طابقت أحد النسب المعتمدة (25, 20, 15)
        const val = parseFloat(finData.position_allowance) || 0;
        if (val > 0 && nom > 0) {
            const pct = Math.round((val / nom) * 100);
            if ([25, 20, 15].includes(pct)) return pct;
        }
        return 0;
    }

    // --- 6. المخصصات الإضافية 50% ---
    if (fieldKey === 'additional_50_percent_allowance') {
        const val = parseFloat(finData.additional_50_percent_allowance) || 0;
        return val > 0 ? 50 : 0;
    }`;

const newRiskAndPos = `    // --- 4. مخصصات الخطورة ---
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
    }`;

if (content.includes(oldRiskAndPos)) {
    content = content.replace(oldRiskAndPos, newRiskAndPos);
}

fs.writeFileSync('D:/InfTeleKarbala/src/utils/salaryRules.ts', content, 'utf8');
console.log('salaryRules.ts successfully updated.');
