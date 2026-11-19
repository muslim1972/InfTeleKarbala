import { createClient } from '@supabase/supabase-js';

const url = 'https://khr-itpc.egov.iq';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODQyNTM1MDEsImV4cCI6MjA5OTYxMzUwMX0.YbdF55DaUN5Uy_XO0WNeJzeKrqdTkjpCQF8aTeoWOqk';

const supabase = createClient(url, serviceKey);

async function main() {
  const dupId = 'e4047bbe-d928-42b9-a616-b6ccc1522d64';
  const { data: dupEmp, error: errEmp } = await supabase.from('work_location_employees').select('employee_id').eq('location_id', dupId);
  const empIds = dupEmp.map(e => e.employee_id);
  console.log('empIds:', empIds);
  
  const { data: profiles, error: errProf } = await supabase
    .from('profiles')
    .select('id, full_name, job_number, department_id')
    .in('id', empIds);
    
  console.log('Error profiles:', errProf);
  console.log('Employees:', profiles);
}

main();
