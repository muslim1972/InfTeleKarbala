
import { supabase } from './utils/db.js';
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const FILE_NAME = 'تفاصيل الراتب شهر 1 - 2026.xlsx';

async function importPhase4() {
    console.log('🚀 Phase 4: Importing Auth Data (Username, Password, Role)...');

    const filePath = path.resolve(process.cwd(), FILE_NAME);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        process.exit(1);
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Identify Columns
    const headers = rows[0];
    const usernameIdx = headers.findIndex(h => h && String(h).includes('اسم المستخدم'));
    const passwordIdx = headers.findIndex(h => h && String(h).includes('الرمز السري'));
    const ibanIdx = headers.findIndex(h => h && String(h).includes('IBAN'));

    console.log(`Column Mapping:
    - Username: ${usernameIdx}
    - Password: ${passwordIdx}
    - IBAN: ${ibanIdx}
    `);

    let updated = 0;
    let failed = 0;

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        // 1. extract card number (RELAXED LOGIC)
        let cardNum = null;

        // Strategy A: Check Index 2 first (High confidence from debugging)
        if (row[2] && /^\d{8,16}$/.test(String(row[2]).trim())) {
            cardNum = String(row[2]).trim();
        }

        // Strategy B: Scan all columns if Strategy A fails
        if (!cardNum) {
            for (const [key, val] of Object.entries(row)) {
                const vStr = String(val).trim();
                // Card is usually 9 or 16 digits. 
                // We REMOVED the startsWith('10'|'6') restriction to include cards like '11...'
                if (/^\d{8,16}$/.test(vStr)) {
                    cardNum = vStr;
                    break;
                }
            }
        }

        const username = row[usernameIdx];
        const password = row[passwordIdx];
        const iban = row[ibanIdx];

        if (!cardNum || !username) {
            // console.warn(`Skipping row ${i}: Missing CardNum or Username`);
            continue;
        }

        // Clean values
        const cleanCard = String(cardNum).trim();
        const cleanUser = String(username).trim();
        const cleanPass = password ? String(password).trim() : null;
        const cleanIban = iban ? String(iban).trim() : null;

        // Update Profile by CARD NUMBER
        const { error } = await supabase
            .from('profiles')
            .update({
                username: cleanUser,
                password: cleanPass,
                role: 'user', // Default role
                iban: cleanIban, // Update IBAN here too as requested
                updated_at: new Date()
            })
            .eq('card_number', cleanCard);

        if (error) {
            console.error(`❌ Error updating Card ${cleanCard} (${cleanUser}):`, error.message);
            failed++;
        } else {
            updated++;
            if (updated % 20 === 0) process.stdout.write('.');
        }
    }

    console.log(`\n✅ Auth Import Finished.`);
    console.log(`Updated Profiles: ${updated}`);
    console.log(`Failed: ${failed}`);
}

importPhase4().catch(e => console.error(e));
