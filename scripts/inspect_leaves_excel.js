import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

const FILE_NAME = 'رصيد الاجازات.xlsx';
const FILE_PATH = path.resolve(process.cwd(), FILE_NAME);

if (!fs.existsSync(FILE_PATH)) {
    console.error(`File not found: ${FILE_PATH}`);
    process.exit(1);
}

async function inspectLeavesExcel() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(FILE_PATH);
    
    const sheet = workbook.worksheets[0];
    
    // Get headers (first row with data)
    const headerRow = sheet.getRow(1);
    const headers = [];
    headerRow.eachCell((cell) => {
        headers.push(cell.value);
    });

    if (headers.length === 0) {
        console.error('File is empty');
        process.exit(1);
    }

    console.log(`✅ Found ${headers.length} columns in "${FILE_NAME}":`);
    console.log('--- Headers ---');
    headers.forEach((h, i) => console.log(`[Col ${i}] ${h}`));

    console.log('\n--- First 3 Data Rows Preview ---');
    for (let i = 2; i <= 4; i++) {
        const row = sheet.getRow(i);
        const rowData = [];
        row.eachCell((cell) => {
            rowData.push(cell.value);
        });
        console.log(`Row ${i - 1}:`, JSON.stringify(rowData));
    }
}

inspectLeavesExcel().catch(e => console.error(e));