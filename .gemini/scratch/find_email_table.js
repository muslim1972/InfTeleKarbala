
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findTable() {
  // Try to find ANY table that has an email ending in @inftele.com
  const tablesToCheck = ['profiles', 'app_users', 'user_credentials', 'login_data', 'account_info'];
  
  for (const table of tablesToCheck) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(5);
      if (!error && data && data.length > 0) {
        console.log(`\n--- Table: ${table} ---`);
        console.log("Columns:", Object.keys(data[0]));
        const hasInftele = JSON.stringify(data).includes('@inftele.com');
        if (hasInftele) {
          console.log("!!! FOUND @inftele.com in this table !!!");
          console.log("Row Data:", data.find(r => JSON.stringify(r).includes('@inftele.com')));
        }
      }
    } catch (e) {}
  }
  
  // Also check all views by trying to select from common names
  const commonViews = ['available_profiles', 'user_profiles', 'extended_profiles'];
  for (const view of commonViews) {
    const { data, error } = await supabase.from(view).select('*').limit(5);
    if (!error && data && data.length > 0) {
      console.log(`\n--- View: ${view} ---`);
      console.log("Columns:", Object.keys(data[0]));
      if (JSON.stringify(data).includes('@inftele.com')) {
        console.log("!!! FOUND @inftele.com in this view !!!");
      }
    }
  }
}

findTable();
