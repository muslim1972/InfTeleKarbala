
import { supabase } from './utils/db.js';

const TARGET_JOB_NUMBER = '266772'; // Ali Abbas (from user logs)
const NEW_ROLE = 'admin';

async function debugUpdate() {
    console.log(`🔍 Attempting to update role for Job Number: ${TARGET_JOB_NUMBER}`);

    // 1. Get User ID
    const { data: user, error: fetchError } = await supabase
        .from('profiles')
        .select('id, role, full_name')
        .eq('job_number', TARGET_JOB_NUMBER)
        .single();

    if (fetchError || !user) {
        console.error('❌ User not found:', fetchError);
        return;
    }

    console.log(`👤 Found User: ${user.full_name} (${user.id})`);
    console.log(`   Current Role: ${user.role}`);

    // 2. Attempt Update
    const { data, error, count } = await supabase
        .from('profiles')
        .update({ role: NEW_ROLE })
        .eq('id', user.id)
        .select(); // vital to see if row is returned

    if (error) {
        console.error('❌ Update Failed:', error);
    } else if (data.length === 0) {
        console.error('⚠️ Update returned NO data. This usually means RLS blocked the update silently.');
    } else {
        console.log('✅ Update Successful!');
        console.log('   New Data:', data[0]);
    }
}

debugUpdate();
