const { createClient } = require('@supabase/supabase-js');

const url = "https://khr-itpc.egov.iq";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODQyNTM1MDEsImV4cCI6MjA5OTYxMzUwMX0.YbdF55DaUN5Uy_XO0WNeJzeKrqdTkjpCQF8aTeoWOqk";

const supabase = createClient(url, key, {
  auth: { persistSession: false }
});

async function main() {
  const employeeId = 'df58aad4-992c-45f0-93af-0d1f2b35c3f6'; // test-1
  
  console.log('Testing submit_attendance_record_secure RPC...');
  const { data, error } = await supabase.rpc('submit_attendance_record_secure', {
    p_employee_id: employeeId,
    p_record_id: null,
    p_updates: {
      employee_id: employeeId,
      status: 'present',
      check_in: new Date().toISOString(),
      raw_punches: [{ time: new Date().toISOString() }]
    }
  });

  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('RPC Success:', data);
  }
}

main().catch(console.error);
