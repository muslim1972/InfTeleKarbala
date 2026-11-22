import { cleanCertificate } from './profileUtils';
import { CERTIFICATES } from '../constants/certificates';
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
    /** إذا كان الجدول مستقلاً ولا يحتاج إلى حسابات في Profiles (مثل طلبة التدريب الصيفي) */
    isStandalone?: boolean;
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
        tableName: 'summer_training_students',
        label: 'طلبة التدريب الصيفي',
        icon: '🎓',
        type: 'single',
        color: 'emerald',
        isStandalone: true,
        fields: [
            { value: 'full_name', label: 'الاسم الثلاثي', type: 'text' },
            { value: 'username', label: 'اسم المستخدم (للمطابقة والدخول)', type: 'text' },
            { value: 'password_hash', label: 'الرمز', type: 'text' },
            { value: 'institution_name', label: 'الجامعة او المعهد', type: 'text' },
            { value: 'training_location', label: 'موقع التدريب', type: 'text' },
            { value: 'trainer_name', label: 'اسم المدرب', type: 'text' },
            { value: 'batch_name', label: 'اسم الدورة / النسخة', type: 'text' },
            { value: 'exam_grade', label: 'درجة الاختبار', type: 'text' },
        ]
    },
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
            { value: 'mother_name', label: 'اسم الأم', type: 'text' },
            { value: 'gender', label: 'الجنس', type: 'text' },
            { value: 'birth_date', label: 'تاريخ الولادة', type: 'date' },
            { value: 'general_specialization', label: 'الاختصاص العام', type: 'text' },
            { value: 'position_title', label: 'المنصب', type: 'text' },
            { value: 'phone_number', label: 'رقم الهاتف', type: 'text' },
            { value: 'reinstatement_date', label: 'تاريخ الإعادة', type: 'text' },
            { value: 'leave_date', label: 'تاريخ الترك', type: 'text' },
            { value: 'reinstatement_type', label: 'نوع الإعادة', type: 'text' },
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

/** فحص ما إذا كان الحقل حقلاً للتاريخ */
export function isDateField(tableName: string, fieldValue: string): boolean {
    const table = TABLE_DEFINITIONS.find(t => t.tableName === tableName);
    if (!table) return false;
    const field = table.fields.find(f => f.value === fieldValue);
    return field?.type === 'date' || fieldValue === 'birth_date';
}

