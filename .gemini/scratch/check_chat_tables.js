
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listTables() {
  // We can try to query some likely table names or use a trick to list tables
  const tables = ['conversations', 'conversation_participants', 'chat_participants', 'direct_messages'];
  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    console.log(`Table ${table} exists:`, !error);
  }
}

listTables();
