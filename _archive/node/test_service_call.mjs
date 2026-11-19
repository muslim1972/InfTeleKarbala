import { createClient } from '@supabase/supabase-js';

const url = 'https://khr-itpc.egov.iq';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODQyNTM1MDEsImV4cCI6MjA5OTYxMzUwMX0.YbdF55DaUN5Uy_XO0WNeJzeKrqdTkjpCQF8aTeoWOqk';

const supabase = createClient(url, serviceKey);

async function testQuery(locationId) {
  const { data, error } = await supabase
    .from('work_location_employees')
    .select(`
      id,
      location_id,
      employee_id,
      shift_start,
      shift_end,
      employee:profiles (
        id,
        full_name,
        job_number,
        role,
        work_schedule_id,
        work_schedule:work_schedules!profiles_work_schedule_id_fkey (
          id,
          name,
          type,
          valid_from,
          valid_until
        )
      )
    `)
    .eq('location_id', locationId);

  console.log(`Location ${locationId}: error =`, error?.message || null, `found ${data?.length} employees`);
  if (data && data.length > 0) {
    console.log('First employee:', data[0].employee?.full_name, 'Schedule:', data[0].employee?.work_schedule?.name);
  }
}

async function main() {
  // Test 1: HR department location from screenshot 2
  const hrLocId = 'c60d35bd-3fb7-4082-bdb3-b4524b025256';
  await testQuery(hrLocId);

  // Test 2: Warehouse real location (should have 12 employees now)
  const warehouseLocId = '0da575ea-300b-4b24-823d-5478d9ab5f56';
  await testQuery(warehouseLocId);
}

main();
