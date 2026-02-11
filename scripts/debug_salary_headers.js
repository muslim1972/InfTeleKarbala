
import XLSX from 'xlsx';
import path from 'path';

const FILE_NAME = 'تفاصيل الراتب شهر 1 - 2026.xlsx';
const workbook = XLSX.readFile(path.resolve(process.cwd(), FILE_NAME));
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

const headers = rows[0];
const firstRow = rows[1]; // First data row

console.log('--- Column Analysis ---');
headers.forEach((h, i) => {
    console.log(`Index ${i}: Header="${h}" | Value="${firstRow[i]}"`);
});
