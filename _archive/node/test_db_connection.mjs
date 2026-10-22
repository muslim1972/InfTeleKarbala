import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = 'https://khr-itpc.egov.iq';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log('Connecting to Supabase at:', supabaseUrl);
  
  // 1. فحص وجود أعمدة cumulative في financial_records
  const { data: cols, error: colErr } = await supabase
    .from('financial_records')
    .select('*')
    .limit(1);

  if (colErr) {
    console.error('Error querying financial_records:', colErr);
  } else if (cols && cols.length > 0) {
    console.log('Columns in financial_records:', Object.keys(cols[0]).filter(k => k.includes('cum') || k.includes('leave') || k.includes('balance')));
    console.log('Sample record:', cols[0]);
  } else {
    console.log('financial_records is empty or inaccessible');
  }

  // 2. فحص عينة من الموظفين لاختيار موظف صباحي
  const { data: emps, error: empErr } = await supabase
    .from('profiles')
    .select('id, full_name, role, admin_role, governorate, work_schedule_id, department_id')
    .eq('governorate', 'karbala')
    .limit(5);

  if (empErr) {
    console.error('Error querying profiles:', empErr);
  } else {
    console.log('\nFound employees sample:', emps);
  }

  // 3. فحص جداول الدوام work_schedules
  const { data: schedules, error: schErr } = await supabase
    .from('work_schedules')
    .select('*');

  if (schErr) {
    console.error('Error querying work_schedules:', schErr);
  } else {
    console.log('\nWork schedules:', schedules);
  }
}

run().catch(console.error);
