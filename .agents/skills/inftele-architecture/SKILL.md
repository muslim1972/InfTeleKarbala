---
name: inftele-architecture
description: MUST be read at the start of EVERY session on InfTeleKarbala and before ANY code/DB change. Holds the numbered brick architecture, current progress, decisions log, and the fixed rules that prevent regressions. Must be UPDATED (append, never erase) at the end of every meaningful step.
metadata:
  version: "0.6.0"
  last_updated: "2026-10-09"
---

# InfTeleKarbala — ذاكرة المشروع المعمارية (اقرأها أولاً في كل جلسة)

## 0. واجب التحديث (إلزامي)
- عند إنجاز أي خطوة يُعتد بها: **حدّث هذا الملف** — أضف إلى «سجل التقدم» و«سجل القرارات»، حدّث «الحالة الحالية» و«الخطوة التالية»، وارفع `version`.
- **لا تحذف** أي سطر سابق من السجلات؛ التصحيح يكون بسطر جديد يشير للقديم.
- حدّث معه `bricks/BRICKS.md` (حالة الطابوقة) ثم commit + وسم Git للطابوقة المستقرة.

## 1. مراجع إلزامية (بالترتيب)
1. `D:\InfTeleKarbala\AGENTS.md` — سير النشر والضوابط (الجذر الوحيد: `D:\InfTeleKarbala`).
2. `bricks/ARCHITECTURE.md` — المخطط المعماري والترقيم والمجالات.
3. `bricks/BRICKS.md` — سجل الطابوق وحالاتها.
4. `bricks/<ID>/BRICK.md` — عقد الطابوقة قبل لمس أي ملف تملكه.

