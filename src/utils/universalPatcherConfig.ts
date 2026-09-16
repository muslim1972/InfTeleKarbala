import { cleanCertificate } from './profileUtils';
/**
 * تعريف الجداول والأعمدة للمحدث العام
 * Universal Patcher Configuration
 */

export type TableType = 'single' | 'yearly' | 'detail';

export interface FieldDef {
    value: string;
    label: string;
    type: 'text' | 'numeric' | 'date' | 'integer' | 'boolean';
}

export interface TableDef {
    tableName: string;
    label: string;
    icon: string; // emoji
    type: TableType;
    color: string; // tailwind color prefix
    fields: FieldDef[];
    /** الأعمدة المطلوبة من Excel للمطابقة في الجداول التفصيلية */
    requiredExcelFields?: string[];
}

// ─── الأعمدة المستثناة من الربط (تُدار تلقائياً) ─────────
const SYSTEM_COLUMNS = [
    'id', 'user_id', 'created_at', 'updated_at',
    'last_modified_by', 'last_modified_by_name', 'last_modified_at'
];

// ─── أعمدة الحساب والمطابقة: مطلوبة في ملفات المحافظات للمطابقة أو إنشاء المستخدمين عند افتتاح محافظة جديدة ─────────
// تُربط من Excel في أي جدول، لكنها لا تُحقن في الجدول نفسه إلا إذا كان profiles
const ACCOUNT_FIELDS: FieldDef[] = [
    { value: 'job_number', label: 'الرقم الوظيفي (للمطابقة)', type: 'text' },
    { value: 'username', label: 'اسم المستخدم (لإنشاء الحساب)', type: 'text' },
    { value: 'password', label: 'كلمة المرور (لإنشاء الحساب)', type: 'text' },
];

// ─── تعريف الجداول ─────────────────────────────────────

