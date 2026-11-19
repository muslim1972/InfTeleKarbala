const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('D:/InfTeleKarbala/.env', 'utf8');
let url = '', key = '';
envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim().replace(/['"]/g, '');
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim().replace(/['"]/g, '');
});

console.log('Testing Supabase query with URL:', url);
const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase
    .from('work_schedules')
    .select(`
      id,
      name,
      employee:profiles!work_schedules_employee_id_fkey(
        id, full_name,
        departments:departments!profiles_department_id_fkey(name)
      )
    `)
    .eq('type', 'special')
    .limit(1);

  if (error) {
    console.error('ERROR:', error);
  } else {
    console.log('SUCCESS:', JSON.stringify(data, null, 2));
  }
}
test();
