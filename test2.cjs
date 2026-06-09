const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

async function check() {
  const r1 = await fetch(`${url}/rest/v1/summer_training_settings?select=*&limit=1`, { headers: { apikey: key }});
  console.log('summer_training_settings:', await r1.text());
  
  const r2 = await fetch(`${url}/rest/v1/admin_tips?select=*&limit=1`, { headers: { apikey: key }});
  console.log('admin_tips:', (await r2.text()).substring(0, 500));
}
check();