/** تطبيع وتحويل التواريخ النصية وتواريخ إكسل العراقية (مثل 14/03/85) إلى صيغة YYYY-MM-DD */
export function normalizeDateValue(val: any): string | null {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val.getTime())) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    const str = String(val).trim();
    if (!str || str === 'لايوجد' || str === 'بدون' || str === '-' || str === '0') return null;

    const parts = str.split(/[\/\-\.]/);
    if (parts.length === 3) {
        let [dStr, mStr, yStr] = parts;
        if (dStr.length === 4) {
            const temp = dStr;
            dStr = yStr;
            yStr = temp;
        }
        let day = parseInt(dStr, 10);
        let month = parseInt(mStr, 10);
        let year = parseInt(yStr, 10);

        if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

        if (year < 100) {
            const current2DigitYear = new Date().getFullYear() % 100;
            if (year <= current2DigitYear) {
                year = 2000 + year;
            } else {
                year = 1900 + year;
            }
        }

        const mm = String(month).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        return `${year}-${mm}-${dd}`;
    }

    return null;
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

    // استخراج النتيجة إن كانت خلية صيغة أو كائن في ExcelJS
    if (val && typeof val === 'object' && 'result' in val) {
        val = val.result;
    }

    // تنظيف وتوحيد الجنس
    if (fieldValue === 'gender') {
        const s = String(val || '').trim();
        if (s.includes('انث') || s.includes('أنث') || s.toLowerCase() === 'female') return 'female';
        if (s.includes('ذكر') || s.toLowerCase() === 'male') return 'male';
        return s || null;
    }

    // تنظيف وتوحيد حقول التاريخ (مثل تاريخ الولادة)
    if (isDateField(tableName, fieldValue)) {
        return normalizeDateValue(val);
    }

    if (val instanceof Date && !isNaN(val.getTime())) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    
    // تنظيف وتوحيد نسبة الشهادة (معالجة قيم إكسل المنسقة كنسبة مئوية مثل 0.45 -> 45)
    if (fieldValue === 'certificate_percentage') {
        if (val === null || val === undefined || val === '') return 0;
        const strVal = String(val).trim().replace(/%/g, '').replace(/,/g, '');
        let num = parseFloat(strVal);
        if (isNaN(num)) return 0;
        if (num > 0 && num <= 1.5) {
            num = Math.round(num * 100);
        }
        return num;
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
    full_name: ['الاسم الكامل', 'اسم الموظف', 'الاسم', 'الاسم الرباعي', 'الاسم الثلاثي', 'اسم المنتسب', 'الاسم في السجل المالي', 'الاسم_الكامل', 'full name', 'fullname', 'name'],
    job_number: ['الرقم الوظيفي', 'الرقم الوظيفي (للمطابقة)', 'رقم وظيفي', 'رقم_وظيفي', 'الرقم', 'رقم الموظف', 'العدد الوظيفي', 'job number', 'job_number', 'jobno', 'job_no', 'job no', 'id', 'job'],
    username: ['اسم المستخدم', 'اسم_المستخدم', 'المستخدم', 'اليوزر', 'حساب المستخدم', 'اسم المستخدم (لإنشاء الحساب)', 'username', 'user'],
    password: ['كلمة المرور', 'الباسورد', 'الرمز السري', 'كلمة السر', 'رمز المرور', 'كلمة المرور (لإنشاء الحساب)', 'password', 'pass'],
    governorate: ['المحافظة', 'محافظة', 'governorate', 'city'],
    card_number: ['رقم البطاقة', 'البطاقة الوطنية', 'هوية الاحوال', 'الهوية', 'رقم الهوية', 'card number', 'national id'],
    graduation_year: ['سنة التخرج', 'سنة_التخرج', 'تاريخ التخرج', 'التخرج', 'سنه التخرج', 'graduation year'],
    work_nature: ['طبيعة العمل', 'طبيعة_العمل', 'نوع العمل', 'الصفة', 'work nature'],
    appointment_date: ['تاريخ التعيين', 'ت_التعيين', 'ت_تعيين', 'التعيين', 'تاريخ المباشرة', 'المباشرة', 'appointment date'],
    specialization: ['التخصص', 'الاختصاص', 'specialization'],
    dept_text: ['القسم', 'اسم القسم', 'الدائرة', 'مكان العمل حسب تصنيف المالية', 'department', 'dept'],
    section_text: ['الشعبة', 'الشعبة / المجمع', 'الشعبة/المجمع', 'المجمع', 'اسم الشعبة', 'مكان العمل الدقيق', 'مكان العمل', 'مكان العمل حسب تصنيف المالية', 'section'],
    unit_text: ['الوحدة', 'اسم الوحدة', 'unit'],
    mother_name: ['اسم الام', 'اسم الأم', 'اسم_الام', 'اسم_الأم', 'الام', 'الأم', 'mother name', 'mother_name'],
    gender: ['الجنس', 'جنس', 'النوع', 'gender', 'sex'],
    birth_date: ['تاريخ الولادة', 'تاريخ_الولادة', 'الولادة', 'تولد', 'تاريخ الميلاد', 'birth date', 'birthdate', 'birth_date', 'dob'],
    general_specialization: ['الاختصاص العام', 'الاختصاص_العام', 'التخصص العام', 'التخصص_العام', 'general specialization', 'general_specialization'],
    position_title: ['المنصب', 'المنصب الاداري', 'المنصب الإداري', 'position', 'position title', 'position_title'],
    phone_number: ['رقم الهاتف', 'رقم_الهاتف', 'الهاتف', 'الموبايل', 'الجوال', 'رقم الموبايل', 'الهاتف النقال', 'phone', 'mobile', 'phone number', 'phone_number'],
    reinstatement_date: ['تاريخ الاعادة', 'تاريخ الإعادة', 'ت_الاعادة', 'ت_الإعادة', 'تاريخ_الاعادة', 'تاريخ_الإعادة', 'الاعادة', 'reinstatement date', 'reinstatement_date'],
    leave_date: ['تاريخ الترك', 'تاريخ_الترك', 'ت_الترك', 'تاريخ.الترك', 'الترك', 'leave date', 'leave_date', 'departure date'],
    reinstatement_type: ['نوع الاعادة', 'نوع الإعادة', 'نوع_الاعادة', 'نوع_الإعادة', 'reinstatement type', 'reinstatement_type'],
    
    // السجلات المالية
    job_title: ['العنوان الوظيفي', 'ع.الوظيفي', 'العنوان', 'الوظيفة', 'job title'],
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
    marital_allowance: ['مخصصات الزوجية', 'مخصص الزوجية', 'مخصص الزوجية', 'مخصصات زوجية'],
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

/** قاموس المرادفات والمطابقات الدلالية المسبقة للأقسام والشعب والمجمعات الإدارية */
const SEMANTIC_DEPARTMENT_ALIASES: Array<{ canonical: string; aliases: string[] }> = [
    { canonical: 'مجمع اتصالات قضاء الهندية', aliases: ['مجمع اتصالات الهندية', 'مجمع اتصالات الهنديه', 'مجمع الهندية', 'الهندية', 'مجمع الهنديه'] },
    { canonical: 'مجمع اتصالات سيد الشهداء (ع)', aliases: ['مجمع اتصالات سيد الشهداء', 'مجمع سيد الشهداء', 'سيد الشهداء', 'سيد الشهداء (ع)'] },
    { canonical: 'مجمع اتصالات عين التمر', aliases: ['مجمع اتصلات عين التمر', 'عين التمر', 'مجمع عين التمر', 'مجمع اتصالات عين التمر'] },
    { canonical: 'مجمع اتصالات الحر (ع)', aliases: ['مجمع اتصالات الحر', 'مجمع الحر', 'الحر', 'مجمع اتصالات الحر (ع)'] },
    { canonical: 'مجمع اتصالات الخيرات', aliases: ['مجمع الخيرات', 'الخيرات', 'مجمع اتصالات الخيرات'] },
    { canonical: 'مجمع اتصالات الجدول الغربي', aliases: ['مجمع الجدول الغربي', 'الجدول الغربي'] },
    { canonical: 'مجمع اتصالات قضاء الحسينية', aliases: ['مجمع اتصالات الحسينية', 'مجمع الحسينية', 'الحسينية', 'قضاء الحسينية'] },
    { canonical: 'شعبة العلاقات والاعلام', aliases: ['شعبة العلاقات العامة والاعلام', 'شعبة العلاقات العامة والإعلام', 'شعبة الإعلام والعلاقات', 'شعبة الاعلام والعلاقات', 'الاعلام والعلاقات', 'العلاقات والاعلام', 'الاعلام', 'العلاقات'] },
    { canonical: 'شعبة التخطيط والمتابعة', aliases: ['شعبه التخطيط والمتابعه', 'شعبة التخطيط و المتابعة', 'التخطيط والمتابعة', 'التخطيط والمتابعه', 'التخطيط'] },
    { canonical: 'شعبة الخدمات الادارية والنقليات', aliases: ['شعبة الخدمات الإدارية', 'شعبة الخدمات الادارية', 'الخدمات الادارية', 'الخدمات الادارية والنقليات', 'النقليات'] },
    { canonical: 'شعبة الشؤون المالية', aliases: ['الشعبة المالية', 'شعبة المالية', 'المالية', 'الشؤون المالية'] },
    { canonical: 'شعبة التسويق والمتابعة', aliases: ['شعبة التسويق والمتابعه', 'التسويق والمتابعة', 'التسويق'] },
    { canonical: 'وحدة البيانات', aliases: ['وحدة البيانات', 'وحده البيانات', 'البيانات'] },
    { canonical: 'وحده تصفية الديون السابقه', aliases: ['وحدة تصفية الديون السابقة', 'وحده تصفية الديون السابقة', 'وحدة تصفية الديون السابقه', 'وحده تصفية الديون', 'تصفية الديون السابقة', 'تصفية الديون', 'الديون'] },
    { canonical: 'شعبة ادارة مكتب المدير', aliases: ['شعبة إدارة مكتب المدير', 'ادارة مكتب المدير', 'إدارة مكتب المدير', 'مكتب المدير', 'شعبة مكتب المدير'] },
    { canonical: 'شعبة التدقيق والرقابة الداخلية', aliases: ['شعبة التدقيق والرقابه الداخليه', 'التدقيق والرقابة الداخلية', 'شعبة التدقيق', 'التدقيق'] },
    { canonical: 'شعبة تناقل البيانات IP', aliases: ['تناقل البيانات', 'شعبة تناقل البيانات', 'تناقل البيانات IP', 'IP'] },
    { canonical: 'شعبة ادارة الموارد البشرية', aliases: ['شعبة الموارد البشرية', 'الموارد البشرية', 'شعبة الموارد', 'الموارد'] },
    { canonical: 'شعبة ادارة تجهيز الخدمة', aliases: ['شعبة إدارة تجهيز الخدمة', 'ادارة تجهيز الخدمة', 'إدارة تجهيز الخدمة', 'تجهيز الخدمة'] },
    { canonical: 'شعبة الاتصالات السلكية الضوئية', aliases: ['الاتصالات السلكية الضوئية', 'السلكية الضوئية', 'السلكية', 'الاتصالات السلكية'] },
    { canonical: 'شعبة الاتصالات اللاسلكية', aliases: ['الاتصالات اللاسلكية', 'اللاسلكية'] },
    { canonical: 'شعبة المخازن', aliases: ['شعبة المخازن', 'المخازن'] },
    { canonical: 'شعبة القدرة', aliases: ['شعبة القدرة والتكييف', 'القدرة والتكييف', 'القدرة'] },
    { canonical: 'شعبة المباني', aliases: ['شعبة المباني', 'المباني'] },
    { canonical: 'الشعبة القانونية', aliases: ['شعبة القانونية', 'القانونية'] },
    { canonical: 'شعبة GIS', aliases: ['GIS', 'شعبة GIS', 'جي اي اس'] },
    { canonical: 'شعبة الدفاع المدني', aliases: ['شعبة الدفاع المدني', 'الدفاع المدني'] },
    { canonical: 'شعبة التصاميم', aliases: ['شعبة التصاميم', 'التصاميم'] },
    { canonical: 'شعبة البدالات والشبكة النحاسية', aliases: ['شعبة البدالات', 'البدالات والشبكة النحاسية', 'البدالات'] },
    { canonical: 'شعبة FTTX', aliases: ['شعبة FTTX', 'FTTX', 'اف تي تي اكس'] },
    { canonical: 'قسم المالي والاداري', aliases: ['القسم المالي والاداري', 'القسم المالي', 'القسم الاداري'] },
    { canonical: 'قسم التراسل', aliases: ['قسم التراسل', 'التراسل'] },
    { canonical: 'قسم الشبكات', aliases: ['قسم الشبكات', 'الشبكات'] },
    { canonical: 'قسم تجهيز خدمات المعلوماتية', aliases: ['المعلوماتية', 'تجهيز الخدمة', 'تجهيز خدمات المعلوماتية'] }
];

/** استخراج الكلمات المفتاحية وجذر اسم التشكيل الإداري */
function cleanDepartmentStem(text: string): string {
    return normalizeArabicText(text || '')
        .replace(/\([^)]*\)/g, '')
        .replace(/^(شعبة|شعبه|الشعبة|الشعبه|قسم|القسم|وحدة|وحده|الوحدة|الوحده|مجمع|المجمع|ادارة|إدارة)\s+/g, '')
        .replace(/^(اتصالات|شؤون|خدمات|قضاء)\s+/g, '')
        .replace(/\b(كربلاء|المقدسة|قضاء)\b/g, '')
        .trim();
}

