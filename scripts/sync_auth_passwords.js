
import { supabase } from './utils/db.js';

async function syncPasswords() {
    console.log('🚀 Syncing Auth Passwords from Profiles...');

    // 1. Fetch ALL profiles (remove filter to debug)
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, job_number, password, username');

    if (error) {
        console.error('Error fetching profiles:', error);
        return;
    }

    console.log(`📋 Found ${profiles.length} total profiles.`);

    // Check first 3 profiles
    console.log('--- Sample Profiles ---');
    profiles.slice(0, 3).forEach(p => console.log(p));

    // Filter locally
    const validProfiles = profiles.filter(p => p.password && String(p.password).trim() !== '');
    console.log(`📋 Profiles with valid password: ${validProfiles.length}`);

    let updated = 0;
    let failed = 0;

    for (const p of validProfiles) {
        if (!p.password) continue;

        // Update Auth User
        const { error: updateErr } = await supabase.auth.admin.updateUserById(
            p.id,
            { password: String(p.password) }
        );

        if (updateErr) {
            console.error(`❌ Failed ${p.job_number}: ${updateErr.message}`);
            failed++;
        } else {
            updated++;
            if (updated % 20 === 0) process.stdout.write('.');
        }
    }

    console.log(`\n✅ Sync Finished.`);
    console.log(`Updated: ${updated}`);
    console.log(`Failed: ${failed}`);
}

syncPasswords().catch(console.error);
