import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient('https://khr-itpc.egov.iq', process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectTriggers() {
  // فحص تعريف الدالة handle_leave_state_machine
  const { data, error } = await supabase.rpc('get_function_def', { func_name: 'handle_leave_state_machine' });
  if (error) {
    console.log('RPC get_function_def not found, querying via pg_proc if possible or inspecting tables');
  } else {
    console.log('Function def:', data);
  }
}

inspectTriggers();
