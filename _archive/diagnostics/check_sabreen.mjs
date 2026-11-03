import { createClient } from '@supabase/supabase-js';

const url = 'https://khr-itpc.egov.iq';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg0MjUzNTAxLCJleHAiOjIwOTk2MTM1MDF9.J6epEjJZoyDL5GM_PNLoh3P2j18CCP4WeLrfAejCaew';

const supabase = createClient(url, key);

async function run() {
  console.log('Searching profiles...');
  const { data: p1, error: e1 } = await supabase
    .from('profiles')
    .select('id, full_name, job_number, username, governorate')
    .or('job_number.ilike.%103523%,full_name.ilike.%صابرين%,username.ilike.%صابرين%');

  console.log('Profiles result:', p1, 'Error:', e1);

  // Check available_profiles
  const { data: p2, error: e2 } = await supabase
    .from('available_profiles')
    .select('id, full_name, job_number')
    .or('job_number.ilike.%103523%,full_name.ilike.%صابرين%');

  console.log('Available profiles result:', p2, 'Error:', e2);
}

run();
