import { createClient } from '@supabase/supabase-js';

const url = 'https://khr-itpc.egov.iq';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODQyNTM1MDEsImV4cCI6MjA5OTYxMzUwMX0.YbdF55DaUN5Uy_XO0WNeJzeKrqdTkjpCQF8aTeoWOqk';

const supabase = createClient(url, serviceKey);

async function main() {
  const locId = 'e4047bbe-d928-42b9-a616-b6ccc1522d64';
  
  // 1. Check audit logs referencing this location
  const { data: logs, error: logsErr } = await supabase
    .from('work_location_audit_logs')
    .select('*')
    .eq('location_id', locId);
  
  console.log('Audit logs referencing this location:', logs?.length, logsErr || '');

  // 2. Check if any profiles have work_location_id = locId
  const { data: profs, error: profsErr } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('work_location_id', locId);

  console.log('Profiles referencing this location:', profs?.length, profsErr || '');

  // 3. Check if any attendance records reference this location
  const { data: atts, error: attsErr } = await supabase
    .from('attendance_records')
    .select('id')
    .eq('work_location_id', locId)
    .limit(5);

  console.log('Attendance records referencing this location:', atts?.length, attsErr || '');
}

main();
