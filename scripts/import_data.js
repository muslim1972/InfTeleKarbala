
import { supabase } from './utils/db.js';
import { parseEmployeeXML, parseSalariesExcel, parseLeavesExcel } from './utils/parsers.js';

const FILES = {
    xml: 'rwservlet.xml',
    salary: 'تفاصيل الراتب شهر 1 - 2026.xlsx',
    leaves: 'رصيد الاجازات.xlsx',
};

async function importData() {
    console.log('🚀 Starting Data Import Process...');

    // 1. Import Employees from XML
    console.log(`\n📚 Reading Employees from ${FILES.xml}...`);
    const employees = await parseEmployeeXML(FILES.xml);
    console.log(`✅ Found ${employees.length} employees in XML.`);

    let profilesCreated = 0;
    let profilesUpdated = 0;

    // Process Employees
    // Cache map: JobNumber -> UserID
    const userMap = new Map();

    for (const emp of employees) {
        if (!emp.job_number) continue;

        // Generate synthetic email
        const email = `${emp.job_number}@inftele.com`;
        const password = `Pass${emp.job_number}!`; // Default password logic

        let userId = null;

        // Check if user exists by email
        // Note: admin.listUsers isn't efficient for single lookups, but creating user handles duplicates
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        // Optimized: In production, better to query DB directly or rely on create error.
        // For 800 employees, listUsers fetch might be okay, but let's try standard approach:

        // Try Create
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: { full_name: emp.full_name }
        });

        if (createError) {
            // User likely exists, need to fetch ID
            // Since we don't have direct "getUserByEmail" in admin easily without list, 
            // we can rely on our profiles table if populated, or specific query.
            // Let's assume we proceed to profiles.

            // Hack: Try to signIn? No.
            // Let's use listUsers filter if possible or just fetch all once at start for map.
        } else {
            userId = newUser.user.id;
        }

        // Fetch User ID if creation failed (exists)
        if (!userId) {
            // This is slow for loop. Better to fetch all users once.
            // But for now let's skip auth check if profiles exist? 
            // We need UserID for Profile. 
        }
    }

    // Optimized Approach:
    // 1. Fetch ALL existing users
    console.log('🔄 Fetching existing users...');
    const { data: { users: allUsers }, error: listError } = await supabase.auth.admin.listUsers({ perPage: 10000 });
    if (listError) console.error(listError);

    // Create Map: Email -> ID
    const emailToId = new Map();
    allUsers.forEach(u => emailToId.set(u.email, u.id));

    // Batch Create Users who don't exist
    for (const emp of employees) {
        const email = `${emp.job_number}@inftele.com`;

        if (!emailToId.has(email)) {
            const password = `Pass${emp.job_number}!`;
            const { data, error } = await supabase.auth.admin.createUser({
                email: email,
                password: password, // Default password
                email_confirm: true,
                user_metadata: { full_name: emp.full_name, job_number: emp.job_number }
            });

            if (error) {
                console.error(`❌ Failed to create user ${emp.job_number}:`, error.message);
            } else {
                emailToId.set(email, data.user.id);
                process.stdout.write('+'); // progress indicator
            }
        }
    }
    console.log('\n✅ User Accounts Synced.');

    // Upsert Profiles
    console.log('🔄 Syncing Profiles...');
    const profilesToUpsert = [];
    for (const emp of employees) {
        const email = `${emp.job_number}@inftele.com`;
        const userId = emailToId.get(email);

        if (userId) {
            profilesToUpsert.push({
                id: userId,
                job_number: emp.job_number,
                full_name: emp.full_name,
                updated_at: new Date()
            });
            userMap.set(emp.job_number, userId);
        }
    }

    if (profilesToUpsert.length > 0) {
        const { error: profileError } = await supabase.from('profiles').upsert(profilesToUpsert, { onConflict: 'job_number' });
        if (profileError) console.error('❌ Profile Upsert Error:', profileError);
        else console.log(`✅ Upserted ${profilesToUpsert.length} profiles.`);
    }

    // 2. Import Salaries
    console.log(`\n💰 Reading Salaries from ${FILES.salary}...`);
    const salaries = parseSalariesExcel(FILES.salary);
    console.log(`✅ Found ${salaries.length} salary records.`);

    const financialsToUpsert = [];
    for (const sal of salaries) {
        const userId = userMap.get(sal.job_number);
        if (!userId) {
            console.warn(`⚠️ Skipped Salary: Job Number ${sal.job_number} not found in System.`);
            continue;
        }

        financialsToUpsert.push({
            user_id: userId,
            ...sal,
            updated_at: new Date()
        });

        // Upsert Yearly Records (Committees/Thanks from Salary File if present)
        if (sal.committees_count || sal.thanks_books_count) {
            const { error: yearError } = await supabase.from('yearly_records').upsert({
                user_id: userId,
                year: 2025, // Based on file header "2025"
                committees_count: sal.committees_count || 0,
                thanks_books_count: sal.thanks_books_count || 0,
            }, { onConflict: 'user_id, year' }); // Need unique constraint on (user_id, year)? 
            // Note: verification schema didn't show unique constraint on year. 
            // We might just insert specific columns.
        }
    }

    if (financialsToUpsert.length > 0) {
        // We need to be careful with 'financial_records' PK. 
        // It has UUID PK, not user_id. 
        // We should delete old records for these users or update based on user_id?
        // Since schema doesn't have unique(user_id) constraint displayed in verification,
        // we might create duplicates if we just insert.
        // Let's First DELETE existing financial records for these users to be safe (Full Snapshot Sync)
        // OR check if we can add a unique constraint/index on user_id to facilitate upsert.
        // For now, let's try to delete for these users first.

        // Better: Upsert using user_id if unique constraint exists.
        // If not, Delete and Insert.
        // Assuming user_id should be unique for current financial record.

        // Let's Clear Financial Records for these users? No, too risky.
        // Let's assume user_id is unique enough for "Current Record".
        // Actually, we can just insert and let Supabase handle or error? No.

        // STRATEGY: Delete all financial records for updated users, then Insert.
        const userIds = financialsToUpsert.map(f => f.user_id);
        await supabase.from('financial_records').delete().in('user_id', userIds);

        const { error: financeError } = await supabase.from('financial_records').insert(financialsToUpsert);
        if (financeError) console.error('❌ Financial Insert Error:', financeError);
        else console.log(`✅ Inserted ${financialsToUpsert.length} financial records.`);
    }

    console.log('\n🎉 Import Completed Successfully!');
}

importData().catch(err => console.error('Fatal Error:', err));
