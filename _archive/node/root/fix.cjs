const fs = require('fs');
const content = /**
 * Central Payroll Validation Engine
 * Implements Iraqi payroll laws and mathematical relationships.
 */

export interface ValidationResult {
    isValid: boolean;
    expected: Record<string, number>;
    discrepancies: Record<string, string>;
}

export function validateFinancialRecord(record: any): ValidationResult {
    const expected: Record<string, number> = {};
    const discrepancies: Record<string, string> = {};
    let isValid = true;

    // Helper to safely parse numbers
    const parseNum = (val: any) => {
        if (val === null || val === undefined || val === '') return 0;
        const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
        return isNaN(num) ? 0 : num;
    };

    const nominalSalary = parseNum(record.nominal_salary);

    if (nominalSalary > 0) {
        // 1. Certificate Allowance
        const certPerc = parseNum(record.certificate_percentage);
        if (certPerc > 0) {
            expected.certificate_allowance = Math.round(nominalSalary * (certPerc / 100));
            const actualCertAllowance = parseNum(record.certificate_allowance);
            if (Math.abs(expected.certificate_allowance - actualCertAllowance) > 10) {
                discrepancies.certificate_allowance = \\\غير مطابق، والصحيح = \\\\;
                isValid = false;
            }
        }

        // 2. Risk Allowance
        const riskPerc = parseNum(record.risk_percentage);
        if (riskPerc > 0) {
            expected.risk_allowance = Math.round(nominalSalary * (riskPerc / 100));
            const actualRiskAllowance = parseNum(record.risk_allowance);
            if (Math.abs(expected.risk_allowance - actualRiskAllowance) > 10) {
                discrepancies.risk_allowance = \\\غير مطابق، والصحيح = \\\\;
                isValid = false;
            }
        }

        // 3. Retirement Deduction (Always 10%)
        expected.retirement_deduction = Math.round(nominalSalary * 0.10);
        const actualRetirement = parseNum(record.retirement_deduction);
        if (Math.abs(expected.retirement_deduction - actualRetirement) > 10) {
            discrepancies.retirement_deduction = \\\غير مطابق (10% من الاسمي)، والصحيح = \\\\;
            isValid = false;
        }

        // 4. Social Security Deduction (Always 0.25% - 2.5 per 1000)
        expected.social_security_deduction = Math.round(nominalSalary * 0.0025);
        const actualSocial = parseNum(record.social_security_deduction);
        if (actualSocial > 0 && Math.abs(expected.social_security_deduction - actualSocial) > 10) {
            discrepancies.social_security_deduction = \\\غير مطابق (0.25% من الاسمي)، والصحيح = \\\\;
            isValid = false;
        }
    }

    // 5. Total Allowances
    const allowanceFields = [
        'certificate_allowance', 'engineering_allowance', 'legal_allowance',
        'transport_allowance', 'marital_allowance', 'children_allowance',
        'position_allowance', 'risk_allowance', 'additional_50_percent_allowance'
    ];
    expected.total_allowances = allowanceFields.reduce((sum, field) => sum + parseNum(record[field]), 0);
    const actualTotalAllowances = parseNum(record.total_allowances);
    if (record.total_allowances !== undefined && Math.abs(expected.total_allowances - actualTotalAllowances) > 10) {
        discrepancies.total_allowances = \\\المجموع خاطئ، المجموع الحقيقي = \\\\;
        isValid = false;
    }

    // 6. Gross Salary (الراتب الكلي)
    expected.gross_salary = nominalSalary + expected.total_allowances;
    const actualGross = parseNum(record.gross_salary);
    if (actualGross > 0 && Math.abs(expected.gross_salary - actualGross) > 10) {
        discrepancies.gross_salary = \\\غير مطابق (الاسمي + المخصصات)، والصحيح = \\\\;
        isValid = false;
    }

    // 7. Total Deductions
    const deductionFields = [
        'tax_deduction_amount', 'loan_deduction', 'execution_deduction',
        'retirement_deduction', 'school_stamp_deduction', 'social_security_deduction',
        'other_deductions'
    ];
    expected.total_deductions = deductionFields.reduce((sum, field) => sum + parseNum(record[field]), 0);
    const actualTotalDeductions = parseNum(record.total_deductions);
    if (record.total_deductions !== undefined && Math.abs(expected.total_deductions - actualTotalDeductions) > 10) {
        discrepancies.total_deductions = \\\المجموع خاطئ، المجموع الحقيقي = \\\\;
        isValid = false;
    }

    // 8. Net Salary (الراتب الصافي)
    const baseGrossForNet = actualGross > 0 ? actualGross : expected.gross_salary;
    const baseDeductionsForNet = record.total_deductions !== undefined ? actualTotalDeductions : expected.total_deductions;
    
    expected.net_salary = baseGrossForNet - baseDeductionsForNet;
    const actualNet = parseNum(record.net_salary);
    if (actualNet > 0 && Math.abs(expected.net_salary - actualNet) > 10) {
        discrepancies.net_salary = \\\غير مطابق (الكلي - الاستقطاعات)، والصحيح = \\\\;
        isValid = false;
    }

    return { isValid, expected, discrepancies };
}

/**
 * Extracts percentage and cleaned string from typical Excel text fields.
 * Example: "%35 مخصصات هندسية بنسبة" -> { percentage: 35, text: "مخصصات هندسية" }
 */
export function extractPercentageFromText(text: string): { percentage: number | null, text: string } {
    if (!text) return { percentage: null, text: '' };
    
    const match = text.match(/(?:بنسبة|نسبة|خطوره)?\\s*(\\d{1,3})\\s*(?:%|بالمئة)?/);
    const percMatch2 = text.match(/%(\\d{1,3})/);
    const percMatch3 = text.match(/(\\d{1,3})%/);
    
    let percentage = null;
    let cleanText = text;

    if (match && match[1]) {
        percentage = parseInt(match[1], 10);
        cleanText = text.replace(match[0], '').replace(/[%-]/g, '').trim();
    } else if (percMatch2 && percMatch2[1]) {
        percentage = parseInt(percMatch2[1], 10);
        cleanText = text.replace(percMatch2[0], '').replace(/[%-]/g, '').trim();
    } else if (percMatch3 && percMatch3[1]) {
        percentage = parseInt(percMatch3[1], 10);
        cleanText = text.replace(percMatch3[0], '').replace(/[%-]/g, '').trim();
    }

    return { percentage, text: cleanText };
}
;
fs.writeFileSync('D:/InfTeleKarbala/src/utils/payrollValidation.ts', content, 'utf-8');
