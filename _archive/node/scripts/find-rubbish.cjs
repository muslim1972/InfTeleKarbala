const { createClient } = require('@supabase/supabase-js');

const url = "https://khr-itpc.egov.iq";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODQyNTM1MDEsImV4cCI6MjA5OTYxMzUwMX0.YbdF55DaUN5Uy_XO0WNeJzeKrqdTkjpCQF8aTeoWOqk";

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  console.log('Searching attendance_records with question marks in notes...');
  const { data: recs, error } = await supabase
    .from('attendance_records')
    .select('id, employee_id, check_in, notes, admin_notes')
    .or('notes.ilike.%?%,admin_notes.ilike.%?%')
    .limit(20);

  if (error) {
    console.error('Search error:', error);
  } else {
    console.log(`Found ${recs?.length || 0} records with question marks in notes:`);
    console.log(JSON.stringify(recs, null, 2));
  }
}

main().catch(console.error);
