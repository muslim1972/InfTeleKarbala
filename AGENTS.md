# قواعد مشروع InfTeleKarbala — تُطبَّق تلقائياً في كل جلسة

تطبيق إنتاجي: مديرية اتصالات كربلاء (Next.js/React + Supabase). مستخدمون حقيقيون — كل تعديل يُتابَع أثره في كامل التطبيق.

## سير النشر المعتمد (الوحيد — لا تخترع بديلاً)

1. **فحص الأنواع (إجباري قبل أي بناء):**

```powershell
npx tsc --noEmit -p tsconfig.app.json
```

> تحذير 1: `vite build` لا يفحص الأنواع — بناء بدون tsc سبّب انهيارات إنتاجية (`showGeoHelp is not defined`، `useCallback is not defined`، `ChevronLeft is not defined`).
> تحذير 2: `npx tsc --noEmit` **بدون** `-p tsconfig.app.json` معطوب في هذا المشروع — tsconfig الجذر solution-style (`files: []` + `references`) فيمرّ دون فحص أي ملف. أمر الفحص الصحيح يستهدف `tsconfig.app.json` حصراً.
> ملاحظة: الكودBase يحوي أخطاء أنواع تاريخية (~150) — حتى معالجتها بالكامل، يُقارن فحص tsc بالسجل المعروف: يُلزم ألّا تظهر أخطاء جديدة في الملفات المعدَّلة (خاصة TS2304 معرّف غير معرّف)، لا أن يكون العدّ صفراً.

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

#### ملفات النشر المعتمدة

| الملف | الوظيفة |
|---|---|
| `scripts\deploy-dist.ps1` | سكربت النشر الوحيد (مقارنة+رفع+تحقق) |
| `scripts\dist-cmp-remote.sh` | مقارنة MD5 تُنفَّذ على VPS (يستدعيه deploy-dist.ps1) |
| `scripts\runtime-check.sh` | فحص تشغيلي يدوي للخادم |

> ممنوع إنشاء سكربتات رفع جديدة. أي تحسين يكون بتعديل الملفات أعلاه فقط.
> (سُحبت `upload_dist.bat` و `compare-dist.ps1` لأن الرفع الأعمى يهدر النطاق وفحص الحجم معطوب.)

#### أدوات الذكاء — تحليل ملف الراتب الشهري (`scripts\AI Scrept`)

أدوات Node محلية 100% (لا تلمس VPS) لفهم ملف إكسل الرواتب قبل الحقن وبناء الوكيل الذكي:

| الملف | الوظيفة |
|---|---|
| `scripts\AI Scrept\dump-salary-excel.mjs` | تفريغ بنية الملف (structure.txt + full.json) |
| `scripts\AI Scrept\analyze-salary-excel.mjs` | فحص ~20 علاقة حسابية على كل الصفوف (findings.txt) |
| `scripts\AI Scrept\probe-salary-excel.mjs` | حلّ الألغاز المفتوحة (probe.txt) |
| `scripts\AI Scrept\probe2-salary-excel.mjs` | فك قواعد الهندسية/القانونية والتقاطعات (probe2.txt) |
| `scripts\AI Scrept\flags-salary-excel.mjs` | جرد كل سجل غير مطابق/عليه ملاحظة بأرقام صفوفه (flags.txt) |

الاستخدام (مخرجات في مجلد مؤقت):

```powershell
node "scripts\AI Scrept\analyze-salary-excel.mjs" "F:\صور للتجربة\نظام المديرية\excel\2026 - راتب شهر 8.xlsx" "C:\Users\SAM-Tech\AppData\Local\Temp\sal8"
```

> اقرأ هذا القسم قبل أي عمل على حقول الإدارة/المالية — العلاقات المؤكدة المستخلصة: الصافي=الإجمالي−الاستقطاعات (336/336)، التقاعد=10% الاسمي، الحماية الاجتماعية=0.25%، الشهادة/الخطورة/الهندسية(35%)/القانونية(30%)/المنصب = الاسمي×النسبة، علاوة السائقين 87500 غير مفصّلة، وتفوات جميع المخصصات = نمط اجازة 5 سنوات، وفوق المرحلة 11 زيادة معامل ثابت لكل درجة (الدرجة الأولى +20000).

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