## 2. الضوابط الثابتة
- الردود بالعربية، موجزة. لا `setTimeout` لمزامنة الواجهة/التركيز.
- قبل البناء: `npx tsc --noEmit -p tsconfig.app.json` — لا أخطاء جديدة في الملفات المعدلة.
- البناء `npm run build` ثم النشر **فقط** `scripts\deploy-dist.ps1` (SAME=الكل، DIFF=0، MISSING=0) + فحص HTTP 200. لا سكربتات رفع جديدة، لا حذف chunks قديمة.
- SQL على VPS عبر plink: رفع الملف بـ pscp إلى `/tmp/` ثم `bash /tmp/runsql.sh /tmp/x.sql` (psql داخل حاوية supabase-db).
- **لا تعديل منطق بلا عقد**: القاعدة تُكتب في BRICK.md (R#) بمصدرها، ويوقّع المستخدم، ثم اختبار (T#)، ثم كود.
- **لا تفترض**: أي غموض في قاعدة عمل يُسأل عنه المستخدم ويُسجّل في «سجل القرارات».
- المخططات (flowcharts) في `F:\صور للتجربة\نظام المديرية\` هي مصدر الحقيقة لمنطق الحضور.
- العزل: مجال لا يقرأ جداول/ملفات مجال آخر إلا عبر واجهته العامة.
- الأمن: الحفاظ على صفر ثغرات ZAP؛ دوال DB الداخلية `REVOKE` من anon/authenticated، والمكشوف للعميل غلاف `SECURITY DEFINER` يتحقق من `auth.uid()`.

## 3. الحالة الحالية
- **المرحلة:** M1 (الجرد) — البند 1 مكتمل، البند 2 مكتمل للنواة CORE.
- **أُنجز:** ARCHITECTURE.md (معتمد)، BRICKS.md، هذا الـSkill، مسودة عقد BE-ATT-04، أرشفة المؤقتات، قواعد AGENTS.md.
- ~~أولوية أمنية~~ ✓ مكتملة 2026-10-09 (المراحل 1–3). متبقٍّ أمنياً (غير عاجل): P6 pageinspect، P10 كلمة سر VPS في Git، سياسات RLS للجداول (لم تُراجع بعد).
- **⟵ العودة للخطة (إلزامي بعد الأمن):** استئناف M1 البند 2: عقود المجالات بالترتيب ATT ← LEV ← HR ← FIN ← INC ← PRO ← TRN ← COM ← MED ← FIB ← SPL، ثم البند 3 (مجلدات الجذر)، ثم M2.
- **الخطوة التالية (M1):** ~~(1) جرد BE~~ ✓. (2) [النواة ✓؛ الباقي: ATT، LEV، HR، FIN، INC، PRO، TRN، COM، MED، FIB، SPL] عقد وصفي مختصر BRICK.md لكل طابوقة FE/BE (ما هو قائم فعلاً، الواجهة العامة، الاعتماديات). (3) جرد مجلدات الجذر المتبقية (Q5).

## 4. سجل التقدم (إلحاق فقط)
| التاريخ | الخطوة | الطابوقة | ملاحظة |
|---|---|---|---|
| 2026-10-09 | سبلاش فيديو جديد ونشره (SAME=353) | SPL | القديم محفوظ `SplashScreenLegacy.tsx` |
| 2026-10-09 | دوال roster_evaluate_* + pg_cron كل دقيقة (جزئي: غياب وتأخر >60د فقط) | BE-ATT-04 | `scripts/sql/roster_engine.sql`؛ العميل يحيل المناوب لـ `roster_evaluate_me` |
| 2026-10-09 | فحص عطلة خفيف `fetchDayType` + مهلة رفع صورة 8ث | FE-ATT | نشر SAME=353 |
| 2026-10-09 | بدء إعادة الهيكلة: ARCHITECTURE/BRICKS/Skill | OPS | M0 |
| 2026-10-09 | أرشفة 352 ملفاً مؤقتاً من الجذر و scripts/ إلى `_archive/<النوع>/<root|scripts>/` (بلا حذف)، سجل `_archive/MOVE_LOG.txt`، و`_archive/builds/` في .gitignore | OPS-01 | الجذر الآن ملفات الإعداد فقط |
| 2026-10-09 | AGENTS.md: شرط «لا مجاملة» + قاعدة المؤقتات | OPS | |
| 2026-10-09 | commit + وسم `m0-foundation` | OPS | |
| 2026-10-09 | الحارس `scripts/verify-bricks.mjs` + `bricks/registry.json` (23 طابوقة، تغطية src 100% = 301 ملف) + `bricks/fingerprints.json` (309 بصمة). اختُبر: كشف ملكية مزدوجة حقيقية، وكشف فقدان shiftRules.ts باسم FE-ATT-01. أُضيف كخطوة 0 في سير النشر | OPS-03 | M0 مكتمل |
| 2026-10-09 | M1 جرد BE: 21 طابوقة خلفية في registry.json (حقول db/tables/edge/buckets). الحارس `--db` يقارن مع الخادم: db=108/108، tables=74/74، buckets=9/9. اختُبر سلبياً (دالة وهمية ⇒ فشل باسم الطابوقة). أدوات `scripts/ops/runsql.sh` و`db-inventory.sql` (لا تعتمد على /tmp). `CLAUDE.md`/`GEMINI.md` تحيل لـ AGENTS.md لأي وكيل | OPS-03, BE-* | M1 بند 1 مكتمل |
| 2026-10-09 | **ثغرة حرجة أُغلقت (مرحلة 1):** 14 دالة DEFINER كانت متاحة لـ anon عبر النطاق العام khr-itpc.egov.iq، أخطرها `rpc_sync_user_auth` (تغيير كلمة سر أي حساب). سُحب anon بهجرة `supabase/migrations/20261009223700_core03_revoke_anon_sensitive_rpcs.sql` (+ دوال اللقطات الشهرية مالكها supabase_admin نُفذت بـ `psql -U supabase_admin`). تحقق REST: anon⇒401، get_server_time⇒200 | BE-CORE-03 | المرحلة 2 مفتوحة |
| 2026-10-09 | عقود وصفية للنواة: BE-CORE-02، BE-CORE-03، BE-CORE-support (01/04/05/06)، FE-CORE (01..05) + ربطها في registry (حقل contract). الحارس صار يقرأ `**T#**` أيضاً | CORE | M1 بند 2 (النواة) مكتمل |
| 2026-10-09 | **الأمن المرحلة 2+3 مكتملة** (انظر سجل BE-CORE-03): أغلفة فحص دور `core_require_role` + سحب anon الشامل (القائمة المسموحة في الهجرة). `NOTIFY pgrst, 'reload schema'` بعد أي إنشاء/تسمية دالة. runsql.sh يقبل وسيطاً ثانياً لمستخدم DB (supabase_admin) | BE-CORE-03 | بانتظار فحص المستخدم الوظيفي |
| 2026-10-09 | **تصحيح صدق:** ذكرتُ سابقاً «حفظت في Git» والمقصود commit محلي فقط — لم يُدفع لـ GitHub. محاولة `git push` من الوكيل تعلق بانتظار مصادقة GitHub، فالدفع يتم من المستخدم. من الآن: أقول «commit محلي» صراحةً | OPS | |

## 5. سجل القرارات (إلحاق فقط)
| # | القرار | المصدر |
|---|---|---|
| D1 | قيد إجازة إجبارية واحد لكل تاريخ، `days_count` = مجموع الوحدات | المستخدم 2026-10-09 |
| D2 | المناوب بلا سماحية: صباحي 08–15، مسائي 15–20، خفر 20–08 | المستخدم 2026-10-09 |
| D3 | الثابت: سماحية وزارية 08:00–08:30 دخولاً و14:30–15:00 خروجاً؛ المحاسبة من 08:31 ومن 14:29 نزولاً | المستخدم 2026-10-09 |
| D4 | بصمتا منتصف الليل للخفر (23:59/00:01) مرونة ±30د وليست سماحية | المستخدم 2026-10-09 |
| D5 | الخفر = وحدتان (يومان)، النصف الثاني يُنسب لليوم السابق | flowcharts2 |
| D6 | الإجازة الإجبارية لا تُلغى ببصمة لاحقة؛ البصمة اللاحقة تحذف الافتراضية وتضيف ملاحظة «خروج بعد ساعات العمل» | المستخدم 2026-10-09 |
| D7 | إعادة الهيكلة بالطابوق المرقم تشمل التطبيق كاملاً (BE + FE + OPS) | المستخدم 2026-10-09 |
| D8 | المخطط المعماري معتمد؛ البناء يبدأ من أساس الهيكل (M0) لا من ميزة | المستخدم 2026-10-09 |
| D9 | المؤقتات تُؤرشف حسب النوع في `_archive/` ولا تُحذف (قيمة تاريخية لدوال DB) | المستخدم+التوصية 2026-10-09 |
| D10 | لا مجاملة: الصحيح تقنياً يحكم، والاعتراض صريح مع البديل | المستخدم 2026-10-09 |

## 6. أسئلة مفتوحة (تُغلق بقرار في §5)
- Q1 المناوب: تأخير 1–4د بلا محاسبة أم من الدقيقة 1؟
- Q2 حدّ تحويل التأخير لإجازة: 60د أم 120د؟
- Q3 خروج مبكر من الخفر قبل 08:00: على النصف الثاني فقط؟
- ~~Q4~~ أُغلق بـ D9.
- Q5 مجلدات جذر مؤقتة متبقية (tmp/, scratch/, .work/, sql-files/, database/, pg/, pg17/) — تُجرد في M1.

## 6.0 مشاكل أمنية/تقنية مرصودة (لا مجاملة)
- P6 امتداد `pageinspect` في المخطط public (يكشف صفحات التخزين) — يُنقل/يُحذف في BE-CORE-03.
- P10 كلمة سر VPS مكتوبة نصاً في AGENTS.md وملتزمة في Git — يُوصى بنقلها لمتغير بيئة `VPS_PW` ومفتاح SSH بدل كلمة السر، وتغييرها. (الحارس يقرأ `VPS_PW` أولاً.)
- P11 دالة `debug_modify_check` وبقايا `reset_test_attendance*` في الإنتاج.
- P13 تشابكات عزل مرصودة: NotificationsBell يقرأ meeting_participants (COM)؛ مشغلات الأقسام تكتب في work_locations (ATT-07)؛ AuthContext يرفع avatar (HR)؛ لا دالة إشعار مركزية (كل مجال يحدد المشرفين بنفسه).
- P14 دوال قراءة مكشوفة لـ anon قد تسرّب بيانات موظفين: get_available_profiles، search_available_profiles، get_basic_profiles، get_managed_employees، kiosk_get_employees، get_promotion_users، check_user_exists (تعداد أسماء).
- P15 فخ: دوال مالكها supabase_admin لا يستطيع postgres تعديل صلاحياتها — نفّذ بـ `docker exec -i supabase-db psql -U supabase_admin`.
- P12 overloads: submit_leave_request×3، modify_leave_request×2، process_leave_approval×2، set_promotion_permission×2، authenticate_training_student×2.

## 6.1 كيف يعمل الحارس (OPS-03)
- `registry.json`: لكل طابوقة `owns` (ملف أو مجلد) و`db` (دوال) و`contract`.
- أخطاء تُفشل: ملف مملوك مفقود، ملكية مزدوجة، عقد مفقود، ملف مسجل في البصمات اختفى (مع أمر الاسترجاع).
- تحذيرات: ملف src غير منسوب، قاعدة R# لا يذكرها أي صف اختبار T#، ملفات تغيّرت عن البصمة.
- ملف جديد ⇒ أضفه لطابوقته في registry.json. بعد اعتماد تغيير ⇒ `--snapshot`.
- `--db`: يرفع `scripts/ops/*` إلى /tmp ويقارن الدوال/الجداول/buckets المسجلة بالخادم. دالة/جدول جديد في DB ⇒ أضفه لحقل db/tables لطابوقته.

## 7. فخاخ معروفة
- Git: الوكيل يعمل commit محلياً فقط؛ `git push` يحتاج مصادقة GitHub من المستخدم (لا تدّعِ الدفع).
- بعد إنشاء/إعادة تسمية دالة DB: `NOTIFY pgrst, 'reload schema';` وإلا يفشل استدعاؤها من الواجهة.
- PowerShell 5.1 يُسقط التنصيص المزدوج في أوامر plink — اكتب منطق shell في ملف `.sh`.
- `npx tsc --noEmit` بدون `-p tsconfig.app.json` لا يفحص شيئاً.
- `vite build` لا يفحص الأنواع.
- psql المباشر على 5432 يفشل (Supavisor) — استخدم runsql.sh.
- في plpgsql: `arr || 'نص'` يفشل؛ استخدم `array_append(arr, 'نص'::text)`.
