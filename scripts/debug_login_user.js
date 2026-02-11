
import { supabase } from './utils/db.js';

const TARGET_ID = '6848fc09-305d-4831-aa1c-3a18ccbba7d1'; // ID provided by user
const TARGET_NAME = 'كرار علي حسين';

async function debugUser() {
    console.log(`🔍 Debugging User: ${TARGET_NAME} (${TARGET_ID})`);

    // 1. Fetch Profile Data
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .or(`id.eq.${TARGET_ID},full_name.eq.${TARGET_NAME}`);

    if (profileError) {
        console.error('❌ Profile Fetch Error:', profileError);
        return;
    }

    if (!profile || profile.length === 0) {
        console.error('❌ Profile not found!');
        return;
    }

    const user = profile[0];
    console.log('--- Profile Data ---');
    console.log(`ID: ${user.id}`);
    console.log(`Full Name: ${user.full_name}`);
    console.log(`Username: ${user.username}`);
    console.log(`Password (in DB): ${user.password}`);
    console.log(`Job Number: ${user.job_number}`);
    console.log(`Role: ${user.role}`);
    console.log('--------------------');

    if (!user.job_number) {
        console.error('❌ Critical: Job Number is MISSING in profile. Cannot construct email for Auth.');
        return;
    }

    const expectedEmail = `${user.job_number}@inftele.com`;
    console.log(`📧 Expected Auth Email: ${expectedEmail}`);

    // 2. Check Auth User Existence
    // Note: auth.admin requires service_role key
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
        console.error('❌ Auth List Error:', authError);
        return;
    }

    const authUser = users.find(u => u.email === expectedEmail || u.id === user.id);

    if (authUser) {
        console.log('✅ Auth User FOUND:');
        console.log(`   Auth ID: ${authUser.id}`);
        console.log(`   Email: ${authUser.email}`);
        console.log(`   Match Profile ID? ${authUser.id === user.id ? 'YES' : 'NO'}`);
    } else {
        console.error(`❌ Auth User NOT found for email: ${expectedEmail}`);
        console.log('   (Did we create Auth users for all profiles in Phase 1?)');
    }
}

debugUser().catch(console.error);
