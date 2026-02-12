import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Check, X, AlertTriangle, CheckCircle2, Printer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { useTheme } from '../../context/ThemeContext';

// ===== النسب المعتمدة حسب rwservlet.xml =====
const APPROVED_PERCENTAGES: Record<string, number | null> = {
    // المخصصات
    certificate_allowance: null,      // تعتمد على نوع الشهادة (يُقرأ من حقل certificate_percentage)
    engineering_allowance: 35,
    legal_allowance: 30,
    transport_allowance: null,        // مبلغ ثابت وليس نسبة
    marital_allowance: null,          // مبلغ ثابت
    children_allowance: null,         // حسب عدد الأطفال
    position_allowance: 15,
    risk_allowance: null,             // يُقرأ من حقل risk_percentage
    additional_50_percent_allowance: 50,
    // الاستقطاعات
    tax_deduction_amount: null,       // شرائح ضريبية معقدة
    loan_deduction: null,             // مبلغ محدد
    execution_deduction: null,        // مبلغ محدد
    retirement_deduction: 10,
    school_stamp_deduction: null,     // مبلغ ثابت (1000)
    social_security_deduction: 0.25,
    other_deductions: null,
};

// أسماء الحقول المالية
const ALLOWANCE_FIELDS = [
    { key: 'certificate_allowance', label: 'م. الشهادة' },
    { key: 'engineering_allowance', label: 'م. هندسية' },
    { key: 'legal_allowance', label: 'م. القانونية' },
    { key: 'position_allowance', label: 'م. المنصب' },
    { key: 'risk_allowance', label: 'م. الخطورة' },
    { key: 'additional_50_percent_allowance', label: 'م. اضافية 50%' },
];

const DEDUCTION_FIELDS = [
    { key: 'retirement_deduction', label: 'استقطاع التقاعد' },
    { key: 'social_security_deduction', label: 'استقطاع الحماية الاجتماعية' },
    { key: 'tax_deduction_amount', label: 'الاستقطاع الضريبي' },
];

interface CustomAuditProps {
    onClose: () => void;
}

