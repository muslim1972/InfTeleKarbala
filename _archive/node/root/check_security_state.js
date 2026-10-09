require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Service Role Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
  console.log("--- DB Security State ---");
  
  // Check if activity_logs table exists
  const { data: logsData, error: logsError } = await supabase
    .from('activity_logs')
    .select('*')
    .limit(1);
    
  if (logsError) {
    console.log("activity_logs table: MISSING or ERROR ->", logsError.message);
  } else {
    console.log("activity_logs table: EXISTS");
  }

  // Check if app_users has 2FA columns (two_factor_enabled, two_factor_secret)
  const { data: usersData, error: usersError } = await supabase
    .from('app_users')
    .select('two_factor_enabled, two_factor_secret')
    .limit(1);
    
  if (usersError) {
    if (usersError.message.includes("Could not find the 'two_factor_enabled' column") || usersError.message.includes("does not exist")) {
        console.log("2FA columns in app_users: MISSING");
    } else {
        console.log("app_users table error ->", usersError.message);
    }
  } else {
    console.log("2FA columns in app_users: EXISTS");
  }

  // Check policies by attempting to call a raw SQL function if one exists, but we might not be able to easily query pg_policies from REST API.
  // Actually, Supabase REST API doesn't allow querying pg_class or pg_policies directly unless exposed.
  // Let's create a temporary SQL script instead that the user can run, or try to run a query via a stored procedure.
  console.log("Done checking via REST. For RLS policies, a direct SQL query is needed.");
}

checkDb();
