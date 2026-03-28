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
            { value: 'password', label: 'كلمة المرور', type: 'text' },
            { value: 'iban', label: 'IBAN', type: 'text' },
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
            { value: 'iban', label: 'IBAN', type: 'text' },
            { value: 'full_name', label: 'الاسم في السجل المالي', type: 'text' },
            { value: 'remaining_leaves_balance', label: 'رصيد الإجازات', type: 'integer' },
            { value: 'leaves_balance_expiry_date', label: 'تاريخ انتهاء رصيد الإجازات', type: 'text' },
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

export { SYSTEM_COLUMNS };
