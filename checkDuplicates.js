import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load env
const envFile = fs.readFileSync(path.resolve('.env.local'), 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=([^\r\n]+)/)?.[1]?.replace(/['"]/g, '').trim();
// Use anon key for profiles since it should be public enough to check names
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=([^\r\n]+)/)?.[1]?.replace(/['"]/g, '').trim();

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicates() {
  console.log("جاري فحص الحسابات المكررة في قاعدة البيانات...\n");
  
  // Fetch all profiles to find duplicates
  const { data, error } = await supabase.from('profiles').select('id, full_name, job_number');
  
  if (error) {
    console.error("خطأ في جلب البيانات:", error);
    return;
  }
  
  const nameCounts = {};
  data.forEach(p => {
    if (!p.full_name) return;
    const name = p.full_name.trim();
    if (!nameCounts[name]) nameCounts[name] = [];
    nameCounts[name].push({ id: p.id, job_number: p.job_number });
  });
  
  let found = false;
  for (const [name, accounts] of Object.entries(nameCounts)) {
    if (accounts.length > 1) {
      found = true;
      console.log(`الاسم: "${name}" متكرر ${accounts.length} مرات.`);
      accounts.forEach((acc, i) => {
        console.log(`   حساب ${i+1}: ID=${acc.id}, الرقم الوظيفي=${acc.job_number === null ? 'فارغ (null)' : acc.job_number}`);
      });
      console.log('-----------------------------------');
    }
  }
  
  if (!found) {
    console.log("لم يتم العثور على أي أسماء مكررة!");
  }
}

checkDuplicates();
