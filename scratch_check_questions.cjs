const xlsx = require('xlsx');

const FILE_PATH = './اسئلة الكراس 2026.xlsx';
const workbook = xlsx.readFile(FILE_PATH);
console.log("Sheets found:", workbook.SheetNames);

for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const data = xlsx.utils.sheet_to_json(sheet);
    console.log(`Sheet "${name}" has ${data.length} rows.`);
}
