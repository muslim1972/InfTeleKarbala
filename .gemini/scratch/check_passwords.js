
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPasswords() {
  const { data, error } = await supabase.from('profiles').select('id, username, password, password_hash').limit(5);
  if (error) console.error(error);
  else {
    console.log("Sample Profile Passwords:");
    data.forEach(p => {
      console.log(`- User: ${p.username}, Plain: ${p.password ? '[EXISTS]' : '[NONE]'}, Hash: ${p.password_hash ? '[EXISTS]' : '[NONE]'}`);
    });
  }
}

checkPasswords();
