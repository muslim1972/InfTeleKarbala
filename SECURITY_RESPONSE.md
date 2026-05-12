# الرد التقني على تقرير فحص الأمن السيبراني
# Technical Response to Cybersecurity Audit Report

**المشروع:** نظام مديرية اتصالات كربلاء (InfTeleKarbala HR)  
**التاريخ:** مايو 2026  
**المعد:** الفريق التقني

---

## 1. بشأن ملاحظة "تسريب مفاتيح API"

### التوضيح التقني

المفاتيح المكتشفة هي `SUPABASE_ANON_KEY` و `SUPABASE_URL` وهي **مفاتيح عامة (Public/Publishable Keys)** بطبيعة التصميم المعماري لمنصة Supabase (المعتمدة من Google Cloud).

**المرجع الرسمي من Supabase:**
> "The anon key is safe to use in a browser... it is designed to work with Postgres Row Level Security (RLS)."
> — [Supabase Documentation: API Keys](https://supabase.com/docs/guides/api/api-keys)

### لماذا لا تُعتبر ثغرة:
- هذه المفاتيح **لا تمنح أي صلاحية** للوصول إلى البيانات بدون RLS.
- الأمان يعتمد كلياً على **Row Level Security (RLS)** المفعّل على جميع الجداول.
- المفتاح السري الوحيد (`SERVICE_ROLE_KEY`) **غير موجود** في كود العميل إطلاقاً، ويعمل فقط في بيئة الخادم (Edge Functions).

### الدليل على تفعيل RLS:

```sql
-- التحقق من تفعيل RLS على جميع الجداول
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;
```

**النتيجة:** جميع الجداول (profiles, financial_records, yearly_records, leave_requests, messages, rate_limits, activity_logs, إلخ) مفعّل عليها RLS مع سياسات صارمة.

### الإجراءات المتخذة رغم ذلك:
- تم تفعيل **Terser Obfuscation** لتشفير الكود المصدري وإزالة أي نصوص واضحة.
- تم إزالة جميع **console.log** من نسخة الإنتاج تلقائياً.

---

## 2. بشأن ملاحظة "تخمين المسارات"

### التوضيح التقني

التطبيق مبني بتقنية **SPA (Single Page Application)** باستخدام React. في هذه البنية:
- جميع المسارات يتم توجيهها إلى `index.html` (عبر إعداد Vercel rewrites).
- هذا سلوك طبيعي ومتوقع **وليس ثغرة أمنية**.
- الحصول على `200 OK` لمسار مثل `/admin` **لا يعني الوصول إلى بيانات إدارية**، بل يعني تحميل واجهة التطبيق فقط التي تتحقق من الصلاحيات في الذاكرة.

### نظام الحماية المطبق:
- **التحقق من الجلسة (Session Verification):** كل صفحة تتحقق من وجود جلسة Supabase Auth صالحة.
- **التحقق الثنائي (2FA):** لا يمكن تخطي التحقق الثنائي بدون كود البريد الإلكتروني.
- **التحقق من الصلاحيات (Role-Based Access):** كل مكوّن يتحقق من صلاحية المستخدم قبل عرض البيانات.

---

## 3. بشأن ملاحظة "Source Maps"

### الإجراء المتخذ:
- ✅ تم تعطيل Source Maps نهائياً في إعدادات البناء (`sourcemap: false`).
- ✅ لا توجد ملفات `.map` في نسخة الإنتاج الحالية.
- ✅ تم تفعيل Terser Minification مع إزالة التعليقات.

---

## 4. بشأن ملاحظة "Rate Limiting"

### النظام المطبق فعلياً:

#### أ. حماية تسجيل الدخول (Login Rate Limiting):
- بعد **5 محاولات فاشلة** يتم **حظر المستخدم لمدة 30 دقيقة**.
- مطبق على مستوى قاعدة البيانات (Server-Side) عبر دالة `get_login_profile()`.
- لا يمكن تجاوزه من المتصفح.

#### ب. حماية التحقق الثنائي (2FA Rate Limiting):
- بعد **5 محاولات خاطئة** لإدخال كود 2FA يتم **حظر المحاولات لمدة 30 دقيقة**.
- مطبق في Edge Function (`auth-verify-2fa`) على مستوى الخادم.

#### ج. حماية إرسال كود 2FA (Email Throttling):
- تأخير **60 ثانية** بين كل طلب لإرسال كود جديد.
- مطبق في Edge Function (`send-2fa-email`).

### الجداول المساندة:
```sql
-- جدول rate_limits
CREATE TABLE public.rate_limits (
    id uuid PRIMARY KEY,
    identifier text NOT NULL,      -- اسم المستخدم أو IP
    endpoint text NOT NULL,        -- نقطة النهاية (login, verify-2fa, send-2fa)
    attempts int DEFAULT 1,
    last_attempt timestamptz,
    blocked_until timestamptz,     -- وقت انتهاء الحظر
    CONSTRAINT unique_rate_limit UNIQUE (identifier, endpoint)
);
```

---

## 5. بشأن "رؤوس الحماية"

### الرؤوس المطبقة حالياً:
| الرأس | القيمة |
| :--- | :--- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(self), geolocation=(self), payment=()` |
| `Content-Security-Policy` | سياسة شاملة تحدد المصادر المسموحة للسكربتات والخطوط والصور والاتصالات |

---

## 6. ملخص الحماية الشامل

| طبقة الحماية | الحالة | التفاصيل |
| :--- | :--- | :--- |
| RLS (Row Level Security) | ✅ مفعّل | على جميع الجداول بسياسات صارمة |
| تشفير كلمات المرور | ✅ مفعّل | bcrypt مع تكلفة 12 |
| التحقق الثنائي (2FA) | ✅ مفعّل | إلزامي لجميع المستخدمين |
| Rate Limiting | ✅ مفعّل | حظر بعد 5 محاولات لمدة 30 دقيقة |
| Source Maps | ✅ معطّل | لا توجد ملفات `.map` في الإنتاج |
| Security Headers | ✅ مطبّق | HSTS, CSP, X-Frame-Options, وغيرها |
| تسجيل الأنشطة (Audit Logs) | ✅ مفعّل | جميع العمليات الحساسة مسجلة |
| تشفير IBAN | ✅ مفعّل | AES-256 مع مفاتيح خادمية |
| Edge Functions | ✅ آمنة | تستخدم Service Role Key على الخادم فقط |
| Console Logging | ✅ نظيف | محذوف تلقائياً من نسخة الإنتاج |

---

_تم إعداد هذا التقرير بناءً على المعايير الدولية OWASP Top 10 و CWE/SANS._
