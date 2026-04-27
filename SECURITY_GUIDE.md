# دليل الأمان السيبراني الشامل
# Comprehensive Cybersecurity Guide

## تقرير الثغرات الأمنية المكتشفة

### 1. تسريب المفاتيح السرية في ملفات البناء

**الخطورة:** 🔴 عالية جداً

**الوصف:**
تم اكتشاف أن مفاتيح Supabase الحساسة (VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY) تظهر في ملفات JavaScript المُجمّعة (bundle files) بنص واضح.

**السبب:**
Vite يقوم بتضمين متغيرات البيئة التي تبدأ بـ `VITE_` في ملفات البناء للوصول إليها من المتصفح.

**الملفات المتأثرة:**
- `dist/assets/*.js`

---

## الحلول المطبقة

### ✅ 1. سياسات RLS الآمنة

**الملف:** `sql-files/secure_rls_policies.sql`

تم إنشاء سياسات أمان شاملة تشمل:
- دالة `is_admin()` آمنة مع `SECURITY DEFINER`
- سياسات منفصلة لكل جدول (SELECT, INSERT, UPDATE, DELETE)
- منع الوصول غير المصرح للبيانات الحساسة

**التطبيق:**
```sql
-- تنفيذ الملف في Supabase SQL Editor
\i sql-files/secure_rls_policies.sql
```

### ✅ 2. تشفير كلمات المرور

**الملف:** `sql-files/secure_password_encryption.sql`

تم إنشاء:
- دالة `hash_password()` باستخدام bcrypt (تكلفة 12)
- دالة `verify_password()` للتحقق
- دالة `authenticate_user()` للمصادقة الآمنة
- دالة `change_password()` لتغيير كلمة المرور

**التطبيق:**
```sql
-- تفعيل امتداد التشفير
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- تنفيذ الملف
\i sql-files/secure_password_encryption.sql
```

### ✅ 3. نقل التفويض للخادم

**الملفات:**
- `supabase/functions/auth-login/index.ts`
- `supabase/functions/auth-change-password/index.ts`

تم إنشاء Edge Functions تعمل على الخادم:
- المصادقة تتم على الخادم (ليس في المتصفح)
- استخدام `SUPABASE_SERVICE_ROLE_KEY` (لا يُرسل للمتصفح)
- إرجاع فقط البيانات الضرورية للمستخدم

---

## خطوات التطبيق

### المرحلة 1: تطبيق سياسات RLS

1. افتح Supabase Dashboard
2. اذهب إلى SQL Editor
3. انسخ محتوى `sql-files/secure_rls_policies.sql`
4. نفذ الاستعلام

### المرحلة 2: تفعيل تشفير كلمات المرور

1. افتح Supabase Dashboard
2. اذهب إلى SQL Editor
3. انسخ محتوى `sql-files/secure_password_encryption.sql`
4. نفذ الاستعلام
5. قم بترحيل كلمات المرور الموجودة

### المرحلة 3: نشر Edge Functions

```bash
# تثبيت Supabase CLI
npm install -g supabase

# تسجيل الدخول
supabase login

# ربط المشروع
supabase link --project-ref <your-project-ref>

# نشر الدوال
supabase functions deploy auth-login
supabase functions deploy auth-change-password
```

### المرحلة 4: تحديث كود الواجهة الأمامية

```typescript
// بدلاً من الاتصال المباشر بقاعدة البيانات
// استخدم Edge Functions

// تسجيل الدخول
const response = await fetch('/functions/v1/auth-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ job_number, password })
});
const { user } = await response.json();

// تغيير كلمة المرور
const response = await fetch('/functions/v1/auth-change-password', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ user_id, old_password, new_password })
});
```

---

## توصيات إضافية

### 1. إدارة المفاتيح السرية

```env
# .env (محلي - لا ترفعه لـ Git)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx

# Supabase Dashboard (Edge Functions Secrets)
SUPABASE_SERVICE_ROLE_KEY=xxx
```

### 2. تحديث .gitignore

```gitignore
# Environment variables
.env
.env.local
.env.*.local
*.pem

# Build files with secrets
dist/
build/

# Supabase
.supabase/
```

### 3. تفعيل المصادقة الثنائية (2FA)

```sql
-- إضافة عمود للمصادقة الثنائية
ALTER TABLE app_users ADD COLUMN two_factor_enabled boolean DEFAULT false;
ALTER TABLE app_users ADD COLUMN two_factor_secret text;
```

### 4. تسجيل الأنشطة

```sql
-- جدول لتسجيل الأنشطة
CREATE TABLE activity_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES app_users(id),
  action text NOT NULL,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT NOW()
);

-- تفعيل التسجيل
CREATE OR REPLACE FUNCTION log_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO activity_logs (user_id, action, details)
  VALUES (auth.uid(), TG_OP, to_jsonb(NEW));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 5. تحديد معدل الطلبات (Rate Limiting)

```typescript
// في Edge Function
const RATE_LIMIT = 5; // 5 طلبات لكل دقيقة
const rateLimiter = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const requests = rateLimiter.get(ip) || [];
  const recent = requests.filter(t => t > now - 60000);
  
  if (recent.length >= RATE_LIMIT) return false;
  
  recent.push(now);
  rateLimiter.set(ip, recent);
  return true;
}
```

---

## قائمة التحقق الأمنية

- [x] تفعيل RLS على جميع الجداول
- [x] إنشاء سياسات وصول صارمة
- [x] تشفير كلمات المرور بـ bcrypt
- [x] نقل المصادقة للخادم
- [ ] تفعيل HTTPS
- [ ] إضافة Rate Limiting
- [ ] تفعيل تسجيل الأنشطة
- [ ] إجراء فحص أمني دوري
- [ ] إضافة المصادقة الثنائية

---

## جهات الاتصال للطوارئ

في حالة اكتشاف خرق أمني:
1. إيقاف النظام فوراً
2. تغيير جميع المفاتيح السرية
3. مراجعة سجلات الأنشطة
4. إبلاغ المستخدمين المتأثرين

---

*آخر تحديث: 2026-04-27*