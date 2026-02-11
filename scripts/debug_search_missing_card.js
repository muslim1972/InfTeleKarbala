
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const FILE_NAME = 'تفاصيل الراتب شهر 1 - 2026.xlsx';
const TARGET_CARD = '117748684';

function searchCard() {
    console.log(`🔍 Searching for Card ${TARGET_CARD} in ${FILE_NAME}...`);

    const filePath = path.resolve(process.cwd(), FILE_NAME);
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    let found = false;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;

        // Iterate all columns
        for (let j = 0; j < row.length; j++) {
            const val = String(row[j]).trim();
            if (val.includes(TARGET_CARD)) {
                console.log(`✅ FOUND at Row ${i + 1}, Col ${j}: "${val}"`);
                console.log('Row Data:', row);
                found = true;
            }
        }
    }

    if (!found) {
        console.log(`❌ Card ${TARGET_CARD} NOT found in the entire file.`);
    }
}

searchCard();
