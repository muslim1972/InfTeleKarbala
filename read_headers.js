const XLSX = require('xlsx');
const path = require('path');

try {
    const filePath = 'D:\\\\InfTeleKarbala\\\\تفاصيل الراتب شهر 2 - 2026.xlsx';
    const wb = XLSX.readFile(filePath);
    const wsName = wb.SheetNames[0];
    const ws = wb.Sheets[wsName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    console.log(JSON.stringify(data[0], null, 2));
} catch (error) {
    console.error(error);
}
