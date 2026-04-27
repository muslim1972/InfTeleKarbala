import ExcelJS from 'exceljs';
import path from 'path';

const FILE_NAME = 'تفاصيل الراتب شهر 1 - 2026.xlsx';

async function checkHeaders() {
    const filePath = path.resolve(process.cwd(), FILE_NAME);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const sheet = workbook.worksheets[0];
    const headerRow = sheet.getRow(1);
    
    console.log('--- Excel Headers ---');
    headerRow.eachCell((cell, colNumber) => {
        console.log(`Index ${colNumber - 1}: ${cell.value}`);
    });
}

checkHeaders().catch(e => console.error(e));