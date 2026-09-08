import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://khr-itpc.egov.iq';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg0MjUzNTAxLCJleHAiOjIwOTk2MTM1MDF9.J6epEjJZoyDL5GM_PNLoh3P2j18CCP4WeLrfAejCaew';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('username, full_name, role')
    .limit(10);
    
  console.log(data);
}

testUsers();
