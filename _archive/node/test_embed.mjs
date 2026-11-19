import { createClient } from '@supabase/supabase-js';

const url = 'https://khr-itpc.egov.iq';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODQyNTM1MDEsImV4cCI6MjA5OTYxMzUwMX0.YbdF55DaUN5Uy_XO0WNeJzeKrqdTkjpCQF8aTeoWOqk';

const supabase = createClient(url, serviceKey);

async function run() {
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
    .limit(5);

  console.log('Result error:', error);
  console.log('Data length:', data ? data.length : null);
  if (data && data.length > 0) {
    console.log('Sample item:', JSON.stringify(data[0], null, 2));
  }
}

run();
