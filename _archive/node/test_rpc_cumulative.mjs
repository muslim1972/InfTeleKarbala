import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = 'https://khr-itpc.egov.iq';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function testRpc() {
  console.log('Testing RPC convert_cumulative_time...');
  const { data, error } = await supabase.rpc('convert_cumulative_time');
  console.log('Result:', { data, error });
}

testRpc().catch(console.error);
