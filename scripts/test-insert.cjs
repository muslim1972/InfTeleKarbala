const { createClient } = require('@supabase/supabase-js');

const url = "https://khr-itpc.egov.iq";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODQyNTM1MDEsImV4cCI6MjA5OTYxMzUwMX0.YbdF55DaUN5Uy_XO0WNeJzeKrqdTkjpCQF8aTeoWOqk";

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  // Let's test insert directly with service_role to see what constraints exist
  const { data, error } = await supabase
    .from('attendance_records')
    .insert([{
      employee_id: 'df58aad4-992c-45f0-93af-0d1f2b35c3f6',
      status: 'present',
      check_in: new Date().toISOString()
    }])
    .select();

  console.log('Direct Insert Result:', { data, error });

  if (data && data[0]) {
    // Delete the test record right away
    await supabase.from('attendance_records').delete().eq('id', data[0].id);
    console.log('Cleaned up test record');
  }
}

main().catch(console.error);
