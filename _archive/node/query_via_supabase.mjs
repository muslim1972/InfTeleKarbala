import { createClient } from '@supabase/supabase-js';

const url = 'https://khr-itpc.egov.iq';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODQyNTM1MDEsImV4cCI6MjA5OTYxMzUwMX0.YbdF55DaUN5Uy_XO0WNeJzeKrqdTkjpCQF8aTeoWOqk';

const supabase = createClient(url, serviceKey);

async function main() {
  const { data, error } = await supabase
    .from('work_locations')
    .select('*')
    .ilike('name', '%مخازن%');

  if (error) {
    console.error('Error fetching locations:', error);
  } else {
    console.log('Work locations with مخازن:');
    console.dir(data, { depth: null });
  }
}

main();
