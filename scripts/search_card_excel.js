
import XLSX from 'xlsx';
import path from 'path';

const FILE_NAME = 'تفاصيل الراتب شهر 1 - 2026.xlsx';
const CARD_TO_FIND = '103131393';

const workbook = XLSX.readFile(path.resolve(process.cwd(), FILE_NAME));
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log(`Searching for Card: ${CARD_TO_FIND} in ${rows.length} rows...`);

let found = false;
rows.forEach((row, index) => {
    // Check all columns for the card number
    const rowStr = JSON.stringify(row);
    if (rowStr.includes(CARD_TO_FIND)) {
        console.log(`✅ Found at Row ${index + 1}:`, rowStr);
        found = true;
    }
});

if (!found) {
    console.log(`❌ Card ${CARD_TO_FIND} NOT FOUND in Excel file.`);
}
