
import XLSX from 'xlsx';
import path from 'path';

const FILE_NAME = 'تفاصيل الراتب شهر 1 - 2026.xlsx';
const workbook = XLSX.readFile(path.resolve(process.cwd(), FILE_NAME));
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('--- Checking First 5 Rows of Excel ---');
// Headers
console.log('Headers:', rows[0]);

// First 5 data rows
for (let i = 1; i <= 5 && i < rows.length; i++) {
    console.log(`Row ${i}:`, JSON.stringify(rows[i]));
}