/** مطابقة اسم تشكيل إداري من قاعدة البيانات */
function matchDepartmentNode(
    candText: string,
    departments: Array<{ id: string; name: string; parent_id: string | null; level?: number }>
): typeof departments[0] | null {
    if (!candText) return null;
    const normCand = normalizeArabicText(candText);
    const stemCand = cleanDepartmentStem(candText);

    // 1. مطابقة مباشرة تامة (Exact Match)
    const exact = departments.find(d => normalizeArabicText(d.name) === normCand);
    if (exact) return exact;

    // 2. مطابقة بالقاموس الدلالي الذكي (Semantic Alias Match)
    for (const sa of SEMANTIC_DEPARTMENT_ALIASES) {
        const isMatch = sa.aliases.some(alias => {
            const normAlias = normalizeArabicText(alias);
            return normAlias === normCand || normAlias === stemCand;
        });
        if (isMatch) {
            const targetDept = departments.find(d => {
                const normD = normalizeArabicText(d.name);
                const normCan = normalizeArabicText(sa.canonical);
                return normD === normCan || normD.includes(normCan) || normCan.includes(normD);
            });
            if (targetDept) return targetDept;
        }
    }

    // 3. مطابقة الجذور المشتركة (Stem Match)
    if (stemCand.length >= 3) {
        const fuzzy = departments.find(d => {
            const stemDept = cleanDepartmentStem(d.name);
            return stemDept === stemCand || (stemDept.length >= 4 && (stemDept.includes(stemCand) || stemCand.includes(stemDept)));
        });
        if (fuzzy) return fuzzy;
    }

    return null;
}

