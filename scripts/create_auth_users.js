// Create matching Supabase auth users for profiles that were imported from Excel
// Usage (Windows PowerShell):
//   $env:SUPABASE_URL='https://...'; $env:SUPABASE_SERVICE_ROLE_KEY='srk...'; node scripts/create_auth_users.js

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log('Fetching profiles with job_number...');
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id,job_number,password,username')
    .not('job_number', 'is', null);

  if (error) {
    console.error('Failed to fetch profiles:', error);
    process.exit(1);
  }

  const summary = { created: 0, skipped_existing: 0, failed: 0 };

  for (const p of profiles) {
    const email = `${p.job_number}@inftele.com`;
    const password = p.password || generateTempPassword();

    try {
      // Try to create a user with the same id as the profile so login logic works
      console.log(`Creating auth user for profile id=${p.id} email=${email}`);
      const res = await supabase.auth.admin.createUser({
        id: p.id,
        email,
        password,
        email_confirm: true,
        user_metadata: { username: p.username, job_number: p.job_number },
      });

      if (res.error) {
        // If user already exists, skip
        if (res.error?.message && res.error.message.includes('already exists')) {
          console.log(`Auth user already exists for ${email}, skipping.`);
          summary.skipped_existing += 1;
          continue;
        }

        console.error('Failed to create user:', res.error);
        summary.failed += 1;
        continue;
      }

      console.log(`Created auth user id=${res.data.user.id} for ${email}`);
      summary.created += 1;
    } catch (err) {
      console.error('Error creating user for', email, err.message || err);
      summary.failed += 1;
    }
  }

  console.log('Done. Summary:', summary);
  console.log('Note: Keep the service role key secret. Verify a few logins manually afterwards.');
}

function generateTempPassword() {
  // Simple temp password generator (change policy as needed)
  return Math.random().toString(36).slice(-10) + 'A1!';
}

main();
