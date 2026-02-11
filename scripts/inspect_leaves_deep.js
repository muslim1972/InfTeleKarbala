
import XLSX from 'xlsx';
import path from 'path';

const FILE_NAME = 'رصيد الاجازات.xlsx';
const workbook = XLSX.readFile(path.resolve(process.cwd(), FILE_NAME));

console.log('--- Sheets ---');
console.log(workbook.SheetNames);

const sheet = workbook.Sheets[workbook.SheetNames[0]];

console.log('\n--- Range ---');
console.log(sheet['!ref']);

const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('\n--- First 5 Rows (Raw) ---');
for (let i = 0; i < 5 && i < rows.length; i++) {
    console.log(`Row ${i}:`, JSON.stringify(rows[i]));
}

// Check for any column that looks like a leave balance (numbers > 5 or labeled)
console.log('\n--- Searching for Leave Balance Candidates ---');
// We assume leave balance is a number, likely > 0.
// Let's check non-empty columns in row 1-10
const colStats = {};
for (let i = 1; i < Math.min(rows.length, 50); i++) {
    const row = rows[i];
    row.forEach((val, colIdx) => {
        if (val !== undefined && val !== null && val !== '') {
            if (!colStats[colIdx]) colStats[colIdx] = { count: 0, examples: [] };
            colStats[colIdx].count++;
            if (colStats[colIdx].examples.length < 3) colStats[colIdx].examples.push(val);
        }
    });
}
console.log(colStats);
