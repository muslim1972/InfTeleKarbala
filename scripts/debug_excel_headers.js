
import XLSX from 'xlsx';
import path from 'path';

const FILE_NAME = 'تفاصيل الراتب شهر 1 - 2026.xlsx';

function checkHeaders() {
    const filePath = path.resolve(process.cwd(), FILE_NAME);
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const headers = rows[0];
    console.log('--- Excel Headers ---');
    headers.forEach((h, i) => {
        console.log(`Index ${i}: ${h}`);
    });
}

checkHeaders();
