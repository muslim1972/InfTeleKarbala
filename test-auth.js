import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function run() {
    console.log('--- تفحص قاعدة البيانات لمستخدمي نظام Auth ---');

    // 1. Fetch latest user from profiles
    const { data: profiles, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);

    if (profileErr) {
        console.error('Error fetching profiles:', profileErr);
        return;
    }

    if (!profiles || profiles.length === 0) {
        console.log('لا يوجد مستخدمين في جدول profiles');
        return;
    }

    const lastProfile = profiles[0];
    console.log(`\n1. آخر مستخدم تم إضافته في جدول profiles:`);
    console.log(`- ID: ${lastProfile.id}`);
    console.log(`- Username: ${lastProfile.username}`);
    console.log(`- Job Number: ${lastProfile.job_number}`);

    // 2. Fetch from auth.users using admin API
    console.log('\n2. تفحص بيانات المستخدم في نظام المصادقة (auth.users):');
    const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(lastProfile.id);

    if (authErr) {
        console.error('❌ خطأ في العثور على المستخدم في auth.users:', authErr.message);
    } else {
        console.log('✅ المستخدم موجود في auth.users:');
        console.log(JSON.stringify(authUser.user, null, 2));

        // Check identities
        console.log('\n3. هويات تسجيل الدخول (Identities) المرتبطة بالمستخدم:');
        if (authUser.user.identities && authUser.user.identities.length > 0) {
            console.log(JSON.stringify(authUser.user.identities, null, 2));
        } else {
            console.log('❌ لا يوجد هويات تسجيل دخول مرتبطة بهذا المستخدم.');
        }
    }

    // 3. Try to fetch directly from raw tables if possible (requires executing RPC or direct DB access, but service role key allows admin access to users)
}

run().catch(console.error);