export function CustomAudit({ onClose }: CustomAuditProps) {
    const { theme } = useTheme();
    const searchRef = useRef<HTMLDivElement>(null);

    // === حالة الفورم ===
    const [scope, setScope] = useState<'all' | 'specific'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [auditType, setAuditType] = useState<'allowances' | 'deductions' | null>(null);
    const [selectedField, setSelectedField] = useState('');
    const [userPercentage, setUserPercentage] = useState('');
    const [validationState, setValidationState] = useState<'idle' | 'match' | 'mismatch'>('idle');
    const [approvedPercentage, setApprovedPercentage] = useState<number | null>(null);
    const [auditResult, setAuditResult] = useState<number | null>(null);
    const [recalcResult, setRecalcResult] = useState<number | null>(null);
    const [currentValue, setCurrentValue] = useState<number | null>(null);
    const [financialData, setFinancialData] = useState<any>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [allEmployees, setAllEmployees] = useState<any[]>([]);
    const [selectedAllIdx, setSelectedAllIdx] = useState(0);
    const printRef = useRef<HTMLDivElement>(null);

    // === بحث الاقتراحات (debounced) ===
    useEffect(() => {
        if (scope !== 'specific' || !searchQuery.trim()) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearching(true);
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, job_number')
                .or(`job_number.ilike.${searchQuery.trim()}%,full_name.ilike.${searchQuery.trim()}%`)
                .limit(10);
            setSuggestions(data || []);
            setShowSuggestions((data || []).length > 0);
            setIsSearching(false);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, scope]);

    // === جلب البيانات المالية ===
    const loadFinancialData = async (userId: string) => {
        const { data } = await supabase
            .from('financial_records')
            .select('*')
            .eq('user_id', userId)
            .single();
        setFinancialData(data);
        resetAuditResults();
    };

    // === جلب كل الموظفين (للنطاق الشامل) ===
    const loadAllEmployees = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, job_number')
            .order('full_name');
        setAllEmployees(data || []);
        if (data && data.length > 0) {
            setSelectedEmployee(data[0]);
            loadFinancialData(data[0].id);
        }
    };

    useEffect(() => {
        if (scope === 'all') {
            loadAllEmployees();
        } else {
            setAllEmployees([]);
            setSelectedEmployee(null);
            setFinancialData(null);
            resetAuditResults();
        }
    }, [scope]);

    const handleSelectSuggestion = (user: any) => {
        setSelectedEmployee(user);
        setSearchQuery(user.full_name);
        setShowSuggestions(false);
        loadFinancialData(user.id);
    };

    const resetAuditResults = () => {
        setValidationState('idle');
        setAuditResult(null);
        setRecalcResult(null);
        setCurrentValue(null);
        setApprovedPercentage(null);
    };

    // === حل النسبة المعتمدة الديناميكية ===
    const getApprovedPercentage = (fieldKey: string): number | null => {
        if (!financialData) return null;

        // 1. الحقول ذات النسب الديناميكية (تُقرأ من البيانات المالية)
        if (fieldKey === 'certificate_allowance') {
            const pct = parseFloat(financialData.certificate_percentage);
            return isNaN(pct) ? null : pct;
        }
        if (fieldKey === 'risk_allowance') {
            const pct = parseFloat(financialData.risk_percentage);
            return isNaN(pct) ? null : pct;
        }

        // 2. الحقول ذات النسب الثابتة المعروفة
        const fixed = APPROVED_PERCENTAGES[fieldKey];
        if (fixed !== undefined && fixed !== null) return fixed;

        // 3. إذا لم تكن النسبة معروفة، نحسبها عكسياً من القيمة المخزنة
        const nomSal = parseFloat(financialData.nominal_salary) || 0;
        const storedVal = parseFloat(financialData[fieldKey]) || 0;
        if (nomSal > 0 && storedVal > 0) {
            const calculated = Math.round((storedVal / nomSal) * 10000) / 100; // دقة منزلتين
            return calculated;
        }

        return null;
    };

    // === تنفيذ التحقق ===
    const handleVerify = () => {
        if (!financialData || !selectedField || !userPercentage) return;

        const nominalSalary = parseFloat(financialData.nominal_salary) || 0;
        const userPct = parseFloat(userPercentage);
        const approved = getApprovedPercentage(selectedField);
        const fieldCurrentValue = parseFloat(financialData[selectedField]) || 0;

        setApprovedPercentage(approved);
        setCurrentValue(fieldCurrentValue);

        // ناتج التدقيق بنسبة المستخدم
        const userCalc = Math.round((nominalSalary * userPct) / 100);
        setAuditResult(userCalc);

        // إعادة الاحتساب بالنسبة المعتمدة
        if (approved !== null) {
            const approvedCalc = Math.round((nominalSalary * approved) / 100);
            setRecalcResult(approvedCalc);
            // مقارنة النسبة المدخلة بالنسبة المعتمدة
            setValidationState(Math.abs(userPct - approved) < 0.01 ? 'match' : 'mismatch');
        } else {
            // لا توجد نسبة معتمدة → نقارن الناتج مع القيمة الحالية
            setRecalcResult(null);
            setValidationState(userCalc === fieldCurrentValue ? 'match' : 'mismatch');
        }
    };

    // === تنسيق الأرقام ===
    const fmt = (n: number | null) => n !== null ? n.toLocaleString('en-US') : '—';

    // === طباعة PDF ===
    const handlePrint = () => {
        if (!printRef.current) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const fieldLabel = [...ALLOWANCE_FIELDS, ...DEDUCTION_FIELDS].find(f => f.key === selectedField)?.label || '';

        printWindow.document.write(`
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>تقرير تدقيق مخصص</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Tajawal', sans-serif; padding: 40px; color: #1a1a1a; background: white; }
        .header { border-bottom: 3px solid #000; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; }
        .header h1 { font-size: 22px; font-weight: 700; }
        .header .meta { text-align: left; color: #666; font-size: 12px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; }
        .info-item { background: #f8f8f8; border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px; }
        .info-item .label { font-size: 11px; color: #888; margin-bottom: 4px; }
        .info-item .value { font-size: 16px; font-weight: 700; }
        .result-section { border: 2px solid #e5e5e5; border-radius: 12px; padding: 20px; margin-top: 20px; }
        .result-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px dashed #ddd; }
        .result-row:last-child { border: none; }
        .result-row .label { color: #555; font-size: 13px; }
        .result-row .value { font-weight: 700; font-size: 16px; direction: ltr; }
        .match { color: #16a34a; }
        .mismatch { color: #dc2626; }
        .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #ccc; text-align: center; color: #999; font-size: 11px; }
        @media print { body { padding: 20px; } }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1>تقرير تدقيق مخصص</h1>
            <p style="color:#666;margin-top:5px">دائرة المعلوماتية وتكنولوجيا الاتصالات - كربلاء المقدسة</p>
        </div>
        <div class="meta">
            <p>تاريخ التقرير: ${new Date().toLocaleDateString('en-GB')}</p>
            <p>نوع التدقيق: ${auditType === 'allowances' ? 'مخصصات' : 'استقطاعات'}</p>
        </div>
    </div>

    <div class="info-grid">
        <div class="info-item">
            <div class="label">اسم الموظف</div>
            <div class="value">${selectedEmployee?.full_name || '—'}</div>
        </div>
        <div class="info-item">
            <div class="label">الرقم الوظيفي</div>
            <div class="value">${selectedEmployee?.job_number || '—'}</div>
        </div>
        <div class="info-item">
            <div class="label">الراتب الاسمي</div>
            <div class="value">${fmt(financialData?.nominal_salary)} د.ع</div>
        </div>
        <div class="info-item">
            <div class="label">نوع الحقل المدقق</div>
            <div class="value">${fieldLabel}</div>
        </div>
    </div>

    <div class="result-section">
        <div class="result-row">
            <span class="label">النسبة المُدخلة</span>
            <span class="value">${userPercentage}%</span>
        </div>
        <div class="result-row">
            <span class="label">النسبة المعتمدة</span>
            <span class="value">${approvedPercentage !== null ? approvedPercentage + '%' : 'غير محددة'}</span>
        </div>
        <div class="result-row">
            <span class="label">ناتج التدقيق (بنسبة المستخدم)</span>
            <span class="value">${fmt(auditResult)} د.ع</span>
        </div>
        ${recalcResult !== null ? `
        <div class="result-row">
            <span class="label">إعادة الاحتساب (بالنسبة المعتمدة)</span>
            <span class="value">${fmt(recalcResult)} د.ع</span>
        </div>` : ''}
        <div class="result-row">
            <span class="label">القيمة الحالية في المالية</span>
            <span class="value">${fmt(currentValue)} د.ع</span>
        </div>
        <div class="result-row">
            <span class="label">حالة التدقيق</span>
            <span class="value ${validationState === 'match' ? 'match' : 'mismatch'}">${validationState === 'match' ? '✓ مطابق' : '✗ غير مطابق'}</span>
        </div>
    </div>

    <div class="footer">
        <p>هذا التقرير صادر من نظام إدارة الموارد البشرية - قسم المعلوماتية | تقرير تدقيقي لأغراض المراجعة</p>
    </div>
</body>
</html>`);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };

    // === ألوان سمة ===
    const cardBg = theme === 'light' ? 'bg-white border-gray-200' : 'bg-white/5 border-white/10';
    const labelClr = theme === 'light' ? 'text-gray-600' : 'text-white/60';
    const textClr = theme === 'light' ? 'text-gray-900' : 'text-white';
    const inputBg = theme === 'light' ? 'bg-gray-50 border-gray-200 text-gray-900' : 'bg-black/40 border-white/10 text-white';
    const mutedBg = theme === 'light' ? 'bg-gray-100/80' : 'bg-white/5';

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300" ref={printRef}>

            {/* ======= صف 1: النطاق + البحث ======= */}
            <div className={cn("rounded-xl border p-4", cardBg)}>
                <div className="flex flex-col sm:flex-row gap-3">
                    {/* نطاق التدقيق */}
                    <div className="flex-shrink-0 w-full sm:w-44">
                        <label className={cn("text-xs font-bold mb-1.5 block", labelClr)}>نطاق التدقيق</label>
                        <select
                            value={scope}
                            onChange={e => {
                                setScope(e.target.value as 'all' | 'specific');
                                setSelectedEmployee(null);
                                setSearchQuery('');
                                resetAuditResults();
                            }}
                            className={cn("w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:border-brand-green/50", inputBg)}
                        >
                            <option value="all">كل المنتسبين</option>
                            <option value="specific">اسم محدد</option>
                        </select>
                    </div>

                    {/* حقل البحث */}
                    <div className="flex-1 relative" ref={searchRef}>
                        <label className={cn("text-xs font-bold mb-1.5 block", labelClr)}>
                            {scope === 'all' ? 'التنقل بين الموظفين' : 'البحث عن موظف'}
                        </label>
                        {scope === 'specific' ? (
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="الرقم الوظيفي أو الاسم..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                                    className={cn("w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:border-brand-green/50 pr-9", inputBg)}
                                />
                                <Search className={cn("absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4", labelClr)} />
                                {isSearching && (
                                    <div className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-brand-green/50 border-t-transparent rounded-full animate-spin")} />
                                )}

                                {/* الاقتراحات */}
                                {showSuggestions && suggestions.length > 0 && searchRef.current && createPortal(
                                    <div
                                        className={cn(
                                            "fixed backdrop-blur-xl border rounded-lg shadow-2xl overflow-hidden z-[9999] max-h-[180px] overflow-y-auto",
                                            theme === 'light' ? 'bg-white border-gray-200' : 'bg-slate-900/95 border-white/10'
                                        )}
                                        style={{
                                            top: `${searchRef.current.getBoundingClientRect().bottom + 4}px`,
                                            left: `${searchRef.current.getBoundingClientRect().left}px`,
                                            width: `${searchRef.current.getBoundingClientRect().width}px`
                                        }}
                                    >
                                        {suggestions.map((user, idx) => (
                                            <button
                                                key={user.id || idx}
                                                type="button"
                                                onMouseDown={e => e.preventDefault()}
                                                onClick={() => handleSelectSuggestion(user)}
                                                className={cn(
                                                    "w-full text-right px-3 py-2 border-b last:border-0 flex items-center justify-between transition-colors",
                                                    theme === 'light' ? 'hover:bg-gray-100 border-gray-100' : 'hover:bg-white/10 border-white/5'
                                                )}
                                            >
                                                <span className={cn("text-sm font-bold", textClr)}>{user.full_name}</span>
                                                <span className={cn("text-xs font-mono", labelClr)}>{user.job_number}</span>
                                            </button>
                                        ))}
                                    </div>,
                                    document.body
                                )}
                            </div>
                        ) : (
                            <select
                                value={selectedAllIdx}
                                onChange={e => {
                                    const idx = parseInt(e.target.value);
                                    setSelectedAllIdx(idx);
                                    const emp = allEmployees[idx];
                                    if (emp) {
                                        setSelectedEmployee(emp);
                                        loadFinancialData(emp.id);
                                    }
                                }}
                                className={cn("w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:border-brand-green/50", inputBg)}
                            >
                                {allEmployees.map((emp, i) => (
                                    <option key={emp.id} value={i}>{emp.full_name} — {emp.job_number}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                {/* بطاقة الموظف المختار */}
                {selectedEmployee && financialData && (
                    <div className={cn("mt-3 rounded-lg p-3 flex items-center justify-between", mutedBg)}>
                        <div className="flex items-center gap-3">
                            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold", theme === 'light' ? 'bg-brand-green/10 text-brand-green' : 'bg-brand-green/20 text-brand-green')}>
                                {selectedEmployee.full_name?.charAt(0)}
                            </div>
                            <div>
                                <span className={cn("text-sm font-bold", textClr)}>{selectedEmployee.full_name}</span>
                                <span className={cn("text-xs mr-3 font-mono", labelClr)}>#{selectedEmployee.job_number}</span>
                            </div>
                        </div>
                        <div className="text-left">
                            <span className={cn("text-[10px] block", labelClr)}>الراتب الاسمي</span>
                            <span className={cn("text-sm font-bold font-mono", textClr)}>{fmt(financialData?.nominal_salary)}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* ======= صف 2: نوع التدقيق (Radio) + القائمة ======= */}
            <div className={cn("rounded-xl border p-4", cardBg)}>
                <label className={cn("text-xs font-bold mb-3 block", labelClr)}>نوع التدقيق</label>
                <div className="flex gap-4 mb-3">
                    {/* المخصصات */}
                    <label className={cn(
                        "flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl border transition-all flex-1 justify-center",
                        auditType === 'allowances'
                            ? theme === 'light'
                                ? 'bg-cyan-50 border-cyan-300 text-cyan-700'
                                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                            : theme === 'light'
                                ? 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                                : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                    )}>
                        <input
                            type="radio"
                            name="auditType"
                            checked={auditType === 'allowances'}
                            onChange={() => { setAuditType('allowances'); setSelectedField(''); resetAuditResults(); }}
                            className="accent-cyan-500 w-4 h-4"
                        />
                        <span className="text-sm font-bold">المخصصات</span>
                    </label>

                    {/* الاستقطاعات */}
                    <label className={cn(
                        "flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl border transition-all flex-1 justify-center",
                        auditType === 'deductions'
                            ? theme === 'light'
                                ? 'bg-violet-50 border-violet-300 text-violet-700'
                                : 'bg-violet-500/10 border-violet-500/30 text-violet-400'
                            : theme === 'light'
                                ? 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                                : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                    )}>
                        <input
                            type="radio"
                            name="auditType"
                            checked={auditType === 'deductions'}
                            onChange={() => { setAuditType('deductions'); setSelectedField(''); resetAuditResults(); }}
                            className="accent-violet-500 w-4 h-4"
                        />
                        <span className="text-sm font-bold">الاستقطاعات</span>
                    </label>
                </div>

                {/* قائمة الحقل المحدد */}
                {auditType && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                        <label className={cn("text-xs font-bold mb-1.5 block", labelClr)}>
                            {auditType === 'allowances' ? 'اختر نوع المخصص' : 'اختر نوع الاستقطاع'}
                        </label>
                        <select
                            value={selectedField}
                            onChange={e => { setSelectedField(e.target.value); resetAuditResults(); }}
                            className={cn("w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:border-brand-green/50", inputBg)}
                        >
                            <option value="">— اختر —</option>
                            {(auditType === 'allowances' ? ALLOWANCE_FIELDS : DEDUCTION_FIELDS).map(f => (
                                <option key={f.key} value={f.key}>{f.label}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* ======= صف 3: نسبة الاحتساب + زر التحقق ======= */}
            {selectedField && financialData && (
                <div className={cn("rounded-xl border p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200", cardBg)}>
                    <label className={cn("text-xs font-bold block", labelClr)}>نسبة الاحتساب من الراتب الاسمي</label>
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                inputMode="decimal"
                                value={userPercentage}
                                onChange={e => {
                                    const val = e.target.value.replace(/[^\d.]/g, '');
                                    setUserPercentage(val);
                                    setValidationState('idle');
                                }}
                                placeholder="0"
                                dir="ltr"
                                className={cn(
                                    "w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:border-brand-green/50 font-mono text-center text-lg tracking-wider",
                                    inputBg
                                )}
                            />
                            {/* علامة % يمين الحقل */}
                            <span className={cn("absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold", labelClr)}>%</span>
                            {/* زر الصح الأخضر يسار الحقل */}
                            <button
                                type="button"
                                onClick={handleVerify}
                                disabled={!userPercentage}
                                className={cn(
                                    "absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center transition-all",
                                    userPercentage
                                        ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30 cursor-pointer'
                                        : 'bg-gray-300 dark:bg-white/10 text-gray-500 dark:text-white/20 cursor-not-allowed'
                                )}
                            >
                                <Check className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* === تحذير المطابقة === */}
                    {validationState !== 'idle' && (
                        <div className={cn(
                            "rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm font-bold animate-in fade-in zoom-in duration-200",
                            validationState === 'match'
                                ? theme === 'light' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-green-500/10 border border-green-500/20 text-green-400'
                                : theme === 'light' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-red-500/10 border border-red-500/20 text-red-400'
                        )}>
                            {validationState === 'match' ? (
                                <>
                                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                                    <span>النسبة صحيحة ومطابقة للنسبة المعمول بها</span>
                                </>
                            ) : (
                                <>
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                    <span>النسبة التي أدخلتها لا تساوي النسبة المعمول بها ({approvedPercentage}%) في التطبيق</span>
                                </>
                            )}
                        </div>
                    )}

                    {/* === نتائج التدقيق === */}
                    {auditResult !== null && (
                        <div className={cn("rounded-xl border p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300", mutedBg, theme === 'light' ? 'border-gray-200' : 'border-white/10')}>

                            {/* ناتج التدقيق */}
                            <div className="flex items-center justify-between">
                                <span className={cn("text-xs font-bold", labelClr)}>ناتج التدقيق (بنسبتك)</span>
                                <div className="flex items-center gap-2">
                                    <span className={cn("text-lg font-bold font-mono", textClr)}>{fmt(auditResult)}</span>
                                    <span className={cn("text-xs font-mono px-1.5 py-0.5 rounded", theme === 'light' ? 'bg-gray-200 text-gray-600' : 'bg-white/10 text-white/50')}>{userPercentage}%</span>
                                </div>
                            </div>

                            {/* إعادة الاحتساب بالنسبة المعتمدة */}
                            {recalcResult !== null && approvedPercentage !== null && (
                                <div className="flex items-center justify-between border-t border-dashed pt-3" style={{ borderColor: theme === 'light' ? '#ddd' : 'rgba(255,255,255,0.1)' }}>
                                    <span className={cn("text-xs font-bold", labelClr)}>إعادة الاحتساب (النسبة المعتمدة)</span>
                                    <div className="flex items-center gap-2">
                                        <span className={cn("text-lg font-bold font-mono", validationState === 'match' ? 'text-green-500' : 'text-amber-500')}>{fmt(recalcResult)}</span>
                                        <span className={cn("text-xs font-mono px-1.5 py-0.5 rounded", validationState === 'match' ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500')}>{approvedPercentage}%</span>
                                    </div>
                                </div>
                            )}

                            {/* القيمة الحالية من المالية */}
                            <div className="flex items-center justify-between border-t border-dashed pt-3" style={{ borderColor: theme === 'light' ? '#ddd' : 'rgba(255,255,255,0.1)' }}>
                                <span className={cn("text-xs font-bold", labelClr)}>الظاهر حالياً من شعبة المالية</span>
                                <div className="flex items-center gap-2">
                                    <span className={cn("text-lg font-bold font-mono", theme === 'light' ? 'text-blue-600' : 'text-blue-400')}>{fmt(currentValue)}</span>
                                    <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded", theme === 'light' ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/10 text-blue-400')}>المالية</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ======= أزرار التحكم ======= */}
            <div className="flex items-center gap-3 pt-2">
                <button
                    onClick={onClose}
                    className={cn(
                        "flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border",
                        theme === 'light'
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-600 border-gray-200'
                            : 'bg-white/5 hover:bg-white/10 text-white/60 border-white/10'
                    )}
                >
                    <X className="w-4 h-4" />
                    إغلاق
                </button>

                {auditResult !== null && (
                    <button
                        onClick={handlePrint}
                        className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20"
                    >
                        <Printer className="w-4 h-4" />
                        PDF / طباعة
                    </button>
                )}
            </div>
        </div>
    );
}
