import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient('https://khr-itpc.egov.iq', process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
  const { data: finSample } = await supabase.from('financial_records').select('*').limit(1);
  console.log('financial_records columns:', Object.keys(finSample?.[0] || {}));
  console.log('financial_records sample:', finSample?.[0]);

  // Check leave_requests for unpaid / absence
  const { data: leaveTypes } = await supabase
    .from('leave_requests')
    .select('leave_type, is_mandatory, status, leave_status')
    .limit(20);
  console.log('leave_requests sample:', leaveTypes);

  // Check if there are requests with reason or type containing غياب
  const { data: absentReqs, count } = await supabase
    .from('leave_requests')
    .select('id, user_id, leave_type, days_count, is_mandatory, reason, status, leave_status', { count: 'exact' })
    .or('reason.ilike.%غياب%,leave_type.eq.unpaid');
  console.log('Absence/Unpaid leave_requests count:', count);
  console.log('Sample absent requests:', absentReqs?.slice(0, 5));
}

inspect().catch(console.error);