export const TABLE_DEFINITIONS: TableDef[] = [
    {
        tableName: 'profiles',
        label: 'الملفات الشخصية',
        icon: '👤',
        type: 'single',
        color: 'blue',
        fields: [
            { value: 'full_name', label: 'الاسم الكامل', type: 'text' },
            { value: 'job_number', label: 'الرقم الوظيفي', type: 'text' },
            { value: 'username', label: 'اسم المستخدم', type: 'text' },
            { value: 'governorate', label: 'المحافظة', type: 'text' },
            { value: 'password', label: 'كلمة المرور', type: 'text' },
            { value: 'card_number', label: 'رقم البطاقة', type: 'text' },
            { value: 'graduation_year', label: 'سنة التخرج', type: 'text' },
            { value: 'work_nature', label: 'طبيعة العمل', type: 'text' },
            { value: 'appointment_date', label: 'تاريخ التعيين', type: 'text' },
            { value: 'specialization', label: 'التخصص', type: 'text' },
            { value: 'dept_text', label: 'القسم', type: 'text' },
            { value: 'section_text', label: 'الشعبة', type: 'text' },
            { value: 'unit_text', label: 'الوحدة', type: 'text' },
        ],
    },
    {
        tableName: 'financial_records',
        label: 'السجلات المالية',
        icon: '💰',
        type: 'single',
        color: 'green',
        fields: [
            { value: 'job_title', label: 'العنوان الوظيفي', type: 'text' },
            { value: 'certificate_text', label: 'الشهادة', type: 'text' },
            { value: 'salary_grade', label: 'الدرجة', type: 'text' },
            { value: 'salary_stage', label: 'المرحلة', type: 'text' },
            { value: 'tax_deduction_status', label: 'حالة الاستقطاع الضريبي', type: 'text' },
            { value: 'nominal_salary', label: 'الراتب الاسمي', type: 'numeric' },
            { value: 'certificate_allowance', label: 'مخصصات الشهادة', type: 'numeric' },
            { value: 'certificate_percentage', label: 'نسبة الشهادة', type: 'numeric' },
            { value: 'position_allowance', label: 'مخصصات المنصب', type: 'numeric' },
            { value: 'engineering_allowance', label: 'مخصصات هندسية', type: 'numeric' },
            { value: 'risk_allowance', label: 'مخصصات الخطورة', type: 'numeric' },
            { value: 'legal_allowance', label: 'مخصصات القانونية', type: 'numeric' },
            { value: 'additional_50_percent_allowance', label: 'المخصصات الإضافية 50%', type: 'numeric' },
            { value: 'transport_allowance', label: 'مخصصات النقل', type: 'numeric' },
            { value: 'marital_allowance', label: 'مخصصات الزوجية', type: 'numeric' },
            { value: 'children_allowance', label: 'مخصصات الأطفال', type: 'numeric' },
            { value: 'gross_salary', label: 'الراتب الإجمالي', type: 'numeric' },
            { value: 'tax_deduction_amount', label: 'الضريبة', type: 'numeric' },
            { value: 'retirement_deduction', label: 'التقاعد', type: 'numeric' },
            { value: 'social_security_deduction', label: 'الحماية الاجتماعية', type: 'numeric' },
            { value: 'loan_deduction', label: 'استقطاع القرض', type: 'numeric' },
            { value: 'execution_deduction', label: 'مبلغ التنفيذ', type: 'numeric' },
            { value: 'school_stamp_deduction', label: 'طابع مدرسي', type: 'numeric' },
            { value: 'other_deductions', label: 'استقطاعات أخرى', type: 'numeric' },
            { value: 'total_deductions', label: 'مجموع الاستقطاعات', type: 'numeric' },
            { value: 'net_salary', label: 'الراتب الصافي', type: 'numeric' },
            { value: 'full_name', label: 'الاسم في السجل المالي', type: 'text' },
            { value: 'remaining_leaves_balance', label: 'رصيد الإجازات', type: 'integer' },
            { value: 'leaves_balance_expiry_date', label: 'تاريخ انتهاء رصيد الإجازات', type: 'text' },
            ...ACCOUNT_FIELDS,
        ],
    },
    {
        tableName: 'yearly_records',
        label: 'السجلات السنوية',
        icon: '📅',
        type: 'yearly',
        color: 'purple',
        fields: [
            { value: 'thanks_books_count', label: 'عدد كتب الشكر', type: 'integer' },
            { value: 'committees_count', label: 'عدد اللجان', type: 'integer' },
            { value: 'penalties_count', label: 'عدد العقوبات', type: 'integer' },
            { value: 'leaves_taken', label: 'الإجازات المستخدمة', type: 'integer' },
            { value: 'sick_leaves', label: 'الإجازات المرضية', type: 'integer' },
            { value: 'unpaid_leaves', label: 'الإجازات بدون راتب', type: 'integer' },
            ...ACCOUNT_FIELDS,
        ],
    },
    {
        tableName: 'thanks_details',
        label: 'تفاصيل كتب الشكر',
        icon: '🏆',
        type: 'detail',
        color: 'amber',
        fields: [
            { value: 'book_number', label: 'رقم الكتاب', type: 'text' },
            { value: 'book_date', label: 'تاريخ الكتاب', type: 'date' },
            { value: 'reason', label: 'السبب', type: 'text' },
            { value: 'issuer', label: 'الجهة المانحة', type: 'text' },
            ...ACCOUNT_FIELDS,
        ],
    },
    {
        tableName: 'committees_details',
        label: 'تفاصيل اللجان',
        icon: '👥',
        type: 'detail',
        color: 'teal',
        fields: [
            { value: 'committee_name', label: 'اسم اللجنة', type: 'text' },
            { value: 'role', label: 'الدور', type: 'text' },
            { value: 'start_date', label: 'تاريخ البدء', type: 'date' },
            ...ACCOUNT_FIELDS,
        ],
    },
    {
        tableName: 'penalties_details',
        label: 'تفاصيل العقوبات',
        icon: '⚠️',
        type: 'detail',
        color: 'red',
        fields: [
            { value: 'penalty_type', label: 'نوع العقوبة', type: 'text' },
            { value: 'reason', label: 'السبب', type: 'text' },
            { value: 'penalty_date', label: 'تاريخ العقوبة', type: 'date' },
            { value: 'effect', label: 'الأثر', type: 'text' },
            ...ACCOUNT_FIELDS,
        ],
    },
    {
        tableName: 'leaves_details',
        label: 'تفاصيل الإجازات',
        icon: '🏖️',
        type: 'detail',
        color: 'cyan',
        fields: [
            { value: 'leave_type', label: 'نوع الإجازة', type: 'text' },
            { value: 'start_date', label: 'تاريخ البدء', type: 'date' },
            { value: 'end_date', label: 'تاريخ الانتهاء', type: 'date' },
            { value: 'duration', label: 'المدة (أيام)', type: 'integer' },
            ...ACCOUNT_FIELDS,
        ],
    },
];

// ─── Helpers ────────────────────────────────────────

