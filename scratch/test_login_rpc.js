const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogin() {
    const username = 'تجريبي 1';
    const password = '123135';

    console.log(`Testing get_login_profile for user: ${username}`);
    const { data: profile, error: profileErr } = await supabase
        .rpc('get_login_profile', { p_username: username });

    if (profileErr) {
        console.error("Error calling get_login_profile:", profileErr);
    } else {
        console.log("get_login_profile result:", profile);
        if (profile && profile.length > 0) {
            const userProfile = profile[0];
            console.log("Password match check:", userProfile.password === password ? "MATCH" : "MISMATCH");
            console.log(`Stored password: '${userProfile.password}', Provided password: '${password}'`);
        } else {
            console.log("No profile found.");
        }
    }
}

testLogin();
