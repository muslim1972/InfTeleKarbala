
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectTable(tableName) {
  console.log(`\n--- Inspecting Table: ${tableName} ---`);
  
  try {
    // Try to get one row to see column names
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
      
    if (error) {
      console.error(`Error accessing table ${tableName}:`, error.message);
      
      // If error is about columns, let's try to query information_schema if possible via RPC or just try common names
      console.log('Trying to list columns via RPC if available or common names...');
    } else {
      if (data && data.length > 0) {
        console.log(`Columns found in ${tableName}:`, Object.keys(data[0]));
      } else {
        console.log(`Table ${tableName} is empty. Checking table structure via other means...`);
        // We can try to insert a dummy record with a non-existent column to see the error message which might list columns, 
        // but that's destructive. 
        // Better: Try to select specific columns we suspect.
        const commonColumns = ['id', 'sender_id', 'receiver_id', 'recipient_id', 'to_id', 'content', 'created_at'];
        for (const col of commonColumns) {
           const { error: colError } = await supabase.from(tableName).select(col).limit(1);
           if (!colError) {
             console.log(`Column exists: ${col}`);
           } else {
             console.log(`Column DOES NOT exist: ${col} (${colError.message})`);
           }
        }
      }
    }
  } catch (err) {
    console.error(`Unexpected error inspecting ${tableName}:`, err);
  }
}

async function run() {
  await inspectTable('messages');
}

run();
