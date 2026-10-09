import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, job_number, governorate')
        .ilike('full_name', '%حسين حاتم%');
    console.log("Results:", data);
    console.log("Error:", error);
}

check();
