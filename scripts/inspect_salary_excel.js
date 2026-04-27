import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

const FILE_NAME = 'تفاصيل الراتب شهر 1 - 2026.xlsx';
const FILE_PATH = path.resolve(process.cwd(), FILE_NAME);

if (!fs.existsSync(FILE_PATH)) {
    console.error(`File not found: ${FILE_PATH}`);
    process.exit(1);
}

async function inspectSalaryExcel() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(FILE_PATH);
    
    const sheet = workbook.worksheets[0];
    
    // Get headers (first row)
    const headers = [];
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
        if (cell.value) {
            headers.push({ col: colNumber - 1, text: String(cell.value).trim() });
        }
    });

    console.log(`✅ Found ${headers.length} columns in "${FILE_NAME}":`);
    console.log('--- Headers ---');
    headers.forEach(h => console.log(`[Col ${h.col}] ${h.text}`));

    // Preview first data row to confirm alignment
    console.log('\n--- First Data Row Preview ---');
    const dataRow = sheet.getRow(2);
    headers.forEach(h => {
        const cell = dataRow.getCell(h.col + 1);
        console.log(`${h.text}: ${cell.value || '(empty)'}`);
    });
}

inspectSalaryExcel().catch(e => console.error(e));