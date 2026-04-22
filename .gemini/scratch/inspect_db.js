
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectTable(tableName) {
  console.log(`\n--- Inspecting Table: ${tableName} ---`);
  
  try {
    const { data: schemaData, error: schemaError } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
      
    if (schemaError) {
      console.error(`Error accessing table ${tableName}:`, schemaError);
    } else {
      console.log(`Columns found in ${tableName} (via keys):`, schemaData && schemaData.length > 0 ? Object.keys(schemaData[0]) : 'Table is empty or no columns accessible');
    }
  } catch (err) {
    console.error(`Unexpected error inspecting ${tableName}:`, err);
  }
}

async function run() {
  await inspectTable('hr_audio_calls');
  await inspectTable('profiles');
  
  // Check if chat_invites exists (used in ShamilApp)
  const { error: inviteError } = await supabase.from('chat_invites').select('id').limit(1);
  console.log('\nDoes chat_invites exist?', !inviteError);
  
  // Check if shamil_audio_calls exists
  const { error: shamilError } = await supabase.from('shamil_audio_calls').select('id').limit(1);
  console.log('Does shamil_audio_calls exist?', !shamilError);
}

run();
