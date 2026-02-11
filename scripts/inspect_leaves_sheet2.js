
import XLSX from 'xlsx';
import path from 'path';

const FILE_NAME = 'رصيد الاجازات.xlsx';
const workbook = XLSX.readFile(path.resolve(process.cwd(), FILE_NAME));

// Target Sheet: 'لجان + شكر' (Index 1)
const sheetName = 'لجان + شكر';
const sheet = workbook.Sheets[sheetName];

if (!sheet) {
    console.error(`Sheet "${sheetName}" not found.`);
    process.exit(1);
}

console.log(`--- Inspecting Sheet: ${sheetName} ---`);
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

if (rows.length === 0) {
    console.log('Sheet is empty.');
    process.exit(0);
}

console.log('Headers:', rows[0]);
console.log('\n--- First 5 Data Rows ---');
for (let i = 1; i <= 5 && i < rows.length; i++) {
    console.log(`Row ${i}:`, JSON.stringify(rows[i]));
}
