const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODQyNTM1MDEsImV4cCI6MjA5OTYxMzUwMX0.YbdF55DaUN5Uy_XO0WNeJzeKrqdTkjpCQF8aTeoWOqk';
const baseUrl = 'https://khr-itpc.egov.iq';

async function runSQL(query: string): Promise<any> {
  const res = await fetch(`${baseUrl}/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ query })
  });
  const data = await res.json();
  return data;
}

async function fix() {
  const userId = '27bc58c5-89c6-4c41-8597-d73bbbf8951d';
  const email = '102513365@inftele.com';

  // Step 1: Insert the missing identity record
  console.log('=== Inserting missing identity record for Rusul ===');
  const insertResult = await runSQL(`
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, 
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      '${userId}',
      '${userId}',
      '{"sub": "${userId}", "email": "${email}", "email_verified": true, "phone_verified": false}'::jsonb,
      'email',
      '${userId}',
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (provider, provider_id) DO NOTHING
    RETURNING id;
  `);
  console.log('Insert result:', JSON.stringify(insertResult, null, 2));

  // Step 2: Verify the identity was inserted
  console.log('\n=== Verifying identity record ===');
  const verify = await runSQL(`
    SELECT id, user_id, provider, identity_data::text, created_at 
    FROM auth.identities 
    WHERE user_id = '${userId}'
  `);
  console.log('Identities:', JSON.stringify(verify, null, 2));

  // Step 3: Test login again
  console.log('\n=== Testing login for Rusul after fix ===');
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg0MjUzNTAxLCJleHAiOjIwOTk2MTM1MDF9.J6epEjJZoyDL5GM_PNLoh3P2j18CCP4WeLrfAejCaew';
  const res = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anonKey,
    },
    body: JSON.stringify({
      email: email,
      password: '107341'
    })
  });
  const data = await res.json();
  console.log('Login status:', res.status);
  if (res.status === 200) {
    console.log('✅ LOGIN SUCCESSFUL! User ID:', data.user?.id);
  } else {
    console.log('❌ Login failed:', JSON.stringify(data, null, 2));
  }
}

fix();
