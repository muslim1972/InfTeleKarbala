import fs from 'fs';

// 1. Update universalPatcherConfig.ts
let cConfig = fs.readFileSync('src/utils/universalPatcherConfig.ts', 'utf8');
const isCrlf = cConfig.includes('\r\n');
cConfig = cConfig.replace(/\r\n/g, '\n');

const targetHelper = `/** الحقول الرقمية لتنظيف القيم */
export function isNumericField(tableName: string, fieldValue: string): boolean {
    const table = TABLE_DEFINITIONS.find(t => t.tableName === tableName);
    if (!table) return false;
    const field = table.fields.find(f => f.value === fieldValue);
    return field?.type === 'numeric' || field?.type === 'integer';
}`;

const replHelper = `/** الحقول الرقمية لتنظيف القيم */
export function isNumericField(tableName: string, fieldValue: string): boolean {
    const table = TABLE_DEFINITIONS.find(t => t.tableName === tableName);
    if (!table) return false;
    const field = table.fields.find(f => f.value === fieldValue);
    return field?.type === 'numeric' || field?.type === 'integer';
}

/** فحص ما إذا كان الحقل حقلاً للتاريخ */
export function isDateField(tableName: string, fieldValue: string): boolean {
    const table = TABLE_DEFINITIONS.find(t => t.tableName === tableName);
    if (!table) return false;
    const field = table.fields.find(f => f.value === fieldValue);
    return field?.type === 'date' || fieldValue === 'birth_date';
}

/** تطبيع وتحويل التواريخ النصية وتواريخ إكسل العراقية (مثل 14/03/85) إلى صيغة YYYY-MM-DD */
export function normalizeDateValue(val: any): string | null {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val.getTime())) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return \`\${y}-\${m}-\${d}\`;
    }
    const str = String(val).trim();
    if (!str || str === 'لايوجد' || str === 'بدون' || str === '-' || str === '0') return null;

    const parts = str.split(/[\\/\\-\\.]/);
    if (parts.length === 3) {
        let [dStr, mStr, yStr] = parts;
        if (dStr.length === 4) {
            const temp = dStr;
            dStr = yStr;
            yStr = temp;
        }
        let day = parseInt(dStr, 10);
        let month = parseInt(mStr, 10);
        let year = parseInt(yStr, 10);

        if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

        if (year < 100) {
            const current2DigitYear = new Date().getFullYear() % 100;
            if (year <= current2DigitYear) {
                year = 2000 + year;
            } else {
                year = 1900 + year;
            }
        }

        const mm = String(month).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        return \`\${year}-\${mm}-\${dd}\`;
    }

    return null;
}`;

if (!cConfig.includes(targetHelper)) {
    console.error('targetHelper not found');
    process.exit(1);
}
cConfig = cConfig.replace(targetHelper, replHelper);

// Now update cleanFieldValue
const targetClean = `/** تنظيف قيمة حسب نوع الحقل */
export function cleanFieldValue(val: any, tableName: string, fieldValue: string): any {
    if (fieldValue === 'certificate_text') {
        return cleanCertificate(val);
    }

    // استخراج النتيجة إن كانت خلية صيغة أو كائن في ExcelJS
    if (val && typeof val === 'object' && 'result' in val) {
        val = val.result;
    }

    if (val instanceof Date && !isNaN(val.getTime())) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return \`\${y}-\${m}-\${d}\`;
    }
    
    if (isNumericField(tableName, fieldValue)) {`;

const replClean = `/** تنظيف قيمة حسب نوع الحقل */
export function cleanFieldValue(val: any, tableName: string, fieldValue: string): any {
    if (fieldValue === 'certificate_text') {
        return cleanCertificate(val);
    }

    // استخراج النتيجة إن كانت خلية صيغة أو كائن في ExcelJS
    if (val && typeof val === 'object' && 'result' in val) {
        val = val.result;
    }

    // تنظيف وتوحيد الجنس
    if (fieldValue === 'gender') {
        const s = String(val || '').trim();
        if (s.includes('انث') || s.includes('أنث') || s.toLowerCase() === 'female') return 'female';
        if (s.includes('ذكر') || s.toLowerCase() === 'male') return 'male';
        return s || null;
    }

    // تنظيف وتوحيد حقول التاريخ (مثل تاريخ الولادة)
    if (isDateField(tableName, fieldValue)) {
        return normalizeDateValue(val);
    }

    if (val instanceof Date && !isNaN(val.getTime())) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return \`\${y}-\${m}-\${d}\`;
    }
    
    if (isNumericField(tableName, fieldValue)) {`;

if (!cConfig.includes(targetClean)) {
    console.error('targetClean not found');
    process.exit(1);
}
cConfig = cConfig.replace(targetClean, replClean);

// Add 'تاريخ.الترك' to synonyms
const targetSyn = `leave_date: ['تاريخ الترك', 'تاريخ_الترك', 'ت_الترك', 'الترك',`;
const replSyn = `leave_date: ['تاريخ الترك', 'تاريخ_الترك', 'ت_الترك', 'تاريخ.الترك', 'الترك',`;

if (cConfig.includes(targetSyn)) {
    cConfig = cConfig.replace(targetSyn, replSyn);
}

if (isCrlf) {
    cConfig = cConfig.replace(/\n/g, '\r\n');
}
fs.writeFileSync('src/utils/universalPatcherConfig.ts', cConfig, 'utf8');
console.log('universalPatcherConfig.ts updated successfully');

// 2. Update useUniversalPatcher.ts
let cPatcher = fs.readFileSync('src/hooks/useUniversalPatcher.ts', 'utf8');
const isCrlfP = cPatcher.includes('\r\n');
cPatcher = cPatcher.replace(/\r\n/g, '\n');

const targetChunk = `            const tasks = effectiveMatches.filter(m => m.status === 'match' || m.status === 'new_record');
            const CHUNK_SIZE = 50;
            let lastErrMessage = '';`;

const replChunk = `            const tasks = effectiveMatches.filter(m => m.status === 'match' || m.status === 'new_record');
            const CHUNK_SIZE = 10;
            let lastErrMessage = '';`;

if (!cPatcher.includes(targetChunk)) {
    console.error('targetChunk not found');
    process.exit(1);
}
cPatcher = cPatcher.replace(targetChunk, replChunk);

if (isCrlfP) {
    cPatcher = cPatcher.replace(/\n/g, '\r\n');
}
fs.writeFileSync('src/hooks/useUniversalPatcher.ts', cPatcher, 'utf8');
console.log('useUniversalPatcher.ts updated successfully');
