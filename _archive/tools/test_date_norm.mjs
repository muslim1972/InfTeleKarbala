import ExcelJS from 'exceljs';

function normalizeDateValue(val) {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val.getTime())) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    const str = String(val).trim();
    if (!str || str === 'لايوجد' || str === 'بدون' || str === '-' || str === '0') return null;

    const parts = str.split(/[\/\-\.]/);
    if (parts.length === 3) {
        let [dStr, mStr, yStr] = parts;
        if (dStr.length === 4) {
            const temp = dStr;
            dStr = yStr;
            yStr = temp;
        }
        let day = parseInt(dStr, 10);
        let month = parseInt(mStr, 10);
        let year = parseInt(yStr, 10);

        if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

        if (year < 100) {
            const current2DigitYear = new Date().getFullYear() % 100;
            if (year <= current2DigitYear) {
                year = 2000 + year;
            } else {
                year = 1900 + year;
            }
        }

        const mm = String(month).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        return `${year}-${mm}-${dd}`;
    }
    return null;
}

async function testAll() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile('F:/صور للتجربة/نظام المديرية/excel/بيانات المنتسبين شهر ت1 - 2026.xlsx');
    const ws = wb.worksheets[0];
    let invalidCount = 0;
    for (let r = 2; r <= ws.rowCount; r++) {
        const raw = ws.getRow(r).getCell(8).value;
        const norm = normalizeDateValue(raw);
        if (!norm) {
            console.log('Row ' + r + ' failed: ' + raw);
            invalidCount++;
        }
    }
    console.log('Testing completed. Total failed:', invalidCount);
    for (let r = 2; r <= 8; r++) {
        console.log(ws.getRow(r).getCell(8).value + ' -> ' + normalizeDateValue(ws.getRow(r).getCell(8).value));
    }
}
testAll();
