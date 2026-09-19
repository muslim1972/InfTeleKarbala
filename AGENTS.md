# قواعد مشروع InfTeleKarbala — تُطبَّق تلقائياً في كل جلسة

تطبيق إنتاجي: مديرية اتصالات كربلاء (Next.js/React + Supabase). مستخدمون حقيقيون — كل تعديل يُتابَع أثره في كامل التطبيق.

## سير النشر المعتمد (الوحيد — لا تخترع بديلاً)

1. **فحص الأنواع (إجباري قبل أي بناء):**

```powershell
npx tsc --noEmit
```

> تحذير: `vite build` لا يفحص الأنواع — بناء بدون tsc سبّب انهيار إنتاجي (`showGeoHelp is not defined`).

2. **البناء:**

```powershell
npm run build
```

3. **النشر (مقارنة MD5 → رفع المتغيّرات فقط → تحقق نهائي):**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\InfTeleKarbala\scripts\deploy-dist.ps1
```

- يقارن dist القرص مع VPS ببصمات MD5، يرفع الجديد/المتغيّر فقط، ويعيد المقارنة (المطلوب: SAME=الكل).
- **الـ chunks القديمة تبقى على VPS** لتوافق كاش المستخدمين — لا تحذفها أثناء النشر.
- الملفات المولَّدة تُكتب في `%TEMP%\ftth-deploy` — لا مخلفات في scripts/.

4. **SQL على DB (PuTTY على VPS — ليس محلياً):**

```powershell
& 'C:\Program Files\PuTTY\plink.exe' -batch -pw 'mu@ITPC@2026' muslim@10.56.3.3 'psql -U postgres -d postgres -f /path/script.sql'
```

5. **فحص تشغيلي عند الشك** (يُرفع ثم يُنفَّذ على VPS): `scripts\runtime-check.sh`

## ملفات النشر المعتمدة

| الملف | الوظيفة |
|---|---|
| `scripts\deploy-dist.ps1` | سكربت النشر الوحيد (مقارنة+رفع+تحقق) |
| `scripts\dist-cmp-remote.sh` | مقارنة MD5 تُنفَّذ على VPS (يستدعيه deploy-dist.ps1) |
| `scripts\runtime-check.sh` | فحص تشغيلي يدوي للخادم |

> ممنوع إنشاء سكربتات رفع جديدة. أي تحسين يكون بتعديل الملفات أعلاه فقط.
> (سُحبت `upload_dist.bat` و `compare-dist.ps1` لأن الرفع الأعمى يهدر النطاق وفحص الحجم معطوب.)

## معطيات VPS

- التطبيق: `muslim@10.56.3.3:/home/muslim/inftelekarbala/dist` (PuTTY: plink/pscp)
- DB على نفس VPS عبر PuTTY — user=muslim / password=mu@ITPC@2026
- فخ quoting: PowerShell 5.1 يُسقط علامات التنصيص المزدوجة في أوامر plink البعيدة — اكتب منطق shell المعقّد في سكربت `.sh` يُرفع بـ pscp ثم يُنفَّذ.

## ضوابط ثابتة (في كل مراحل العمل)

1. اعتماد ممارسات `D:\InfTeleKarbala\.agents\skills\vercel-react-best-practices`
2. معرفة شاملة بجوانب التطبيق — تتبّع أثر أي تعديل على كامل التطبيق
3. العزل بين الميزات: ملفات وخطافات معزولة لكل ميزة
4. أعلى معايير الأمن السيبراني (سجل ZAP: صفر ثغرات — الحفاظ عليه)
5. الرد دون تأخير
6. ملخص أي نشر: أرقام المقارنة (SAME/DIFF/MISSING) + فحص تشغيلي
