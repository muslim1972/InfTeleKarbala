import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient('https://khr-itpc.egov.iq', process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSummaries() {
  const { data: adminSample } = await supabase.from('administrative_summary').select('*').limit(1);
  console.log('administrative_summary columns:', Object.keys(adminSample?.[0] || {}));

  const { data: yearlySample } = await supabase.from('yearly_records').select('*').limit(1);
  console.log('yearly_records columns:', Object.keys(yearlySample?.[0] || {}));
}

checkSummaries().catch(console.error);
