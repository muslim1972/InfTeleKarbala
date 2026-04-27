import { supabase } from './utils/db.js';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { normalizeArabic } from './utils/normalization.js';

const FILE_NAME = 'رصيد الاجازات.xlsx';
const SHEET_NAME = 'لجان + شكر'; // Sheet 2 has the balance

const normalizeName = normalizeArabic; // Use the advanced helper

// Fuzzy match: check if dbName starts with excelName (assuming excel name is shorter/subset)
// Also specific check for "First Second Third" matching "First Second Third Fourth"
const isMatch = (excelNameNorm, dbNameNorm) => {
    if (dbNameNorm === excelNameNorm) return true;
    if (dbNameNorm.startsWith(excelNameNorm)) return true;
    return false;
};

async function importPhase3() {
    console.log('🚀 Phase 3: Importing Leave Balances (Smart Fuzzy Matching)...');

    const filePath = path.resolve(process.cwd(), FILE_NAME);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        process.exit(1);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.getWorksheet(SHEET_NAME);

    if (!sheet) {
        console.error(`❌ Sheet "${SHEET_NAME}" not found.`);
        process.exit(1);
    }

    // 1. Fetch Profiles
    console.log('🔄 Fetching profiles...');
    const { data: profiles, error } = await supabase.from('profiles').select('id, full_name');
    if (error) { console.error(error); process.exit(1); }

    // Prepare normalized DB names
    // Structure: [{ id, normName, fullName }]
    const dbUsers = profiles
        .filter(p => p.full_name)
        .map(p => ({
            id: p.id,
            normName: normalizeName(p.full_name),
            fullName: p.full_name
        }));

    console.log(`📊 Loaded ${dbUsers.length} profiles for matching.`);

    let updated = 0;
    let notFound = 0;
    const notFoundList = [];

    // Identify columns from header row
    const headerRow = sheet.getRow(1);
    const headers = [];
    headerRow.eachCell((cell) => {
        headers.push(String(cell.value).trim());
    });

    const balanceIdx = headers.findIndex(h => h.includes('رصيد'));
    const nameIdx = headers.findIndex(h => h.includes('اسم'));

    if (balanceIdx === -1 || nameIdx === -1) {
        console.error('❌ Columns not identified.');
        process.exit(1);
    }

    // Process Rows
    sheet.eachRow(async (row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        const rowValues = [];
        row.eachCell((cell) => {
            rowValues.push(cell.value);
        });

        if (!rowValues || !rowValues[nameIdx]) return;

        const excelNameRaw = rowValues[nameIdx];
        const excelNameNorm = normalizeName(excelNameRaw);
        const balance = parseInt(rowValues[balanceIdx]) || 0;

        // Find ALL matches
        const matches = dbUsers.filter(u => isMatch(excelNameNorm, u.normName));

        if (matches.length === 1) {
            const match = matches[0];
            // DB Update Logic
            const { data: existing, error: fetchErr } = await supabase
                .from('administrative_summary')
                .select('id')
                .eq('user_id', match.id)
                .maybeSingle();

            if (fetchErr) {
                console.error(`Error checking user ${match.id}:`, fetchErr.message);
                return;
            }

            const payload = {
                user_id: match.id,
                remaining_leave_balance: balance,
                updated_at: new Date()
            };

            let opError;
            if (existing) {
                const { error: upErr } = await supabase
                    .from('administrative_summary')
                    .update(payload)
                    .eq('id', existing.id);
                opError = upErr;
            } else {
                const { error: insErr } = await supabase
                    .from('administrative_summary')
                    .insert(payload);
                opError = insErr;
            }

            if (opError) {
                console.error(`❌ DB Error for ${match.fullName}:`, opError.message);
            } else {
                updated++;
            }
            if (updated % 10 === 0) process.stdout.write('.');

        } else if (matches.length > 1) {
            // Ambiguous
            notFound++;
            console.warn(`\n⚠️ Ambiguous: "${excelNameRaw}" matches ${matches.length} users:`);
            matches.forEach(m => console.warn(`   - ${m.fullName}`));
        } else {
            // Not Found
            notFound++;
            notFoundList.push(excelNameRaw);
            process.stdout.write('x');
        }
    });

    // Wait for all operations to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log(`\n\n✅ Finished Phase 3.`);
    console.log(`Matched & Updated: ${updated}`);
    console.log(`Failed (Not Found/Ambiguous): ${notFound}`);

    if (notFoundList.length > 0) {
        console.log('\n⚠️ Sample Names Not Found in DB:');
        console.log(notFoundList.slice(0, 10).join('\n'));
    }
}

importPhase3().catch(e => console.error(e));