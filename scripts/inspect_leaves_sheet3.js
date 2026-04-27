import ExcelJS from 'exceljs';
import path from 'path';

const FILE_NAME = 'رصيد الاجازات.xlsx';

async function inspectLeavesSheet3() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path.resolve(process.cwd(), FILE_NAME));

    // Target Sheet: 'ورقة3' (Index 2)
    const sheetName = 'ورقة3';
    const sheet = workbook.getWorksheet(sheetName);

    if (!sheet) {
        console.error(`Sheet "${sheetName}" not found.`);
        process.exit(1);
    }

    console.log(`--- Inspecting Sheet: ${sheetName} ---`);
    
    const headerRow = sheet.getRow(1);
    const headers = [];
    headerRow.eachCell((cell) => {
        headers.push(cell.value);
    });
    console.log('Headers:', headers);

    console.log('\n--- First 5 Data Rows ---');
    for (let i = 2; i <= 6; i++) {
        const row = sheet.getRow(i);
        const rowData = [];
        row.eachCell((cell) => {
            rowData.push(cell.value);
        });
        console.log(`Row ${i - 1}:`, JSON.stringify(rowData));
    }
}

inspectLeavesSheet3().catch(e => console.error(e));