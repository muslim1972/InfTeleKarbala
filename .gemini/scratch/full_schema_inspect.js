
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const tables = [
  'administrative_summary',
  'app_users',
  'committees_details',
  'conversations',
  'field_change_logs',
  'field_permissions',
  'financial_records',
  'five_year_leaves',
  'hr_audio_calls',
  'leave_history',
  'leave_requests',
  'leaves_details',
  'messages',
  'notifications',
  'penalties_details',
  'poll_responses',
  'profiles',
  'rate_limits',
  'supervisor_permissions',
  'thanks_details',
  'yearly_records'
];

async function inspectSchema() {
  const schemaInfo = {};

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        schemaInfo[table] = { exists: false, error: error.message };
      } else {
        const columns = data && data.length > 0 ? Object.keys(data[0]) : 'Exists but empty';
        schemaInfo[table] = { exists: true, columns };
      }
    } catch (err) {
      schemaInfo[table] = { exists: false, error: err.message };
    }
  }

  console.log(JSON.stringify(schemaInfo, null, 2));
}

inspectSchema();
