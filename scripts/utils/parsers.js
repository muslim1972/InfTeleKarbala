
import fs from 'fs';
import path from 'path';
import * as xlsx from 'xlsx';
import iconv from 'iconv-lite';
import { parseString } from 'xml2js';

// --- XML Parser for Employees ---
export async function parseEmployeeXML(filePath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            console.warn(`XML File not found: ${filePath}`);
            resolve([]);
            return;
        }

        const buffer = fs.readFileSync(filePath);
        const decoded = iconv.decode(buffer, 'win1256');

        parseString(decoded, (err, result) => {
            if (err) {
                reject(err);
                return;
            }

            try {
                // Adjust based on inspection: Root -> List -> Item
                const rootKey = Object.keys(result)[0];
                if (!rootKey) { resolve([]); return; }

                const listKey = Object.keys(result[rootKey])[0];
                if (!listKey) { resolve([]); return; }

                const rawItems = result[rootKey][listKey];

                if (!Array.isArray(rawItems)) {
                    resolve([]);
                    return;
                }

                const employees = rawItems.map(item => {
                    const getVal = (k) => item[k] ? item[k][0] : null;
                    // Job Number logic: try SAL_ID (Primary)
                    const jobNum = getVal('SAL_ID') || getVal('رقم_المنتسب');

                    return {
                        job_number: jobNum?.trim(),
                        full_name: getVal('SAL_NAME')?.trim() || getVal('اسم_')?.trim(),
                        card_number: getVal('CARD'),
                        // Extract other potential fields if available in XML
                        department: getVal('GET_DEP_SAL_COMP_C_SAL_DEP_C_'),
                        title: getVal('GET_DESC_COD_1_SAL_EMP_C_')
                    };
                }).filter(e => e.job_number && e.full_name);

                resolve(employees);
            } catch (error) {
                reject(error);
            }
        });
    });
}

// --- Excel Parser for Salaries ---
export function parseSalariesExcel(filePath) {
    if (!fs.existsSync(filePath)) {
        console.warn(`Excel File not found: ${filePath}`);
        return [];
    }

    const buffer = fs.readFileSync(filePath);
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = xlsx.utils.sheet_to_json(sheet);

    // Filter and map
    return rawData.map(row => {
        // Normalize keys (trim spaces)
        const getRowVal = (keyPattern) => {
            const key = Object.keys(row).find(k => k.trim() === keyPattern.trim());
            return row[key];
        };

        const jobNumber = getRowVal('الرقم الوظيفي');
        if (!jobNumber) return null;

        return {
            job_number: String(jobNumber).trim(),
            full_name: getRowVal('اسم الموظف'), // Note space in header
            salary_grade: getRowVal('الدرجة'),
            salary_stage: getRowVal('المرحلة'),
            nominal_salary: getRowVal('الراتب الاسمي'),
            // Allowances
            certificate_allowance: getRowVal('مخصصات الشهادة'),
            position_allowance: getRowVal('مخصصات المنصب'),
            engineering_allowance: getRowVal('مخصصات هندسية'),
            risk_allowance: getRowVal('مخصصات الخطورة'),
            legal_allowance: getRowVal('مخصصات القانونية'),
            transport_allowance: getRowVal('مخصصات النقل'),
            marital_allowance: getRowVal('مخصصات الزوجية'),
            children_allowance: getRowVal('مخصصات الاطفال'),
            additional_50_percent_allowance: getRowVal('المخصصات الاضافية 50%'),

            // Deductions
            loan_deduction: getRowVal('استقطاع مبلغ القرض'),
            execution_deduction: getRowVal('مبلغ التنفيذ'),
            tax_deduction_amount: getRowVal('الضريبة') || getRowVal('الضريبة'), // Note leading space check
            retirement_deduction: getRowVal('التقاعد'),
            social_security_deduction: getRowVal('الحماية الاجتماعية'),
            school_stamp_deduction: getRowVal('طابع مدرسي'),
            other_deductions: getRowVal('طرح مبلغ'),

            total_deductions: getRowVal('مجموع الاستقطاعات'),
            gross_salary: getRowVal('الراتب الاجمالي ( الايرادات)'),
            net_salary: getRowVal('الراتب الصافي'),
            iban: getRowVal('IBAN'),

            // Stats for Yearly Records
            committees_count: getRowVal('عدد اللجان في سنة 2025'),
            thanks_books_count: getRowVal('عدد كتب الشكر في سنة 2025')
        };
    }).filter(item => item !== null);
}

// --- Excel Parser for Leaves (Simple/Vague structure) ---
export function parseLeavesExcel(filePath) {
    if (!fs.existsSync(filePath)) {
        console.warn(`Excel File not found: ${filePath}`);
        return [];
    }

    const buffer = fs.readFileSync(filePath);
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    // header: 1 means array of arrays, useful for index-based parsing
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    // Skip header row
    const dataRows = rows.slice(1);

    return dataRows.map(row => {
        // Based on inspection, we need to map columns by index
        // [ 'ت', 0, 'UNKNOWN_2', 'اللجان', 'كتب الشكر' ]
        // Row 1: [ 1, 'SOME NAME OR NUMBER', 'BALANCE', ... ]

        // We will try to guess if col 1 is Name or Number.
        const identity = row[1];
        const balance = row[2];
        const committees = row[3];
        const thanks = row[4];

        return {
            raw_identity: identity,
            balance_maybe: balance,
            committees: committees,
            thanks: thanks
        };
    });
}
