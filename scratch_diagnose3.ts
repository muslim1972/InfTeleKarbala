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
  return await res.json();
}

async function deepDiagnose() {
  // 1. Get ALL columns of auth.users for Rusul to find corrupted data
  console.log('=== 1. Full column list of auth.users ===');
  const cols = await runSQL(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_schema = 'auth' AND table_name = 'users'
    ORDER BY ordinal_position
  `);
  console.log(JSON.stringify(cols, null, 2));

  // 2. Get every single column value for Rusul
  console.log('\n=== 2. Every column value for Rusul ===');
  const allCols = await runSQL(`
    SELECT * FROM auth.users WHERE id = '27bc58c5-89c6-4c41-8597-d73bbbf8951d'
  `);
  console.log(JSON.stringify(allCols, null, 2));

  // 3. Compare with a WORKING user (Ali)
  console.log('\n=== 3. Ali (working user) record for comparison ===');
  const ali = await runSQL(`
    SELECT * FROM auth.users WHERE id = '86b4b41b-b6c7-4209-b80f-b905e60a2c03'
  `);
  console.log(JSON.stringify(ali, null, 2));

  // 4. Check auth.mfa_factors
  console.log('\n=== 4. auth.mfa_factors for Rusul ===');
  const mfa = await runSQL(`
    SELECT * FROM auth.mfa_factors WHERE user_id = '27bc58c5-89c6-4c41-8597-d73bbbf8951d'
  `);
  console.log(JSON.stringify(mfa, null, 2));

  // 5. Check if any function or view in auth schema references something broken
  console.log('\n=== 5. GoTrue auth config ===');
  const config = await runSQL(`
    SELECT * FROM auth.flow_state WHERE user_id = '27bc58c5-89c6-4c41-8597-d73bbbf8951d'
  `);
  console.log(JSON.stringify(config, null, 2));

  // 6. Check auth.refresh_tokens
  console.log('\n=== 6. auth.refresh_tokens for Rusul ===');
  const tokens = await runSQL(`
    SELECT id, token, user_id, revoked, created_at, updated_at, parent, session_id 
    FROM auth.refresh_tokens 
    WHERE user_id = '27bc58c5-89c6-4c41-8597-d73bbbf8951d'
  `);
  console.log(JSON.stringify(tokens, null, 2));
}

deepDiagnose();
