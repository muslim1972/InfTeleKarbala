const { createClient } = require('@supabase/supabase-js');

const url = "https://khr-itpc.egov.iq";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODQyNTM1MDEsImV4cCI6MjA5OTYxMzUwMX0.YbdF55DaUN5Uy_XO0WNeJzeKrqdTkjpCQF8aTeoWOqk";

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const empId = 'df58aad4-992c-45f0-93af-0d1f2b35c3f6';
  
  // Let's test logging in as test-1 to get a real session!
  console.log('Logging in as test-1...');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'test-1@itpc.gov.iq', // wait, what is test-1 email?
    password: 'password123'
  });
  
  if (authErr) {
    console.log('signInWithPassword failed:', authErr.message);
  } else {
    console.log('Logged in successfully! Token:', authData.session?.access_token ? 'YES' : 'NO');
  }
}

main().catch(console.error);
