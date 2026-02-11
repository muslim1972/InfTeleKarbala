
import fs from 'fs';
import * as xlsx from 'xlsx';
import iconv from 'iconv-lite';
import { parseString } from 'xml2js';

const files = [
    { name: 'رصيد الاجازات.xlsx', type: 'excel' },
    { name: 'تفاصيل الراتب شهر 1 - 2026.xlsx', type: 'excel' },
    { name: 'تسلسلات الزوجية 2026.xlsx', type: 'excel' },
    { name: 'rwservlet.xml', type: 'xml' }
];

async function inspectFiles() {
    for (const file of files) {
        console.log(`\n--- Inspecting ${file.name} ---`);
        const path = `./${file.name}`;
        
        if (!fs.existsSync(path)) {
            console.log(`File not found: ${path}`);
            continue;
        }

        try {
            if (file.type === 'excel') {
                const workbook = xlsx.readFile(path);
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                // Get range
                const range = xlsx.utils.decode_range(sheet['!ref']);
                // Generate headers
                const headers = [];
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const address = xlsx.utils.encode_cell({ r: range.s.r, c: C });
                    const cell = sheet[address];
                    if (cell && cell.v) headers.push(cell.v);
                }
                console.log('Headers:', headers);
                
                // Print first row of data
                const firstRow = [];
                 for (let C = range.s.c; C <= range.e.c; ++C) {
                    const address = xlsx.utils.encode_cell({ r: range.s.r + 1, c: C });
                    const cell = sheet[address];
                     if (cell) firstRow.push(cell.v); else firstRow.push(null);
                }
                console.log('First Data Row:', firstRow);

            } else if (file.type === 'xml') {
                const buffer = fs.readFileSync(path);
                const decoded = iconv.decode(buffer, 'win1256');
                console.log('XML Snippet (first 500 chars):');
                console.log(decoded.substring(0, 500));
                
                // Try parsing specific structure if known, or just dump first level keys
                 parseString(decoded, (err, result) => {
                    if (err) {
                        console.log('Error parsing XML:', err.message);
                    } else {
                         console.log('XML Root Keys:', Object.keys(result));
                         // inspect deeper if possible
                         const rootKey = Object.keys(result)[0];
                         if (result[rootKey]) {
                             console.log('Second Level Keys:', Object.keys(result[rootKey]));
                         }
                    }
                });
            }
        } catch (err) {
            console.error(`Error processing ${file.name}:`, err.message);
        }
    }
}

inspectFiles();