/**
 * دالة ذكية لمطابقة واستنتاج شجرة التشكيل الإداري بطريقة تصاعدية حتمية:
 * 1. الأولوية للوحدة: إن وُجدت، يُلغى الشعبة والقسم من الإكسل وتُستنتج من الشجرة.
 * 2. إن كانت الوحدة فارغة، تُؤخذ الشعبة/المجمع: ويُلغى القسم من الإكسل ويُستنتج من الشجرة.
 * 3. إن كانت الوحدة والشعبة فارغتين، يُؤخذ القسم: ولا يُحذف تشكيل الموظف السابق.
 */
export function resolveDepartmentHierarchy(
    rawUnit: string | undefined | null,
    rawSection: string | undefined | null,
    rawDept: string | undefined | null,
    departments: Array<{ id: string; name: string; parent_id: string | null; level?: number }>
): { department_id: string; dept_text: string; section_text: string; unit_text: string | null } | null {
    if (!rawUnit && !rawSection && !rawDept) return null;

    const deptMap = new Map<string, typeof departments[0]>();
    departments.forEach(d => deptMap.set(d.id, d));

    // ─── المرحلة 1: فحص عمود [الوحدة] أولاً بتصاعدي ───
    const cleanUnit = (rawUnit || '').trim();
    if (cleanUnit) {
        const foundUnit = matchDepartmentNode(cleanUnit, departments);
        if (foundUnit) {
            const parentDept = foundUnit.parent_id ? deptMap.get(foundUnit.parent_id) : null;
            const grandParentDept = parentDept?.parent_id ? deptMap.get(parentDept.parent_id) : null;

            // إذا كان الأب شعبة والجد قسم
            if (parentDept && parentDept.level === 4 && grandParentDept && grandParentDept.level === 3) {
                return {
                    department_id: foundUnit.id,
                    dept_text: grandParentDept.name,
                    section_text: parentDept.name,
                    unit_text: foundUnit.name,
                };
            }

            // إذا كانت الوحدة مرتبطة بالقسم مباشرة بدون شعبة (مثل وحدة تصفية الديون التابعة للقسم المالي)
            if (parentDept && parentDept.level === 3) {
                return {
                    department_id: foundUnit.id,
                    dept_text: parentDept.name,
                    section_text: '',
                    unit_text: foundUnit.name,
                };
            }

            // إذا كانت الوحدة تابعة للإدارة العليا
            return {
                department_id: foundUnit.id,
                dept_text: grandParentDept?.name || 'كربلاء',
                section_text: parentDept?.name || '',
                unit_text: foundUnit.name,
            };
        }
    }

    // ─── المرحلة 2: إن كانت الوحدة فارغة، فحص عمود [الشعبة / المجمع] ───
    const cleanSection = (rawSection || '').trim();
    if (cleanSection) {
        const foundSec = matchDepartmentNode(cleanSection, departments);
        if (foundSec) {
            const parentDept = foundSec.parent_id ? deptMap.get(foundSec.parent_id) : null;

            // الحالة 2.1: شعبة تابعة لقسم رئيسي (المستوى 4)
            if (foundSec.level === 4) {
                return {
                    department_id: foundSec.id,
                    dept_text: parentDept ? parentDept.name : 'كربلاء',
                    section_text: foundSec.name,
                    unit_text: null,
                };
            }

            // الحالة 2.2: شعب مستقلة ومجمعات وأقسام (المستوى 3)
            if (foundSec.level === 3) {
                const isSecOrComplex = foundSec.name.startsWith('شعبة') ||
                    foundSec.name.startsWith('شعبه') ||
                    foundSec.name.startsWith('الشعبة') ||
                    foundSec.name.startsWith('مجمع');

                if (isSecOrComplex) {
                    return {
                        department_id: foundSec.id,
                        dept_text: 'كربلاء',
                        section_text: foundSec.name,
                        unit_text: null,
                    };
                } else {
                    return {
                        department_id: foundSec.id,
                        dept_text: foundSec.name,
                        section_text: '',
                        unit_text: null,
                    };
                }
            }

            // الإدارة العليا
            return {
                department_id: foundSec.id,
                dept_text: 'كربلاء',
                section_text: foundSec.name,
                unit_text: null,
            };
        }
    }

    // ─── المرحلة 3: إن كانت الوحدة والشعبة فارغتين، فحص عمود [القسم] ───
    const cleanDept = (rawDept || '').trim();
    if (cleanDept) {
        const foundDept = matchDepartmentNode(cleanDept, departments);
        if (foundDept) {
            return {
                department_id: foundDept.id,
                dept_text: foundDept.name,
                section_text: '',
                unit_text: null,
            };
        }
    }

    return null;
}

