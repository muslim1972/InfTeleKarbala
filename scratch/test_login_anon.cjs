const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLoginAnon() {
    const username = 'تجريبي 1';
    const password = '123135';

    console.log(`Testing get_login_profile with ANON KEY for user: ${username}`);
    const { data: profile, error: profileErr } = await supabase
        .rpc('get_login_profile', { p_username: username });

    if (profileErr) {
        console.error("Error calling get_login_profile (ANON):", profileErr);
    } else {
        console.log("get_login_profile result (ANON):", profile);
        if (profile) {
            const userProfile = Array.isArray(profile) ? profile[0] : profile;
            if (userProfile) {
                console.log("Password match check:", userProfile.password === password ? "MATCH" : "MISMATCH");
                console.log(`Stored password: '${userProfile.password}', Provided password: '${password}'`);
            } else {
                 console.log("No profile found.");
            }
        } else {
            console.log("No profile found.");
        }
    }
}

testLoginAnon();
