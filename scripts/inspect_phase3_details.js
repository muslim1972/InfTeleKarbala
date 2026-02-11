
import { supabase } from './utils/db.js';
import XLSX from 'xlsx';
import path from 'path';

async function inspect() {
    console.log('🔍 Inspecting Administrative Schema & Excel Data...');

    // 1. Check DB Schema
    const { data, error } = await supabase.from('administrative_summary').select('*').limit(1);
    if (error) console.error('DB Error:', error.message);
    else if (data.length > 0) console.log('✅ DB Columns:', Object.keys(data[0]).join(', '));
    else console.log('⚠️ administrative_summary is empty, cannot infer columns.');

    // 2. Check Excel Col 2
    const workbook = XLSX.readFile(path.resolve(process.cwd(), 'رصيد الاجازات.xlsx'));
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log(`\n📊 Checking ${rows.length} rows for data in Column 2 (Index 2)...`);
    let foundData = 0;
    for (let i = 1; i < rows.length; i++) {
        if (rows[i][2] !== undefined && rows[i][2] !== null) {
            console.log(`Row ${i}: Val="${rows[i][2]}"`);
            foundData++;
            if (foundData >= 5) break;
        }
    }
    if (foundData === 0) console.log('❌ Column 2 seems completely empty.');
}

inspect();
