const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkMediaContent() {
    console.log("Checking media_content with anon key...");
    const { data, error } = await supabase.from('media_content').select('*');
    if (error) {
        console.error("Error:", error.message);
    } else {
        console.log("Data length:", data.length);
        console.log(data);
    }
}

checkMediaContent();
