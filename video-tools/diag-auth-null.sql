-- تشخيص: صفوف auth.users ذات التوكنات NULL التي تكسر GoTrue
SELECT id, coalesce(email,'') AS email,
  confirmation_token IS NULL AS ct_null,
  recovery_token IS NULL AS rec_null,
  email_change IS NULL AS ec_null,
  email_change_token_new IS NULL AS ecn_null,
  email_change_token_current IS NULL AS ecc_null,
  phone_change IS NULL AS pc_null,
  phone_change_token IS NULL AS pct_null,
  created_at::date AS created
FROM auth.users
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change IS NULL
   OR email_change_token_new IS NULL
   OR email_change_token_current IS NULL
   OR phone_change IS NULL
   OR phone_change_token IS NULL
ORDER BY created_at;

-- إجمالي المستخدمين
SELECT count(*) AS total_users FROM auth.users;

-- هل المستخدم الذي يفشل (27bc58c5-...) منهم؟
SELECT id, email IS NOT NULL AS has_email, confirmation_token IS NULL AS ct_null
FROM auth.users WHERE id = '27bc58c5-89c6-4c41-8597-d73bbbf8951d';
