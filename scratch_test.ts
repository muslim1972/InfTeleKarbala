import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://khr-itpc.egov.iq';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg0MjUzNTAxLCJleHAiOjIwOTk2MTM1MDF9.J6epEjJZoyDL5GM_PNLoh3P2j18CCP4WeLrfAejCaew';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogin() {
  const username = 'علي سعدون جعفر';
  const password = '123'; // assuming a wrong password just to see if it reaches 500
  
  console.log('1. Fetching profile via get_login_profile...');
  const { data: profile, error: profileErr } = await supabase
    .rpc('get_login_profile', { p_username: username, p_password: password })
    .maybeSingle();
    
  if (profileErr) {
    console.error('get_login_profile error:', profileErr);
    return;
  }
  
  if (!profile) {
    console.error('get_login_profile returned null (incorrect password or username)');
    return;
  }
  
  console.log('Profile found:', profile);
  
  const loginEmail = profile.email;
  console.log('2. Logging in with email:', loginEmail);
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: loginEmail,
    password: password
  });
  
  if (error) {
    console.error('signInWithPassword error:', error);
    console.error('Status:', error.status);
    console.error('Message:', error.message);
  } else {
    console.log('Login successful:', data.user?.id);
  }
}

testLogin();
