import ExcelJS from 'exceljs';
import path from 'path';

const FILE_NAME = 'تفاصيل الراتب شهر 1 - 2026.xlsx';
const ROW_INDEX = 304; // 0-based index for Row 305

async function inspectHashimExcelRow() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path.resolve(process.cwd(), FILE_NAME));
    
    const sheet = workbook.worksheets[0];
    const row = sheet.getRow(ROW_INDEX + 1); // ExcelJS uses 1-based indexing
    
    const rowData = [];
    row.eachCell((cell) => {
        rowData.push(cell.value);
    });

    console.log(`--- Inspecting Row ${ROW_INDEX + 1} (Hashim) ---`);
    console.log('Raw Row:', JSON.stringify(rowData));

    // Check index 2 (Card Number Column)
    const cardVal = rowData[2];
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
}

inspectHashimExcelRow().catch(e => console.error(e));