const { createClient } = require('@supabase/supabase-js');

const url = "https://khr-itpc.egov.iq";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODQyNTM1MDEsImV4cCI6MjA5OTYxMzUwMX0.YbdF55DaUN5Uy_XO0WNeJzeKrqdTkjpCQF8aTeoWOqk";

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data, error } = await supabase.rpc('get_function_def', { func_name: 'submit_attendance_record_secure' });
  if (error) {
    console.log('rpc get_function_def failed:', error.message);
  } else {
    console.log('Definition:', data);
  }
}

main().catch(console.error);
