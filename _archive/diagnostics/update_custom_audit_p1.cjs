const fs = require('fs');

let content = fs.readFileSync('D:/InfTeleKarbala/src/components/admin/CustomAudit.tsx', 'utf8');

// 1. Update imports
const oldImports = `import {
    ALLOWANCE_FIELDS,
    DEDUCTION_FIELDS,
    SALARY_FIELDS,
    resolveApprovedPercentage,
    getLegalAllowancePercentage,
    getExpectedGrossSalary,
    getExpectedNetSalary
} from '../../utils/salaryRules';`;

const newImports = `import {
    ALLOWANCE_FIELDS,
    AUDIT_ALLOWANCE_FIELDS,
    DEDUCTION_FIELDS,
    AUDIT_DEDUCTION_FIELDS,
    SALARY_FIELDS,
    resolveApprovedPercentage,
    getLegalAllowancePercentage,
    getPositionAllowancePercentage,
    getExpectedGrossSalary,
    getExpectedNetSalary
} from '../../utils/salaryRules';`;

if (content.includes(oldImports)) {
    content = content.replace(oldImports, newImports);
}

// 2. Update loadFinancialData to also fetch position_title and is_retired from profiles
const oldLoadFin = `    const loadFinancialData = useCallback(async (userId: string) => {
        const { data } = await supabase
            .from('financial_records')
            .select('*')
            .eq('user_id', userId)
            .single();

        setFinancialData(data);
        return data;
    }, []);`;

const newLoadFin = `    const loadFinancialData = useCallback(async (userId: string) => {
        const { data } = await supabase
            .from('financial_records')
            .select('*')
            .eq('user_id', userId)
            .single();

        const { data: prof } = await supabase
            .from('profiles')
            .select('position_title, is_retired')
            .eq('id', userId)
            .single();

        const merged = { ...data, position_title: prof?.position_title, is_retired: prof?.is_retired };
        setFinancialData(merged);
        return merged;
    }, []);`;

if (content.includes(oldLoadFin)) {
    content = content.replace(oldLoadFin, newLoadFin);
}

// 3. Update calculateSingle for marital_allowance and retirement
const oldCalcSingle = `        // -- تدقيق المخصصات والاستقطاعات التقليدي بالنبس المئوية --
        const approved = resolveApprovedPercentage(field, { ...finData, is_five_year_leave: isFiveYear });

        setApprovedPercentage(approved);`;

const newCalcSingle = `        // -- تدقيق المخصصات الزوجية (مقطوعة 50,000 د.ع) --
        if (field === 'marital_allowance') {
            const exp = fieldCurrentValue > 0 ? 50000 : 0;
            setApprovedPercentage(null);
            setAuditResult(exp);
            setRecalcResult(exp);
            setValidationState(Math.abs(exp - fieldCurrentValue) <= 1 ? 'match' : 'mismatch');
            return;
        }

        // -- تدقيق المخصصات والاستقطاعات التقليدي بالنبس المئوية --
        const approved = resolveApprovedPercentage(field, { ...finData, is_five_year_leave: isFiveYear });

        setApprovedPercentage(approved);`;

if (content.includes(oldCalcSingle)) {
    content = content.replace(oldCalcSingle, newCalcSingle);
}

// 4. Update generateMismatchReport: query profiles columns, skip retired, include position_title, and add specific field handlers
const oldQuery = `.select('*, profiles!inner(id, full_name, job_number, username)')`;
const newQuery = `.select('*, profiles!inner(id, full_name, job_number, username, position_title, is_retired)')`;

if (content.includes(oldQuery)) {
    content = content.replace(oldQuery, newQuery);
}

const oldSkip = `                // استبعاد الحسابات الاختبارية والتجريبية
                if (uname.startsWith('c12') || uname.includes('test') || fname.includes('تجريبي')) {
                    continue;
                }`;

const newSkip = `                // استبعاد الحسابات الاختبارية والتجريبية والمتقاعدين
                if (uname.startsWith('c12') || uname.includes('test') || fname.includes('تجريبي') || profile?.is_retired) {
                    continue;
                }`;

if (content.includes(oldSkip)) {
    content = content.replace(oldSkip, newSkip);
}

const oldFullRecord = `                // دمج بيانات الملف الشخصي
                const fullRecord = {
                    ...rec,
                    job_title: rec.job_title,
                    certificate_text: rec.certificate_text,
                    certificate_percentage: rec.certificate_percentage,
                    certificate_allowance: rec.certificate_allowance,
                    job_number: jn,
                    is_five_year_leave: isFiveYear
                };`;

const newFullRecord = `                // دمج بيانات الملف الشخصي
                const fullRecord = {
                    ...rec,
                    job_title: rec.job_title,
                    position_title: profile?.position_title || rec.position_title,
                    certificate_text: rec.certificate_text,
                    certificate_percentage: rec.certificate_percentage,
                    certificate_allowance: rec.certificate_allowance,
                    job_number: jn,
                    is_five_year_leave: isFiveYear
                };`;

if (content.includes(oldFullRecord)) {
    content = content.replace(oldFullRecord, newFullRecord);
}

// 5. Update dropdown select to use AUDIT_ALLOWANCE_FIELDS and AUDIT_DEDUCTION_FIELDS
const oldSelect = `{(auditType === 'allowances' ? ALLOWANCE_FIELDS : auditType === 'deductions' ? DEDUCTION_FIELDS : SALARY_FIELDS).map(f => (`;
const newSelect = `{(auditType === 'allowances' ? AUDIT_ALLOWANCE_FIELDS : auditType === 'deductions' ? AUDIT_DEDUCTION_FIELDS : SALARY_FIELDS).map(f => (`;

if (content.includes(oldSelect)) {
    content = content.replace(oldSelect, newSelect);
}

// 6. Update printSingleReport fieldsList
const oldPrintFields = `const fieldsList = auditType === 'allowances' ? ALLOWANCE_FIELDS : auditType === 'deductions' ? DEDUCTION_FIELDS : SALARY_FIELDS;`;
const newPrintFields = `const fieldsList = auditType === 'allowances' ? AUDIT_ALLOWANCE_FIELDS : auditType === 'deductions' ? AUDIT_DEDUCTION_FIELDS : SALARY_FIELDS;`;

if (content.includes(oldPrintFields)) {
    content = content.replace(oldPrintFields, newPrintFields);
}

fs.writeFileSync('D:/InfTeleKarbala/src/components/admin/CustomAudit.tsx', content, 'utf8');
console.log('CustomAudit.tsx step 1 completed.');
