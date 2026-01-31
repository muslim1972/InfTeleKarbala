# مشروع نظام إدارة بيانات الموظفين - الخطة الشاملة

هذا الملف يحتوي على خطة التنفيذ الكاملة وقائمة المهام لنقلها إلى مساحة العمل الجديدة.

---

# 1. قائمة المهام (Tasks)

- [ ] إعداد بيئة التطوير
    - [ ] إنشاء مشروع Vite جديد (React + TypeScript)
    - [ ] تثبيت وإعداد Tailwind CSS
    - [ ] إضافة Capacitor للإعداد الهجين (Web/Mobile)
    - [ ] تثبيت مكتبات الأيقونات والرسوم المتحركة (Framer Motion, Lucide)
- [ ] تصميم قاعدة البيانات (Supabase)
    - [ ] إعداد مخطط قاعدة البيانات (Schema) في ملف SQL
        - [ ] جدول الموظفين (profiles)
        - [ ] جدول البيانات المالية (financial_records)
        - [ ] جدول البيانات الإدارية والذاتية (administrative_records)
        - [ ] جدول السجلات السنوية (yearly_records) - للكتب والعقوبات وغيرها
    - [ ] إعداد سياسات الأمان (RLS)
- [ ] تطوير الواجهات (Frontend)
    - [ ] إعداد التصميم العام (Theme & Layout)
    - [ ] شاشة تسجيل الدخول
    - [ ] الواجهة الرئيسية (Dashboard)
        - [ ] الرأس (Header) مع معلومات الموظف وزر الخروج
        - [ ] نظام التبويبات (المالية / الذاتية)
    - [ ] تبويب المالية (A)
        - [ ] القائمة القابلة للتمرير للحقول المالية
        - [ ] حقل IBAN وزر الإظهار
    - [ ] تبويب الذاتية (B)
        - [ ] واجهة كتب الشكر (شريط السنوات المنزلق)
        - [ ] حقول الإجازات وتفاصيلها
- [ ] الربط مع الخلفية (Backend Integration)
    - [ ] إعداد عميل Supabase
    - [ ] ربط تسجيل الدخول
    - [ ] جلب وعرض البيانات المالية
    - [ ] جلب وعرض البيانات الذاتية حسب السنة المختارة
- [ ] التحسين والتدقيق
    - [ ] اختبار التطبيق على مقاسات شاشات مختلفة
    - [ ] تحسينات الجمالية والأنيميشن
    - [ ] بناء نسخة الإنتاج

---

# 2. خطة التنفيذ (Implementation Plan)

## نظرة عامة
تطبيق هجين (Web/Mobile) لإدارة بيانات الموظفين المالية والإدارية. يتميز بتصميم عصري (Premium Glassmorphism) ويدعم اللغة العربية بالكامل.

## التقنيات المستخدمة
- **الواجهة الأمامية**: React + TypeScript (باستخدام Vite).
- **التنسيق**: Tailwind CSS (لتصميم مخصص وسريع).
- **إدارة الحالة**: React Context / Hooks.
- **التطبيق الهجين**: Capacitor (لتحويل تطبيق الويب إلى تطبيق موبايل).
- **قاعدة البيانات**: Supabase (PostgreSQL).
- **الرسوميات والجماليات**: Framer Motion (للأنيميشن السلس)، Lucide React (للأيقونات).

## تفاصيل قاعدة البيانات (Supabase Schema)
سيتم إنشاء ملف `supabase_schema.sql` يحتوي على الجداول التالية:

### الجداول الأساسية:
1.  **`profiles`**:
    - `id` (UUID, Primary Key) - مرتبط بـ `auth.users`
    - `full_name` (Text) - اسم الموظف
    - `job_number` (Text) - الرقم الوظيفي
    - `avatar_url` (Text) - صورة الموظف (اختياري)

2.  **`financial_records`**:
    - `id` (UUID)
    - `user_id` (FK -> profiles.id)
    - `job_title` (العنوان الوظيفي)
    - `salary_grade` (الدرجة)
    - `salary_stage` (المرحلة)
    - `tax_deduction_status` (حالة الاستقطاع الضريبي)
    - `tax_deduction_amount` (الاستقطاع الضريبي)
    - `certificate_allowance` (مخصصات الشهادة)
    - `engineering_allowance` (مخصصات هندسية)
    - `legal_allowance` (مخصصات قانونية)
    - `transport_allowance` (مخصصات النقل)
    - `marital_allowance` (مخصصات الزوجية)
    - `children_allowance` (مخصصات الأطفال)
    - `loan_deduction` (استقطاع القرض)
    - `execution_deduction` (استقطاع التنفيذ)
    - `retirement_deduction` (استقطاع التقاعد)
    - `school_stamp_deduction` (استقطاع طابع مدرسي)
    - `social_security_deduction` (استقطاع الحماية الاجتماعية)
    - `certificate_text` (الشهادة - نص)
    - `certificate_percentage` (النسبة المستحقة للشهادة)
    - `position_allowance` (مخصصات المنصب)
    - `risk_allowance` (مخصصات الخطورة)
    - `additional_50_percent_allowance` (مخصصات اضافية 50%)
    - `other_deductions` (استقطاع مبلغ مطروح ان وجد)
    - `total_deductions` (مجموع الاستقطاعات)
    - `nominal_salary` (الراتب الاسمي)
    - `gross_salary` (الراتب المستحق قبل الاستقطاع)
    - `net_salary` (الراتب الصافي)
    - `iban` (رقم الآيبان)

3.  **`administrative_summary`** (بيانات عامة):
    - `id` (UUID)
    - `user_id` (FK)
    - `remaining_leave_balance` (رصيد الإجازات المتبقي)
    - `five_year_law_leaves` (الإجازات حسب قانون الخمس سنوات)
    - `disengagement_date` (تاريخ الانفكاك)
    - `resumption_date` (تاريخ المباشرة)

4.  **`yearly_records`**:
    - `id` (UUID)
    - `user_id` (FK)
    - `year` (Integer) - مثلاً 2024
    - `thanks_books_count` (عدد كتب الشكر)
    - `committees_count` (اللجان)
    - `penalties_count` (العقوبات)
    - `leaves_taken` (الإجازات المأخوذة)
    - `sick_leaves` (الإجازات المرضية)
    - `unpaid_leaves` (اجازات بدون راتب)

## الواجهة (UI/UX)
### المكونات (Components):
- `AppHeader`: يعرض معلومات الموظف وزر الخروج.
- `TabSystem`: للتبديل بين "المالية" و "الذاتية" مع تأثيرات حركية (Framer Motion).
- `FinancialCard`: يعرض كل حقل مالي في سطر جميل وأنيق.
- `YearSlider`: شريط تمرير أفقي للسنوات (2003-2030).
- `StatCard`: بطاقة لعرض الإحصائيات (كتب الشكر، الإجازات، إلخ).

### الجماليات:
- استخدام تدرجات لونية هادئة وحديثة (Modern Gradients).
- تأثير Glassmorphism للخلفيات والبطاقات.
- خط عربي حديث (مثل Cairo أو Tajawal) لضمان القراءة المريحة.
