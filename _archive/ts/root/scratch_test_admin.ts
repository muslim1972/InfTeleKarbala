import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://khr-itpc.egov.iq';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODQyNTM1MDEsImV4cCI6MjA5OTYxMzUwMX0.YbdF55DaUN5Uy_XO0WNeJzeKrqdTkjpCQF8aTeoWOqk';
const supabase = createClient(supabaseUrl, serviceKey);

async function testUsers() {
  const { data, error } = await supabase.auth.admin.listUsers();
  const users = data.users.filter(u => u.email === '102513365@inftele.com');
  console.log('auth.users:', users.length > 0 ? users[0] : 'Not found');
    
  if (error) console.error(error);
}

testUsers();
