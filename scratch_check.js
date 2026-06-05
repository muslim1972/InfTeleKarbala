import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
// Using the anon key is enough if we call an RPC that exists, or we can use the service_role key to query pg_proc.
// Let's just do a simple select from profiles using the anon key to see if it returns is_training_supervisor.
// Wait, we need to log in as "تجريبي 1" to test get_own_profile!
// Let's just create a test function to see what get_own_profile returns.

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.auth.signInWithPassword({
    username: 'تجريبي 1',
    password: '1' // assuming simple password for testing, or we can just use another way.
  });
  
  if (error) {
     console.error('Login error:', error);
     return;
  }
  
  const { data: profile, error: err } = await supabase.rpc('get_own_profile').single();
  console.log('Profile from get_own_profile:', profile);
  console.log('Error:', err);
}

check();
