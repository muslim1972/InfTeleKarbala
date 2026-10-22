import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient('https://khr-itpc.egov.iq', process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkLeaves() {
  const { data: allReqs } = await supabase
    .from('leave_requests')
    .select('id, user_id, leave_type, days_count, is_mandatory, reason, status, leave_status')
    .eq('is_mandatory', true);
  console.log('Mandatory requests count:', allReqs?.length);
  console.log('Sample mandatory requests:', allReqs?.slice(0, 5));
}

checkLeaves().catch(console.error);
