const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

async function testEndpoint(name, endpoint) {
  console.log(`\n--- Testing ${name} ---`);
  try {
    const res = await fetch(`${url}/rest/v1/${endpoint}`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    const status = res.status;
    const data = await res.text();
    console.log(`Status: ${status}`);
    if (status >= 400) {
      console.log(`Response: ${data}`);
    } else {
      console.log(`Response: Data returned (${data.length} bytes). This means it is still exposed!`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

async function runTests() {
  await testEndpoint('available_profiles (Broken Access Control)', 'available_profiles?select=*&limit=1');
  await testEndpoint('summer_training_settings (Broken Access Control)', 'summer_training_settings?select=*&limit=1');
  await testEndpoint('admin_tips (Verbose Errors / Information Disclosure)', 'admin_tips?select=*');
}

runTests();
