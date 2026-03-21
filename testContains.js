import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envFile = fs.readFileSync(path.resolve('.env.local'), 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=([^\r\n]+)/)?.[1]?.replace(/['"]/g, '').trim();
const serviceKey = envFile.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/)?.[1]?.replace(/['"]/g, '').trim();

if (!supabaseUrl || !serviceKey) {
  console.error("Missing Service Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function check() {
  console.log("Checking conversations table...");
  const { data: schemaData } = await supabase.rpc('db_info_query'); // if exists
  
  // Let's just grab the first conversation
  const { data: cData, error: cError } = await supabase.from('conversations').select('*').limit(1);
  if (cError) {
     console.error("Error:", cError);
     return;
  }
  
  if (!cData || cData.length === 0) {
      console.log("No conversations exist.");
      return;
  }
  
  const conv = cData[0];
  console.log("\nSample conversation:", conv);
  
  const participants = conv.participants;
  console.log("Participants:", participants);
  console.log("Type of participants:", Array.isArray(participants) ? "Array" : typeof participants);
  
  if (Array.isArray(participants) && participants.length > 0) {
      const testUserId = participants[0];
      
      console.log(`\nTesting contains query for user ${testUserId}...`);
      
      // Test 1: JSON.stringify (what the code currently does)
      const { data: t1 } = await supabase.from('conversations').select('id').contains('participants', JSON.stringify([testUserId]));
      console.log("JSON.stringify result count:", t1?.length);
      
      // Test 2: Raw Array (what it should be if it's a PG array)
      const { data: t2 } = await supabase.from('conversations').select('id').contains('participants', [testUserId]);
      console.log("Raw Array result count:", t2?.length);
  }
}

check();
