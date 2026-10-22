---
name: brick-governance-framework
description: The B.R.I.C.K. Architectural Governance Framework and Deterministic Sentinel Engine for Human-AI Hybrid Software Engineering. Authored by Eng. Muslim A. Abdul-Hassan (Karbala Telecommunication & Informatics Directorate). Must be read and followed by any developer or AI assistant before adding, modifying, or refactoring code, files, or database schemas in this enterprise system.
metadata:
  version: "1.0.0"
  author: "Muslim A. Abdul-Hassan (Lead Software Systems Engineer & Architect)"
  institution: "Karbala Telecommunication and Informatics Directorate"
  date: "October 2026"
---

# إطار B.R.I.C.K ومحرك الإنفاذ الحتمي
## The B.R.I.C.K. Architectural Governance Framework & Deterministic Sentinel Engine

> **حكومة المعمارية البرمجية عبر الطبقات وضبط بيئات التطوير الهجين بين الإنسان والذكاء الاصطناعي**
> *A Deterministic Architectural Governance Framework for Human-AI Hybrid Software Engineering Across Distributed and Air-Gapped Environments*

---

## 1. المدخل والمشكلة الهندسية (The Genesis & Problem Formulation)
يقف تطوير البرمجيات المعاصرة عند مفترق طرق تاريخي: فبينما يواجه العقل البشري حدوده الإدراكية الطبيعية وتراكم ما يُعرف بـ **«الدَّيْن التقني المعماري» (Architectural Technical Debt)**، أصبح اللجوء إلى نماذج ووكلاء الذكاء الاصطناعي التوليدي حقيقة واقعة لا فكاك منها.

غير أن هذا النمط الهجين يفرز تحدياً مزدوجاً وخطيراً يُعرّف بـ:
### مفارقة التعرض المزدوج (The Dual-Vulnerability Paradox):
1. **المطور البشري (Human Cognitive Decay):** يمتلك الرؤية المعمارية والمنطق الغائي، ولكنه يقع فريسة للإجهاد، وضعف الذاكرة اللحظية، والقصور عن إدراك العواقب الجانبية لتعديلاته السريعة عبر مئات الملفات، مما يسبب **الانهيارات العكسية الصامتة (Silent Regression)**.
2. **وكيل الذكاء الاصطناعي (AI Stochastic Hallucination):** يمتلك سرعة استثنائية وقدرة على معالجة الأنماط، لكنه محكوم بطبيعته الاحتمالية غير القطعية (*Stochastic Nature*)، ومقيد بـ «نافذة سياق» (*Context Window*) تجعله يفقد الرؤية الكلية للنظام، فيميل إلى **الهلوسة البرمجية**، وتعديل ملفات عامة حساسة لتمرير طلب موضعي عابر، وتوليد ملفات وسيطة سائبة (*Orphan Files*)، وكسر التوافق التام مع قواعد البيانات الحية.

---

## 2. النمذجة الصورية للأكواد: أنوية B.R.I.C.K السيادية
يقوم إطار عمل B.R.I.C.K على تجزئة النظام إلى **أنوية وظيفية سيادية (Sovereign Architectural Kernels)** عابرة للطبقات، حيث يمثل اسمه اختصاراً لخمسة محددات حتمية:

| الحرف | المحدد الإنجليزي | المفهوم الهندسي والوظيفي | الأثر في ضبط المعمارية |
|:---:|:---|:---|:---|
| **B** | **Bounded** | مقيدة وظيفياً ضمن سياق نطاق محدد (*Bounded Context*) | منع تشابك المسؤوليات وتحديد حدود المجال بصرامة وفق مبادئ التصميم الموجه بالنطاق (DDD). |
| **R** | **Reliable** | موثوقة تعاقدياً بربط القواعد $R\#$ بالاختبارات $T\#$ | ضمان أن كل منطق عمل مجرد يخضع لاختبار تحقق مؤتمت يبرهن صحته. |
| **I** | **Immutable** | غير قابلة للتغيير العشوائي ومحمية ببصمة تشفيرية (SHA-256) | كشف أي تعديل جانبي غير مصرح به لحظياً وتوليد أمر استرجاعه الفوري. |
| **C** | **Cross-layer** | ممتدة عابرة لكامل الطبقات (*Full-Stack Unit*) | توحيد مكونات الواجهة، ودوال الخادم RPC، والجداول، وحاويات التخزين في وحدة واحدة. |
| **K** | **Kernels** | أنوية برمجية مستقلة ذات حيازة حصرية مطلقة | حظر التداخل والملكية المزدوجة، وفرض التغطية الشاملة ومنع الأيتام بنسبة 100%. |

### التعريف الرياضي لنواة B.R.I.C.K:
تُعرّف كل نواة معمارية $B_i$ كسداسية صورية مرتبة رياضياً:
$$B_i = \langle ID_i, D_i, L_i, F_i, S_i, C_i \rangle$$

