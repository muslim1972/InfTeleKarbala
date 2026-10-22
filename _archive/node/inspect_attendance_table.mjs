import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient('https://khr-itpc.egov.iq', process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectAttendance() {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
  } else if (data && data.length > 0) {
    console.log('Columns in attendance_records:', Object.keys(data[0]));
    console.log('Sample attendance record:', data[0]);
  } else {
    console.log('attendance_records is empty');
  }
}

inspectAttendance();
