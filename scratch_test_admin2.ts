import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://khr-itpc.egov.iq';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODQyNTM1MDEsImV4cCI6MjA5OTYxMzUwMX0.YbdF55DaUN5Uy_XO0WNeJzeKrqdTkjpCQF8aTeoWOqk';
const supabase = createClient(supabaseUrl, serviceKey);

async function testUser() {
  const userId = '27bc58c5-89c6-4c41-8597-d73bbbf8951d';
  
  const { data, error } = await supabase.auth.admin.createUser({
    id: '86b4b41b-b6c7-4209-b80f-b905e60a2c03',
    email: '148958591@inftele.com',
    password: 'mu@ITPC@2026',
    email_confirm: true
  });
  console.log('Create user:', data, error);
}

testUser();
