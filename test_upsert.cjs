const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const payload = {
    type: 'poll_link_training',
    content: 'https://test.com',
    title: 'test title',
    is_active: true,
    updated_at: new Date().toISOString()
  };
  
  console.log("Upserting...");
  const { data, error } = await supabase
    .from('media_content')
    .upsert(payload, { onConflict: 'type' })
    .select();
    
  console.log("Error:", error);
  console.log("Data:", data);
}

test();
