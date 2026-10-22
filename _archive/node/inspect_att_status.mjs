import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient('https://khr-itpc.egov.iq', process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectAttendance() {
  const { data: attSample } = await supabase.from('attendance_records').select('*').limit(2);
  console.log('attendance_records columns:', Object.keys(attSample?.[0] || {}));
  console.log('attendance_records sample:', attSample?.[0]);

  // Distinct status in attendance_records
  const { data: statuses } = await supabase
    .from('attendance_records')
    .select('status')
    .limit(100);
  const uniqueStatuses = [...new Set(statuses?.map(s => s.status))];
  console.log('unique attendance statuses:', uniqueStatuses);
}

inspectAttendance().catch(console.error);
