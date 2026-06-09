const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

async function testLimit() {
  console.log('Testing rate limit on check_user_exists (7 requests)...');
  for(let i=1; i<=7; i++) {
    const res = await fetch(`${url}/rest/v1/rpc/check_user_exists`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_username: 'test' + i, p_governorate: 'karbala' })
    });
    console.log(`Attempt ${i}: Status ${res.status}`);
    if (res.status !== 200) {
       console.log('Response:', await res.text());
    }
  }
}
testLimit();
