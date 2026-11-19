import { createClient } from '@supabase/supabase-js';

const url = 'https://khr-itpc.egov.iq';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODQyNTM1MDEsImV4cCI6MjA5OTYxMzUwMX0.YbdF55DaUN5Uy_XO0WNeJzeKrqdTkjpCQF8aTeoWOqk';

const supabase = createClient(url, serviceKey);

async function main() {
  const muslimId = 'd2c4eef8-72cc-4dd1-a734-00d5ebe94f6d';

  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('employee_id', muslimId)
    .order('created_at', { ascending: false })
    .limit(2);

  console.log('Error:', error);
  console.log('Records for Muslim:', JSON.stringify(data, null, 2));
}

main();
