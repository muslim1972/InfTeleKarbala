const { createClient } = require('@supabase/supabase-js');

const url = "https://khr-itpc.egov.iq";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODQyNTM1MDEsImV4cCI6MjA5OTYxMzUwMX0.YbdF55DaUN5Uy_XO0WNeJzeKrqdTkjpCQF8aTeoWOqk";

const supabase = createClient(url, key, {
  auth: { persistSession: false }
});

async function main() {
  const { data: users, error: uErr } = await supabase
    .from('profiles')
    .select('id, username, full_name')
    .ilike('username', '%test%');

  console.log('Test users:', users);

  if (users && users.length > 0) {
    for (const u of users) {
      console.log(`\n=== Records for ${u.username} (${u.full_name}, ${u.id}) ===`);
      const { data: recs } = await supabase
        .from('attendance_records')
        .select('id, created_at, check_in, check_out, notes, raw_punches')
        .eq('employee_id', u.id)
        .order('created_at', { ascending: false })
        .limit(5);

      console.log('Attendance Records:', JSON.stringify(recs, null, 2));

      const { data: leaves } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', u.id)
        .order('created_at', { ascending: false })
        .limit(5);

      console.log('Leave Requests:', JSON.stringify(leaves, null, 2));
    }
  }
}

main().catch(console.error);
