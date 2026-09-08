-- إصلاح: تعويض توكنات NULL بنص فارغ في auth.users (سبب 500 في GoTrue)
BEGIN;

UPDATE auth.users SET
  confirmation_token          = COALESCE(confirmation_token, ''),
  recovery_token              = COALESCE(recovery_token, ''),
  email_change                = COALESCE(email_change, ''),
  email_change_token_new      = COALESCE(email_change_token_new, ''),
  email_change_token_current  = COALESCE(email_change_token_current, ''),
  phone_change                = COALESCE(phone_change, ''),
  phone_change_token          = COALESCE(phone_change_token, '')
WHERE confirmation_token IS NULL OR recovery_token IS NULL OR email_change IS NULL
   OR email_change_token_new IS NULL OR email_change_token_current IS NULL
   OR phone_change IS NULL OR phone_change_token IS NULL OR reauthentication_token IS NULL;

-- تحقق 1: يجب أن يكون الناتج 0
SELECT count(*) AS remaining_null_rows FROM auth.users
WHERE confirmation_token IS NULL OR recovery_token IS NULL OR email_change IS NULL
   OR email_change_token_new IS NULL OR email_change_token_current IS NULL
   OR phone_change IS NULL OR phone_change_token IS NULL OR reauthentication_token IS NULL;

-- تحقق 2: الصفوف الثلاثة بعد الإصلاح (كلها يجب أن تكون '' غير NULL)
SELECT coalesce(email,'') AS email,
       confirmation_token IS NULL AS ct, recovery_token IS NULL AS rec,
       email_change IS NULL AS ec, email_change_token_new IS NULL AS ecn
FROM auth.users
WHERE id IN ('12345678-1234-1234-1234-123456789abc',
             'd5016116-590e-42eb-8c76-4ddb7c359046',
             '27bc58c5-89c6-4c41-8597-d73bbbf8951d');

COMMIT;
