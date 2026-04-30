
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectTable(tableName) {
  const { data, error } = await supabase.from(tableName).select('*').limit(1);
  if (data && data.length > 0) {
    console.log(`Columns in ${tableName}:`, Object.keys(data[0]));
  } else {
    console.log(`${tableName} is empty.`);
  }
}

inspectTable('conversations');
