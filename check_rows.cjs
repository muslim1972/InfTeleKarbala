const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase
    .from('media_content')
    .select('*')
    .eq('type', 'poll_link_training');
    
  console.log("Error:", error);
  console.log("Data:", data);
}

check();
