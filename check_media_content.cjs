const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.rpc('get_schema_info'); // probably doesn't exist
  if (error) {
    const { data: d2, error: e2 } = await supabase.from('media_content').select('*').limit(1);
    console.log("Error:", e2);
    console.log("Data:", d2);
  }
}
check();
