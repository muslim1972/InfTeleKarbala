import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('D:/InfTeleKarbala/.env.production', 'utf8');
let url = '', key = '';
envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim().replace(/['"]/g, '');
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim().replace(/['"]/g, '');
});

const supabase = createClient(url, key);

async function run() {
  console.log('1. Testing work_schedules query:');
  const res1 = await supabase
    .from('work_schedules')
    .select(`
      id,
      name,
      type,
      employee_id,
      created_at,
      days:work_schedule_days(*),
      employee:profiles!work_schedules_employee_id_fkey(
        id, full_name, job_number, department_id, governorate,
        departments:departments!profiles_department_id_fkey(name)
      ),
      creator:profiles!work_schedules_created_by_fkey(
        id, full_name
      )
    `)
    .eq('type', 'special')
    .limit(2);

  if (res1.error) console.error('WS Error:', res1.error);
  else console.log('WS Success, count:', res1.data.length);

  console.log('\n2. Testing employee_weekly_exemptions query:');
  const res2 = await supabase
    .from('employee_weekly_exemptions')
    .select(`
      *,
      employee:profiles!employee_weekly_exemptions_employee_id_fkey(
        id, full_name, job_number, department_id,
        departments:departments!profiles_department_id_fkey(name)
      ),
      creator:profiles!employee_weekly_exemptions_created_by_fkey(
        id, full_name
      )
    `)
    .limit(2);

  if (res2.error) console.error('Exemptions Error:', res2.error);
  else console.log('Exemptions Success, count:', res2.data.length);
}
run();