/** واجهة تعيين المناصب الإدارية التلقائية المستنتجة */
export interface PositionAssignment {
    managerDeptId?: string;
    managerDeptName?: string;
    deputyDeptId?: string;
    deputyDeptName?: string;
    positionTitle: string;
    isAmbiguous?: boolean;
    ambiguityReason?: string;
}

/**
 * تحليل ذكي لعمود [المنصب الإداري] وتعيين manager_id و deputy_manager_id في جدول departments
 */
export function resolvePositionAssignments(
    rawPosition: string | undefined | null,
    resolvedDept: { department_id: string; dept_text: string; section_text: string; unit_text: string | null } | null,
    departments: Array<{ id: string; name: string; parent_id: string | null; level?: number }>
): PositionAssignment {
    if (!rawPosition) return { positionTitle: '' };

    const posTrim = String(rawPosition).trim();
    const posNorm = normalizeArabicText(posTrim);

    // 1. تجاوز الأخطاء الصريحة المعروفة (مس)
    if (posNorm === 'مس') {
        return { positionTitle: '' };
    }

    const deptMap = new Map<string, typeof departments[0]>();
    departments.forEach(d => deptMap.set(d.id, d));

    const result: PositionAssignment = {
        positionTitle: posTrim
    };

    const parts = posTrim.split('/').map(p => p.trim()).filter(Boolean);

    const empDept = resolvedDept?.department_id ? deptMap.get(resolvedDept.department_id) : null;
    const parentDept = empDept?.parent_id ? deptMap.get(empDept.parent_id) : null;

    let mainDept: typeof departments[0] | null = null;
    if (empDept?.level === 3 && empDept.name.startsWith('قسم')) mainDept = empDept;
    else if (parentDept?.level === 3 && parentDept.name.startsWith('قسم')) mainDept = parentDept;

    for (const part of parts) {
        const normPart = normalizeArabicText(part);

        // ─── مسار المدير / المسؤول (Manager) ───
        if (normPart.includes('مدير المديرية')) {
            const dirDept = departments.find(d => normalizeArabicText(d.name).includes('مدير المديرية') && d.level === 1);
            if (dirDept) {
                result.managerDeptId = dirDept.id;
                result.managerDeptName = dirDept.name;
            }
        } else if (normPart.includes('معاون مدير المديرية')) {
            const asstDept = departments.find(d => normalizeArabicText(d.name).includes('معاون') && d.level === 2);
            if (asstDept) {
                result.managerDeptId = asstDept.id;
                result.managerDeptName = asstDept.name;
            }
            const dirDept = departments.find(d => normalizeArabicText(d.name).includes('مدير المديرية') && d.level === 1);
            if (dirDept) {
                result.deputyDeptId = dirDept.id;
                result.deputyDeptName = dirDept.name;
            }
        } else if (normPart.includes('مدير قسم') || normPart.includes('مسؤول قسم')) {
            if (mainDept) {
                result.managerDeptId = mainDept.id;
                result.managerDeptName = mainDept.name;
            } else {
                result.isAmbiguous = true;
                result.ambiguityReason = 'صفة مدير قسم ولكن لم يتم العثور على قسم رئيسي للموظف';
            }
        } else if (normPart.includes('مسؤول شعبة') || normPart.includes('مسؤول الشعبة') || normPart.includes('مسؤول مجمع')) {
            if (empDept && (empDept.level === 4 || (empDept.level === 3 && (empDept.name.startsWith('شعبة') || empDept.name.startsWith('مجمع'))))) {
                result.managerDeptId = empDept.id;
                result.managerDeptName = empDept.name;
            } else {
                result.isAmbiguous = true;
                result.ambiguityReason = 'صفة مسؤول شعبة/مجمع ولكن الموظف غير مسجل ضمن شعبة أو مجمع محدد';
            }
        } else if (normPart.includes('مسؤول وحدة') || normPart.includes('مسؤول الوحدة')) {
            if (empDept && (empDept.level === 5 || empDept.name.includes('وحد'))) {
                result.managerDeptId = empDept.id;
                result.managerDeptName = empDept.name;
            } else {
                result.isAmbiguous = true;
                result.ambiguityReason = 'صفة مسؤول وحدة ولكن الموظف غير مرتبط بوحدة محددة';
            }
        }

        // ─── مسار البديل (Deputy) ───
        if (normPart.includes('بديل')) {
            if (normPart.includes('بديل مدير قسم') || normPart.includes('بديل مسؤول قسم')) {
                if (mainDept) {
                    result.deputyDeptId = mainDept.id;
                    result.deputyDeptName = mainDept.name;
                } else {
                    result.isAmbiguous = true;
                    result.ambiguityReason = 'صفة بديل مدير قسم ولكن لم يُستنتج القسم الرئيسي';
                }
            } else if (normPart.includes('بديل مسؤول شعبة') || normPart.includes('بديل مسؤول الشعبة') || normPart.includes('بديل مسؤول مجمع') || normPart.includes('بديل مدير شعبة')) {
                // البحث عما إذا ذُكر اسم شعبة محددة في الشطر (مثل: بديل مسؤول شعبة التسويق)
                const targetSec = departments.find(d => {
                    if (d.level !== 4 && d.level !== 3) return false;
                    const stemD = cleanDepartmentStem(d.name);
                    return stemD.length >= 3 && normPart.includes(stemD);
                });

                if (targetSec && targetSec.id !== empDept?.id) {
                    result.deputyDeptId = targetSec.id;
                    result.deputyDeptName = targetSec.name;
                } else if (result.managerDeptId && result.managerDeptId === empDept?.id && mainDept) {
                    // الموظف مسؤول لشعبته الحالية وله منصب بديل مسؤول شعبة (حالة زينب صباح):
                    // البحث عن الشعبة الشقيقة تحت نفس القسم
                    const siblingSec = departments.find(d => d.parent_id === mainDept.id && d.id !== empDept.id && d.level === 4);
                    if (siblingSec) {
                        result.deputyDeptId = siblingSec.id;
                        result.deputyDeptName = siblingSec.name;
                    } else {
                        result.isAmbiguous = true;
                        result.ambiguityReason = 'مسؤول شعبة وبديل لشعبة شقيقة ولكن لم يُعثر على شعبة شقيقة في نفس القسم';
                    }
                } else if (empDept) {
                    result.deputyDeptId = empDept.id;
                    result.deputyDeptName = empDept.name;
                } else {
                    result.isAmbiguous = true;
                    result.ambiguityReason = 'صفة بديل مسؤول ولكن الموظف غير مسجل ضمن تشكيل محدد';
                }
            } else if (normPart.includes('بديل مسؤول وحدة') || normPart.includes('بديل مسؤول الوحدة')) {
                if (empDept && (empDept.level === 5 || empDept.name.includes('وحد'))) {
                    result.deputyDeptId = empDept.id;
                    result.deputyDeptName = empDept.name;
                }
            }
        }
    }

    return result;
}

