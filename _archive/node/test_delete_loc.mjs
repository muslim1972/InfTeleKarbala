import { createClient } from '@supabase/supabase-js';

const url = 'https://khr-itpc.egov.iq';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODQyNTM1MDEsImV4cCI6MjA5OTYxMzUwMX0.YbdF55DaUN5Uy_XO0WNeJzeKrqdTkjpCQF8aTeoWOqk';

const supabase = createClient(url, serviceKey);

async function main() {
  const locId = 'e4047bbe-d928-42b9-a616-b6ccc1522d64';

  // Try delete with service_role to see the exact error or if it fails
  const { data, error } = await supabase
    .from('work_locations')
    .delete()
    .eq('id', locId);

  console.log('Delete result:', { data, error });
}

main();