/** الحقول الرقمية لتنظيف القيم */
export function isNumericField(tableName: string, fieldValue: string): boolean {
    const table = TABLE_DEFINITIONS.find(t => t.tableName === tableName);
    if (!table) return false;
    const field = table.fields.find(f => f.value === fieldValue);
    return field?.type === 'numeric' || field?.type === 'integer';
}

/** تنظيف النصوص العربية للمطابقة */
export function normalizeArabicText(text: string): string {
    if (!text) return '';
    return String(text)
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/عبد\s+ال/g, 'عبدال')
        .replace(/عبدال/g, 'عبد ال')
        .replace(/\s+/g, ' ');
}


/** تنظيف قيمة حسب نوع الحقل */
export function cleanFieldValue(val: any, tableName: string, fieldValue: string): any {
    if (fieldValue === 'certificate_text') {
        return cleanCertificate(val);
    }
    
    if (isNumericField(tableName, fieldValue)) {
        if (typeof val === 'number') return val;
        if (val === null || val === undefined || val === '') return 0;
        const strVal = String(val).trim().replace(/,/g, '');
        if (strVal === '') return 0;
        const num = parseFloat(strVal);
        return isNaN(num) ? 0 : num;
    }
    if (val === null || val === undefined || val === '') return null;
    return String(val).trim();
}

/** إزالة أعمدة الحساب والمطابقة من حمولة الحقن — كلمة المرور لا تُحقن أبداً، واسم المستخدم والرقم الوظيفي يُحقنان في profiles فقط */
export function stripAccountFields(payload: Record<string, any>, tableName: string): Record<string, any> {
    const { password: _pw, ...rest } = payload;
    if (tableName !== 'profiles') {
        delete rest.username;
        delete rest.job_number;
    }
    return rest;
}

