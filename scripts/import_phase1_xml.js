
import { supabase } from './utils/db.js';
import fs from 'fs';
import iconv from 'iconv-lite';
import { parseString } from 'xml2js';

const XML_FILE = 'rwservlet.xml';

async function importPhase1() {
    console.log('🚀 Phase 1 (Updated): Importing Employees with Card Number...');

    if (!fs.existsSync(XML_FILE)) {
        console.error(`❌ File not found: ${XML_FILE}`);
        process.exit(1);
    }

    const buffer = fs.readFileSync(XML_FILE);
    const decoded = iconv.decode(buffer, 'win1256');

    let employees = [];

    await new Promise((resolve) => {
        parseString(decoded, (err, result) => {
            if (err) { console.error('XML Error:', err); resolve(); return; }
            try {
                const root = result.REP210;
                if (root?.LIST_G_SAL_ID?.[0]?.G_SAL_ID) {
                    employees = root.LIST_G_SAL_ID[0].G_SAL_ID;
                }
            } catch (e) { console.error('Structure Error:', e); }
            resolve();
        });
    });

    if (employees.length === 0) return;

    console.log(`✅ Found ${employees.length} records.`);

    // Fetch users AND profiles to check if we just need to update profiles
    console.log('🔄 Fetching existing profiles to map by Job Number...');
    const { data: existingProfiles } = await supabase.from('profiles').select('job_number, id');

    let jobToId = new Map();
    if (existingProfiles) {
        existingProfiles.forEach(p => jobToId.set(String(p.job_number), p.id));
    }

    // Also fetch auth users for creation
    const { data: { users: allUsers } } = await supabase.auth.admin.listUsers({ perPage: 10000 });
    const emailToId = new Map();
    allUsers.forEach(u => emailToId.set(u.email.toLowerCase(), u.id));

    let profilesToUpsert = [];

    console.log('🛠 Processing records...');

    for (const item of employees) {
        const getVal = (k) => (item[k] && item[k][0]) ? String(item[k][0]).trim() : null;

        const jobNumber = getVal('SAL_ID');
        const fullName = getVal('SAL_NAME');
        const cardNum = getVal('CARD'); // NEW: Capture Card Number

        if (!jobNumber) continue;

        let userId = jobToId.get(jobNumber);

        // If not in profiles, check auth
        if (!userId) {
            const email = `${jobNumber}@inftele.com`.toLowerCase();
            userId = emailToId.get(email);

            if (!userId) {
                // Create User
                const { data, error } = await supabase.auth.admin.createUser({
                    email: email,
                    password: `Pass${jobNumber}`,
                    email_confirm: true,
                    user_metadata: { full_name: fullName, job_number: jobNumber }
                });
                if (error) {
                    console.error(`Error creating user ${jobNumber}: ${error.message}`);
                    continue;
                }
                userId = data.user.id;
            }
        }

        profilesToUpsert.push({
            id: userId,
            job_number: jobNumber,
            full_name: fullName || `Employee ${jobNumber}`,
            card_number: cardNum, // NEW: Save Card Number
            updated_at: new Date()
        });
    }

    if (profilesToUpsert.length > 0) {
        console.log(`💾 Updating ${profilesToUpsert.length} profiles (adding card numbers)...`);
        const { error } = await supabase.from('profiles').upsert(profilesToUpsert, {
            onConflict: 'job_number',
            ignoreDuplicates: false
        });

        if (error) console.error('❌ Profile Upsert Error:', error);
        else console.log('✅ Profiles updated successfully.');
    }
}

importPhase1().catch(e => console.error(e));
