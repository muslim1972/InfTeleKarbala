import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('Checking profiles columns...');
    
    // Quick and dirty way to get columns using a single row
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error fetching profile:", error);
    } else if (data && data.length > 0) {
        console.log("Columns in profiles table:");
        console.log(Object.keys(data[0]).join(', '));
        console.log("\nSample Row Date:");
        console.log(data[0]);
    } else {
        console.log("No profiles found.");
    }
}

checkSchema();