/** قاموس المرادفات والمسميات البديلة لأعمدة Excel للمطابقة الذكية */
export const FIELD_SYNONYMS: Record<string, string[]> = {
    // الملفات الشخصية
    full_name: ['الاسم الكامل', 'اسم الموظف', 'الاسم', 'الاسم الرباعي', 'الاسم الثلاثي', 'اسم المنتسب', 'الاسم في السجل المالي', 'full name', 'fullname', 'name'],
    job_number: ['الرقم الوظيفي', 'الرقم الوظيفي (للمطابقة)', 'رقم وظيفي', 'الرقم', 'رقم الموظف', 'العدد الوظيفي', 'job number', 'job_number', 'jobno', 'job_no', 'job no', 'id', 'job'],
    username: ['اسم المستخدم', 'المستخدم', 'اليوزر', 'حساب المستخدم', 'اسم المستخدم (لإنشاء الحساب)', 'username', 'user'],
    password: ['كلمة المرور', 'الباسورد', 'الرمز السري', 'كلمة السر', 'رمز المرور', 'كلمة المرور (لإنشاء الحساب)', 'password', 'pass'],
    governorate: ['المحافظة', 'محافظة', 'governorate', 'city'],
    card_number: ['رقم البطاقة', 'البطاقة الوطنية', 'هوية الاحوال', 'الهوية', 'رقم الهوية', 'card number', 'national id'],
    graduation_year: ['سنة التخرج', 'تاريخ التخرج', 'التخرج', 'سنه التخرج', 'graduation year'],
    work_nature: ['طبيعة العمل', 'نوع العمل', 'الصفة', 'work nature'],
    appointment_date: ['تاريخ التعيين', 'التعيين', 'تاريخ المباشرة', 'المباشرة', 'appointment date'],
    specialization: ['التخصص', 'الاختصاص', 'specialization'],
    dept_text: ['القسم', 'اسم القسم', 'الدائرة', 'مكان العمل حسب تصنيف المالية', 'department', 'dept'],
    section_text: ['الشعبة', 'اسم الشعبة', 'section'],
    unit_text: ['الوحدة', 'اسم الوحدة', 'unit'],
    
    // السجلات المالية
    job_title: ['العنوان الوظيفي', 'العنوان', 'الوظيفة', 'job title'],
    certificate_text: ['الشهادة', 'التحصيل الدراسي', 'المؤهل العلمي', 'الشهادة الدراسية', 'certificate'],
    salary_grade: ['الدرجة', 'درجة الراتب', 'الدرجة الوظيفية', 'grade'],
    salary_stage: ['المرحلة', 'مرحلة الراتب', 'stage'],
    tax_deduction_status: ['حالة الاستقطاع الضريبي', 'حالة الموظف في الاستقطاع الضريبي', 'الاستقطاع الضريبي', 'الضريبة'],
    nominal_salary: ['الراتب الاسمي', 'الاسمي', 'الراتب الأسمي', 'basic salary', 'nominal salary'],
    certificate_allowance: ['مخصصات الشهادة', 'مخصص الشهادة'],
    certificate_percentage: ['نسبة الشهادة', 'نسبة مخصصات الشهادة'],
    position_allowance: ['مخصصات المنصب', 'مخصص المنصب', 'المنصب'],
    engineering_allowance: ['مخصصات هندسية', 'المخصصات الهندسية', 'هندسية'],
    risk_allowance: ['مخصصات الخطورة', 'مخصص الخطورة', 'الخطورة', 'نسبة الخطورة'],
    legal_allowance: ['مخصصات القانونية', 'المخصصات القانونية', 'قانونية'],
    additional_50_percent_allowance: ['المخصصات الإضافية 50%', 'المخصصات الاضافية 50%', 'مخصصات اضافية', 'اضافية 50%'],
    transport_allowance: ['مخصصات النقل', 'مخصص النقل', 'النقل'],
    marital_allowance: ['مخصصات الزوجية', 'مخصص الزوجية', 'الزوجية', 'الحالة الزوجية'],
    children_allowance: ['مخصصات الأطفال', 'مخصصات الاطفال', 'مخصص الاطفال', 'الاطفال'],
    gross_salary: ['الراتب الإجمالي', 'الراتب الاجمالي', 'الراتب الاجمالي ( الايرادات)', 'الاجمالي', 'gross salary'],
    tax_deduction_amount: ['الضريبة', 'مبلغ الضريبة', 'استقطاع الضريبة', 'ضريبة'],
    retirement_deduction: ['التقاعد', 'استقطاع التقاعد', 'توقيفات تقاعدية', 'توقيفات التقاعد'],
    social_security_deduction: ['الحماية الاجتماعية', 'استقطاع الحماية الاجتماعية', 'الضمان الاجتماعي'],
    loan_deduction: ['استقطاع القرض', 'استقطاع مبلغ القرض', 'القرض', 'سلفة'],
    execution_deduction: ['مبلغ التنفيذ', 'التنفيذ', 'استقطاع التنفيذ'],
    school_stamp_deduction: ['طابع مدرسي', 'طابع التربية', 'طابع'],
    other_deductions: ['استقطاعات أخرى', 'استقطاعات اخرى', 'طرح مبلغ', 'اخرى'],
    total_deductions: ['مجموع الاستقطاعات', 'كافة الاستقطاعات', 'الاستقطاعات'],
    net_salary: ['الراتب الصافي', 'الصافي', 'صافي الراتب', 'net salary'],
    remaining_leaves_balance: ['رصيد الإجازات', 'رصيد الاجازات', 'الاجازات المتبقية', 'رصيد اجازات'],
    leaves_balance_expiry_date: ['تاريخ انتهاء رصيد الإجازات', 'تاريخ انتهاء الاجازات', 'انتهاء رصيد الاجازات'],

    // كتب الشكر
    book_number: ['رقم الكتاب', 'العدد', 'رقم الامر', 'رقم الأمر'],
    book_date: ['تاريخ الكتاب', 'التاريخ', 'تاريخ الامر', 'تاريخ الأمر'],
    reason: ['السبب', 'سبب الشكر', 'سبب العقوبة', 'الموضوع'],
    grantor: ['الجهة المانحة', 'المانح', 'جهة الشكر', 'صادر من'],

    // اللجان
    committee_name: ['اسم اللجنة', 'اللجنة', 'عنوان اللجنة'],
    order_number: ['رقم الأمر', 'رقم الامر', 'العدد'],
    order_date: ['تاريخ الأمر', 'تاريخ الامر', 'التاريخ'],
    role: ['الدور', 'الصفة', 'صفة العضوية', 'عضو / رئيس'],

    // العقوبات
    penalty_type: ['نوع العقوبة', 'العقوبة'],
    penalty_date: ['تاريخ العقوبة', 'تاريخ الأمر'],
    effect: ['الأثر', 'اثر العقوبة', 'المدة'],

    // الإجازات
    leave_type: ['نوع الإجازة', 'نوع الاجازة', 'الاجازة'],
    start_date: ['تاريخ البدء', 'من تاريخ', 'بداية الإجازة'],
    end_date: ['تاريخ الانتهاء', 'إلى تاريخ', 'نهاية الإجازة'],
    duration: ['المدة (أيام)', 'المدة', 'عدد الايام', 'عدد الأيام']
};

export { SYSTEM_COLUMNS };
