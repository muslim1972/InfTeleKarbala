const XLSX = require('xlsx');
const workbook = XLSX.readFile('F:/صور للتجربة/نظام المديرية/excel/2026 - راتب شهر 8.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);
console.log('COLUMNS:', Object.keys(data[0]));
console.log('ROW 0:', data[0]);
