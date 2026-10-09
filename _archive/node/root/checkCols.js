import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envFile = fs.readFileSync(path.resolve('.env.local'), 'utf-8');
// Clean up \r and quotes
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=([^\r\n]+)/)?.[1]?.replace(/['"]/g, '').trim();
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=([^\r\n]+)/)?.[1]?.replace(/['"]/g, '').trim();

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing URL or Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking profiles table...");
  const { data: pData, error: pError } = await supabase.from('profiles').select('*').limit(1);
  if (pError) console.error("Profile Error:", pError);
  else console.log("Profile Columns:", Object.keys(pData[0] || {}));

  console.log("\nChecking conversations table...");
  const { data: cData, error: cError } = await supabase.from('conversations').select('*').limit(1);
  if (cError) console.error("Conv Error:", cError);
  else {
    console.log("Conv Columns:", Object.keys(cData[0] || {}));
    if (cData[0]) {
       console.log("Participants type:", Array.isArray(cData[0].participants) ? "Array" : typeof cData[0].participants);
       console.log("Participants value example:", JSON.stringify(cData[0].participants));
    }
  }
}

check();