/**
 * 🧠 فحص وتدقيق النزاهة الدلالية للحقول المالية (Semantic Financial Validation & Auto-Correction)
 * يضمن التوافق الحتمي بين الشهادة والنسبة والمخصصات والراتب الاسمي، ويمنع أخطاء إكسل الكسرية.
 */
export function resolveFinancialIntegrity(newValues: Record<string, any>): { warnings: string[] } {
    const warnings: string[] = [];
    const nom = Number(newValues.nominal_salary || 0);

    // 1. تدقيق الشهادة والنسبة
    const certText = String(newValues.certificate_text || '').trim();
    let certPerc = Number(newValues.certificate_percentage || 0);

    // تطبيع النسبة الكسرية الناتجة عن إكسل (مثل 0.45 تصبح 45)
    if (certPerc > 0 && certPerc <= 1.5) {
        certPerc = Math.round(certPerc * 100);
        newValues.certificate_percentage = certPerc;
    }

    if (certText) {
        const normCert = certText.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
        const matchedCert = CERTIFICATES.find(c => {
            const normLabel = c.label.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
            if (normCert.includes(normLabel)) return true;
            if (c.aliases) {
                return c.aliases.some(a => normCert.includes(a.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه')));
            }
            return false;
        });

        if (matchedCert) {
            // إن لم تكن النسبة محددة أو كانت 0، تُستنتج حتمياً من مسمى الشهادة
            if (!certPerc || certPerc === 0) {
                newValues.certificate_percentage = matchedCert.percentage;
                certPerc = matchedCert.percentage;
                warnings.push(`استنتاج ذكي: تم تحديد نسبة الشهادة تلقائياً (${matchedCert.percentage}%) وفق شهادة «${matchedCert.label}».`);
            } else if (certPerc !== matchedCert.percentage) {
                // إذا كانت النسبة في الملف تختلف عن نسبة الشهادة، نتحقق من مخصصات الشهادة للتأكيد
                const certAllowance = Number(newValues.certificate_allowance || 0);
                if (nom > 0 && certAllowance > 0) {
                    const deducedPerc = Math.round((certAllowance / nom) * 100);
                    if (deducedPerc === matchedCert.percentage) {
                        warnings.push(`تصحيح تلقائي: تم تصحيح نسبة الشهادة من (${certPerc}%) إلى (${matchedCert.percentage}%) لمطابقة «${matchedCert.label}» والمخصصات الفعلية.`);
                        newValues.certificate_percentage = matchedCert.percentage;
                    } else if (deducedPerc === certPerc) {
                        warnings.push(`تنبيه مالي: مخصصات الشهادة محسوبة بنسبة (${certPerc}%) بينما الشهادة مسجلة «${certText}» (المعيار: ${matchedCert.percentage}%).`);
                    } else {
                        warnings.push(`تضارب: الشهادة «${certText}» (تستحق ${matchedCert.percentage}%) ولكن النسبة في الملف (${certPerc}%).`);
                    }
                } else {
                    warnings.push(`تضارب: الشهادة «${certText}» (تستحق ${matchedCert.percentage}%) بينما النسبة في الملف (${certPerc}%).`);
                }
            }
        }
    }

    // 2. تدقيق الخطورة والقانونية (حظر الجمع)
    const risk = Number(newValues.risk_allowance || 0);
    const legal = Number(newValues.legal_allowance || 0);
    if (risk > 0 && legal > 0) {
        warnings.push(`مخالفة تعليمات: الجمع بين مخصصات الخطورة ومخصصات القانونية غير جائز.`);
    }

    // 3. تدقيق المخصصات الهندسية مع الشهادة
    const eng = Number(newValues.engineering_allowance || 0);
    if (eng > 0 && certText) {
        const isBelowBachelor = /(دبلوم|اعدادي|متوسط|ابتدائي|يقرأ|أمي|بدون)/.test(certText);
        if (isBelowBachelor && !certText.includes('بكالوريوس') && !certText.includes('بكلوريوس')) {
            warnings.push(`مراجعة: مخصصات هندسية مسجلة بينما شهادة الموظف «${certText}» أقل من بكالوريوس.`);
        }
    }

    return { warnings };
}
