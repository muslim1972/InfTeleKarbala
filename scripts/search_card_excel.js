import ExcelJS from 'exceljs';
import path from 'path';

const FILE_NAME = 'تفاصيل الراتب شهر 1 - 2026.xlsx';
const CARD_TO_FIND = '103131393';

async function searchCardExcel() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path.resolve(process.cwd(), FILE_NAME));
    
    const sheet = workbook.worksheets[0];
    
    console.log(`Searching for Card: ${CARD_TO_FIND}...`);

    let found = false;
    sheet.eachRow((row, rowNumber) => {
        const rowStr = JSON.stringify(row.values);
        if (rowStr.includes(CARD_TO_FIND)) {
            console.log(`✅ Found at Row ${rowNumber}:`, rowStr);
            found = true;
        }
    });

    if (!found) {
        console.log(`❌ Card ${CARD_TO_FIND} NOT FOUND in Excel file.`);
    }
}

searchCardExcel().catch(e => console.error(e));