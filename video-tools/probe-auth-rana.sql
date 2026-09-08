-- 1) الأعمدة الموجودة فعلاً من قائمة التوكنات (لتجنب عمود غير موجود)
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema='auth' AND table_name='users'
  AND column_name IN ('confirmation_token','recovery_token','email_change',
      'email_change_token_new','email_change_token_current',
      'phone_change','phone_change_token','reauthentication_token')
ORDER BY column_name;

-- 2) حساب رنا جبار ابراهيم: رقمها الوظيفي وصفها في auth.users
SELECT p.job_number, p.full_name,
       u.id AS auth_id, u.email,
       u.confirmation_token IS NULL AS ct_null,
       u.recovery_token IS NULL AS rec_null,
       u.email_change IS NULL AS ec_null,
       u.email_change_token_new IS NULL AS ecn_null,
       u.email_change_token_current IS NULL AS ecc_null,
       u.phone_change IS NULL AS pc_null,
       u.phone_change_token IS NULL AS pct_null,
       u.reauthentication_token IS NULL AS rat_null
FROM profiles p
LEFT JOIN auth.users u ON u.email = p.job_number || '@inftele.com'
WHERE p.full_name LIKE '%رنا%';

-- 3) عدّاد النساء؟ لا — عدّاد الصفوف ذات reauthentication_token NULL فقط (لتغطيتها بالإصلاح إن وجدت)
SELECT count(*) AS rat_null_count FROM auth.users WHERE reauthentication_token IS NULL;
