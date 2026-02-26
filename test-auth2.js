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
    console.log('--- إنشاء مستخدم اختباري عبر Supabase API لمقارنة البيانات ---');

    // Create user via Admin API
    const { data, error } = await supabase.auth.admin.createUser({
        email: `test_auth_admin_${Date.now()}@inftele.com`,
        password: 'password123',
        email_confirm: true
    });

    if (error) {
        console.error('Error creating user natively:', error);
        return;
    }

    console.log('✅ تم إنشاء مستخدم بنجاح عبر API:');
    console.log(JSON.stringify(data.user, null, 2));

    // Now create an RPC to fetch raw auth.users data for this user AND the failing user
    // Since we can't create RPC directly from client easily, we can just look at the native user's identities.

    console.log('\n✅ هويات تسجيل الدخول الأساسية (Native Identities):');
    console.log(JSON.stringify(data.user.identities, null, 2));

    // Cleanup test user
    await supabase.auth.admin.deleteUser(data.user.id);
    console.log('Test user deleted.');
}

run().catch(console.error);
