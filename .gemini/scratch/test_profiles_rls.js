
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const username = 'تجريبي 1';
  console.log(`Testing direct SELECT from profiles with ANON KEY for: [${username}]`);
  
  const { data, error } = await supabase
    .from('profiles')
    .select('username, job_number')
    .eq('username', username)
    .maybeSingle();

  if (error) {
    console.error("Select Error:", error);
  } else {
    console.log("Select Result:", data);
  }
}

test();
