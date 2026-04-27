import ExcelJS from 'exceljs';
import path from 'path';

const FILE_NAME = 'تفاصيل الراتب شهر 1 - 2026.xlsx';

async function debugExcelRows() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path.resolve(process.cwd(), FILE_NAME));
    
    const sheet = workbook.worksheets[0];
    
    console.log('--- Checking First 5 Rows of Excel ---');
    
    // Headers
    const headerRow = sheet.getRow(1);
    const headers = [];
    headerRow.eachCell((cell) => {
        headers.push(cell.value);
    });
    console.log('Headers:', headers);

    // First 5 data rows
    for (let i = 2; i <= 6; i++) {
        const row = sheet.getRow(i);
        const rowData = [];
        row.eachCell((cell) => {
            rowData.push(cell.value);
        });
        console.log(`Row ${i - 1}:`, JSON.stringify(rowData));
    }
}

debugExcelRows().catch(e => console.error(e));