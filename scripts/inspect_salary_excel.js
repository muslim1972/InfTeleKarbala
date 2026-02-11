
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const FILE_NAME = 'تفاصيل الراتب شهر 1 - 2026.xlsx';
const FILE_PATH = path.resolve(process.cwd(), FILE_NAME);

if (!fs.existsSync(FILE_PATH)) {
    console.error(`File not found: ${FILE_PATH}`);
    process.exit(1);
}

const workbook = XLSX.readFile(FILE_PATH);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// Get headers (first row)
const headers = [];
const range = XLSX.utils.decode_range(sheet['!ref']);
const R = range.s.r; // First row

for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = sheet[XLSX.utils.encode_cell({ r: R, c: C })];
    if (cell && cell.v) {
        headers.push({ col: C, text: String(cell.v).trim() });
    }
}

console.log(`✅ Found ${headers.length} columns in "${FILE_NAME}":`);
console.log('--- Headers ---');
headers.forEach(h => console.log(`[Col ${h.col}] ${h.text}`));

// Preview first data row to confirm alignment
const firstDataRowIndex = R + 1;
console.log('\n--- First Data Row Preview ---');
for (let C = range.s.c; C <= range.e.c; ++C) {
    const header = headers.find(h => h.col === C);
    const cell = sheet[XLSX.utils.encode_cell({ r: firstDataRowIndex, c: C })];
    if (header) {
        console.log(`${header.text}: ${cell ? cell.v : '(empty)'}`);
    }
}