حيث:
- **$ID_i$ (المعرف الفريد):** رمز ثابت لا يتكرر يعبر عن النواة وطبقتها ومجالها (مثل `FE-ATT-01` أو `BE-HR-01`).
- **$D_i$ (نطاق العمل المقيد - Domain Context):** سياق المجال المغلق الذي يحظر التعديل المباشر بين النطاقات إلا عبر الواجهة العامة المصرح بها (`index.ts`).
- **$L_i$ (الطبقة التنظيمية):** المستوى المعماري للنواة: $L_i \in \{\text{Core}, \text{Feature}, \text{Operations}, \text{Database}\}$.
- **$F_i$ (مجموعة الملفات المصدرية الحصرية):** الملفات الواقعة تحت الحيازة الحصرية للنواة: $F_i \subset U_{src}$.
- **$S_i$ (كائنات قواعد البيانات متعددة المخططات):** كائنات قاعدة البيانات المملوكة للنواة: $S_i = \langle \text{Functions}, \text{Tables}, \text{Buckets} \rangle$ عبر مخططي `public` و `itpc`.
- **$C_i$ (العقد المعماري الملزم ومصفوفة R# و T#):** $C_i = \langle R_i, T_i \rangle$، حيث يشترط لكل قاعدة عمل ملزمة $r \in R_i$ وجود اختبار فحص مؤتمت $t \in T_i$ يبرهن صحتها واستقرارها حاسوبياً:
$$\forall r \in R_i, \exists t \in T_i : \text{Validates}(t, r) = \text{true}$$

---

## 3. المسلمات والقواعد الحتمية للنظام (System Invariants)
يفرض محرك الإنفاذ الحتمي أربع قواعد قطعية مجردة يجب أن تتحقق بالكامل قبل السماح بتمرير أي عملية بناء:

### المسلمة 1: مسلمة شمولية التغطية وانعدام الملفات غير المنسوبة (Closed-World Zero-Orphan Invariant)
يجب أن تتبع كافة الملفات الموجودة في دليل الشيفرة المصدرية $U_{src}$ لنواة B.R.I.C.K معتمدة دون استثناء، وتكون مجموعة الملفات السائبة فارغة تماماً:
$$\bigcup_{i=1}^n F_i = U_{src} \land F_{unassigned} = \emptyset$$

### المسلمة 2: مسلمة الحيازة الأحادية المطلقة (Exclusive Single Ownership Invariant)
يُحظر قطعياً اشتراك أكثر من نواة معمارية في حيازة نفس الملف أو نفس دالة أو جدول قاعدة البيانات:
$$\forall i, j \in \{1, \dots, n\}, i \neq j \implies (F_i \cap F_j = \emptyset) \land (S_i \cap S_j = \emptyset)$$

### المسلمة 3: مسلمة مطابقة الحالة التشفيرية (Cryptographic State Invariant)
تُعرّف الحالة المعتمدة للمشروع كبصمة تجزئة تشفيرية لكل ملف مملوك:
$$H_{baseline} = \{ f \mapsto \text{SHA-256}(\text{Content}(f)) \mid \forall f \in U_{src} \}$$

### المسلمة 4: مسلمة التكافؤ التعاقدي التام (Contract-Test Bijective Invariant)
يشترط لكل قاعدة عمل ملزمة معلنة في العقد وجود اختبار مؤتمت يبرهن صحتها حاسوبياً.

---

## 4. خوارزميات محرك الإنفاذ الحتمي (Deterministic Sentinel)
يعمل المحرك كبوابة تحقق إلزامية في خطوة ما قبل البناء والتصريف (Step 0 Pre-Build Gate) عبر ثلاث خوارزميات:
1. **الخوارزمية 1: الفحص الهيكلي وتدقيق حيازة الأنوية (Kernel Verification & Partition Auditing):** فحص شجرة الملفات، كشف الملكية المزدوجة، ومنع الملفات الأيتام.
2. **الخوارزمية 2: التدقيق التشفيري والاسترجاع المزدوج (Dual-Mode Cryptographic Verification & Remediation):** مقارنة البصمات، والاسترجاع الآلي الفوري عبر `git checkout` (في نمط المؤسسات) أو عبر مستودع الظل الذاتي `.brick-cache/shadow-store/` (في النمط المعزول Air-Gapped).
3. **الخوارزمية 3: فحص مخططات قواعد البيانات متعددة المخططات (Multi-Schema Database Catalog Inspection):** مضاهاة الكتالوج الحي لخوادم PostgreSQL ومخططاتها (`public`, `itpc`) مع السجل المعلن، وكشف أي دالة أو جدول مفقود أو غير منسوب.

---

## 5. بروتوكول الاعتماد المشروط (The Conditional Snapshot Protocol)
لحل **مفارقة البصمة (The Baselining Paradox)**، يعمل المحرك وفق مبدأ الفصل الصارم بين وضعين:
1. **وضع الحراسة الافتراضي (Read-Only Verification):** يرفض المحرك أي تغيير في البصمات أثناء عمل وكلاء الذكاء الاصطناعي ويصدر أمر الاسترجاع الفوري لحماية النظام من التسلل العشوائي.
2. **وضع الاعتماد الصريح (Explicit Snapshot Mode):** حين ينتهي المطور البشري من ميزته ويثق بصحتها ويدقق عمل الوكيل، يطلق أمراً صريحاً:
```bash
node scripts/verify-bricks.mjs --snapshot
```

### البوابات الخمس المتزامنة لأخذ اللقطة:
- **البوابة 1 (انعدام الأيتام):** ألا يكون التعديل قد أفرز أي ملف جديد سائب غير منسوب لنواة معتمدة.
- **البوابة 2 (حظر الملكية المزدوجة):** ألا يشترك ملف أو كائن واحد بين نواتين.
- **البوابة 3 (التكافؤ التعاقدي R# / T#):** اجتياز كافة الاختبارات البرمجية المسجلة ومطابقة قواعد العمل.
- **البوابة 4 (اتساق كتالوج قاعدة البيانات):** مطابقة كافة الجداول والدوال عبر كافة المخططات (`public` و `itpc`).
- **البوابة 5 (التخزين في مستودع الظل):** تحديث كتل البيانات في `.brick-cache/` لتأمين نقطة الاسترجاع المحلية المعزولة.
