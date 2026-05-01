
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function test() {
  const jobNumber = 'c345678';
  console.log(`Testing get_login_profile with p_username set to JOB NUMBER: [${jobNumber}]`);
  
  const { data, error } = await supabase
    .rpc('get_login_profile', { p_username: jobNumber });

  if (error) {
    console.error("RPC Error:", error);
  } else {
    console.log("RPC Result (by Job Number):", JSON.stringify(data, null, 2));
  }
}

test();
