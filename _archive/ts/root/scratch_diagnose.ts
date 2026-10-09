import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://khr-itpc.egov.iq';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODQyNTM1MDEsImV4cCI6MjA5OTYxMzUwMX0.YbdF55DaUN5Uy_XO0WNeJzeKrqdTkjpCQF8aTeoWOqk';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg0MjUzNTAxLCJleHAiOjIwOTk2MTM1MDF9.J6epEjJZoyDL5GM_PNLoh3P2j18CCP4WeLrfAejCaew';

async function diagnose() {
  // Test 1: Does the API respond at all?
  console.log('=== Test 1: API Health ===');
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/health`);
    const data = await res.json();
    console.log('Auth health:', res.status, data);
  } catch (e: any) {
    console.error('Auth health failed:', e.message);
  }

  // Test 2: Try signInWithPassword for Rusul (the failing user)
  console.log('\n=== Test 2: Login Rusul (102513365@inftele.com) ===');
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
      },
      body: JSON.stringify({
        email: '102513365@inftele.com',
        password: '107341'
      })
    });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e: any) {
    console.error('Failed:', e.message);
  }

  // Test 3: Try signInWithPassword for Ali (a working user)
  console.log('\n=== Test 3: Login Ali (148958591@inftele.com) - control test ===');
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
      },
      body: JSON.stringify({
        email: '148958591@inftele.com',
        password: 'wrong_password_for_test'
      })
    });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e: any) {
    console.error('Failed:', e.message);
  }

  // Test 4: Try getUserById via raw API
  console.log('\n=== Test 4: Admin getUserById for Rusul ===');
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/27bc58c5-89c6-4c41-8597-d73bbbf8951d`, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      }
    });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e: any) {
    console.error('Failed:', e.message);
  }

  // Test 5: Try to query auth.users via pg-meta or SQL endpoint
  console.log('\n=== Test 5: Try pg-meta SQL endpoint ===');
  for (const path of ['/pg/query', '/pg-meta/default/query', '/rest/v1/rpc/pg_stat_statements']) {
    try {
      const res = await fetch(`${supabaseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ query: "SELECT id, email FROM auth.users WHERE id = '27bc58c5-89c6-4c41-8597-d73bbbf8951d'" })
      });
      console.log(`${path}: status=${res.status}`);
      if (res.status < 500) {
        const data = await res.text();
        console.log('Response:', data.substring(0, 500));
      }
    } catch (e: any) {
      console.log(`${path}: ${e.message}`);
    }
  }

  // Test 6: Check auth container logs via Supabase management API
  console.log('\n=== Test 6: Check if GoTrue auth logs endpoint exists ===');
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/`, {
      headers: { 'apikey': anonKey }
    });
    console.log('Auth root:', res.status);
  } catch (e: any) {
    console.log('Auth root failed:', e.message);
  }
}

diagnose();
