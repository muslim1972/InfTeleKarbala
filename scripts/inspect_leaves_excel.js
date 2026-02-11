
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const FILE_NAME = 'رصيد الاجازات.xlsx';
const FILE_PATH = path.resolve(process.cwd(), FILE_NAME);

if (!fs.existsSync(FILE_PATH)) {
    console.error(`File not found: ${FILE_PATH}`);
    process.exit(1);
}

const workbook = XLSX.readFile(FILE_PATH);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// Get headers (first row with data)
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
if (rows.length === 0) {
    console.error('File is empty');
    process.exit(1);
}

const headers = rows[0];
console.log(`✅ Found ${headers.length} columns in "${FILE_NAME}":`);
console.log('--- Headers ---');
headers.forEach((h, i) => console.log(`[Col ${i}] ${h}`));

console.log('\n--- First 3 Data Rows Preview ---');
for (let i = 1; i <= 3 && i < rows.length; i++) {
    console.log(`Row ${i}:`, JSON.stringify(rows[i]));
}
