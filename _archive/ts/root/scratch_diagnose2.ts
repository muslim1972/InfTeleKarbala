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

async function diagnose() {
  // 1. Get the full auth.users record for Rusul
  console.log('=== 1. auth.users record for Rusul ===');
  const userRecord = await runSQL(`
    SELECT id, email, encrypted_password, 
           email_confirmed_at, 
           raw_app_meta_data::text as app_meta,
           raw_user_meta_data::text as user_meta,
           created_at, updated_at, 
           role, 
           is_sso_user,
           aud,
           confirmation_token,
           recovery_token,
           email_change,
           email_change_token_new,
           phone,
           phone_confirmed_at,
           banned_until,
           deleted_at
    FROM auth.users 
    WHERE id = '27bc58c5-89c6-4c41-8597-d73bbbf8951d'
  `);
  console.log(JSON.stringify(userRecord, null, 2));

  // 2. Check if there are any duplicate emails
  console.log('\n=== 2. Duplicate email check ===');
  const dupes = await runSQL(`
    SELECT id, email, created_at 
    FROM auth.users 
    WHERE email = '102513365@inftele.com'
  `);
  console.log(JSON.stringify(dupes, null, 2));

  // 3. Check identities table
  console.log('\n=== 3. auth.identities for Rusul ===');
  const identities = await runSQL(`
    SELECT id, user_id, identity_data::text, provider, created_at, updated_at
    FROM auth.identities 
    WHERE user_id = '27bc58c5-89c6-4c41-8597-d73bbbf8951d'
  `);
  console.log(JSON.stringify(identities, null, 2));

  // 4. Check auth.sessions
  console.log('\n=== 4. auth.sessions for Rusul ===');
  const sessions = await runSQL(`
    SELECT id, user_id, created_at, updated_at, factor_id, aal, not_after
    FROM auth.sessions 
    WHERE user_id = '27bc58c5-89c6-4c41-8597-d73bbbf8951d'
  `);
  console.log(JSON.stringify(sessions, null, 2));

  // 5. Check triggers on auth.users
  console.log('\n=== 5. Triggers on auth.users ===');
  const triggers = await runSQL(`
    SELECT trigger_name, event_manipulation, action_statement
    FROM information_schema.triggers 
    WHERE event_object_schema = 'auth' 
    AND event_object_table = 'users'
  `);
  console.log(JSON.stringify(triggers, null, 2));

  // 6. Check auth schema version
  console.log('\n=== 6. GoTrue schema version ===');
  const version = await runSQL(`
    SELECT * FROM auth.schema_migrations ORDER BY version DESC LIMIT 5
  `);
  console.log(JSON.stringify(version, null, 2));
}

diagnose();
