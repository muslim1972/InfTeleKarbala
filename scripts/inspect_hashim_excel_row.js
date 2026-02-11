
import XLSX from 'xlsx';
import path from 'path';

const FILE_NAME = 'تفاصيل الراتب شهر 1 - 2026.xlsx';
const ROW_INDEX = 304; // 0-based index for Row 305

const workbook = XLSX.readFile(path.resolve(process.cwd(), FILE_NAME));
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

const row = rows[ROW_INDEX];
console.log(`--- Inspecting Row ${ROW_INDEX + 1} (Hashim) ---`);
console.log('Raw Row:', JSON.stringify(row));

// Check index 2 (Card Number Column)
const cardVal = row[2];
console.log(`\nCard Value at Index 2:`);
console.log(`Type: ${typeof cardVal}`);
console.log(`Value: "${cardVal}"`);
if (typeof cardVal === 'string') {
    console.log(`Length: ${cardVal.length}`);
    console.log(`Char Codes: ${cardVal.split('').map(c => c.charCodeAt(0)).join(', ')}`);
}

// Check if it matches target
const target = '103131393';
console.log(`\nMatches Target "${target}"? ${String(cardVal).trim() === target}`);
