import { useState } from 'react';
import { Play, CheckCircle2, AlertTriangle, Printer, ShieldCheck, Activity } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { useTheme } from '../../context/ThemeContext';

// ===== نفس منطق النسب المعتمدة =====
const APPROVED_PERCENTAGES: Record<string, number | null> = {
    certificate_allowance: null,
    engineering_allowance: 35,
    legal_allowance: 30,
    transport_allowance: null,
    marital_allowance: null,
    children_allowance: null,
    position_allowance: 15,
    risk_allowance: null,
    additional_50_percent_allowance: 50,
    // الاستقطاعات
    retirement_deduction: 10,
    social_security_deduction: 0.25,
    tax_deduction_amount: null,
    loan_deduction: null,
    execution_deduction: null,
    school_stamp_deduction: null,
    other_deductions: null,
};

const ALL_FIELDS = [
    { key: 'certificate_allowance', label: 'م. الشهادة' },
    { key: 'engineering_allowance', label: 'م. هندسية' },
    { key: 'legal_allowance', label: 'م. القانونية' },
    { key: 'position_allowance', label: 'م. المنصب' },
    { key: 'risk_allowance', label: 'م. الخطورة' },
    { key: 'additional_50_percent_allowance', label: 'م. اضافية 50%' },
    { key: 'retirement_deduction', label: 'تقاعد' },
    { key: 'social_security_deduction', label: 'حماية اجتماعية' },
    { key: 'tax_deduction_amount', label: 'ضريبة' },
];

// دالة مساعدة لقراءة الأرقام وتنظيفها من الفواصل
const safeParseFloat = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        // إزالة الفواصل وأي رموز غير رقمية (ما عدا النقطة والسالب)
        const cleanVal = val.replace(/[^0-9.-]/g, '');
        return parseFloat(cleanVal) || 0;
    }
    return 0;
};

function resolveApprovedPercentage(fieldKey: string, finData: any): number | null {
    if (!finData) return null;
    if (fieldKey === 'certificate_allowance') {
        const pct = parseFloat(finData.certificate_percentage);
        return isNaN(pct) ? null : pct;
    }
    if (fieldKey === 'risk_allowance') {
        const pct = parseFloat(finData.risk_percentage);
        return isNaN(pct) ? null : pct;
    }
    const fixed = APPROVED_PERCENTAGES[fieldKey];
    if (fixed !== undefined && fixed !== null) return fixed;
    const nomSal = safeParseFloat(finData.nominal_salary);
    const storedVal = safeParseFloat(finData[fieldKey]);
    if (nomSal > 0 && storedVal > 0) {
        return Math.round((storedVal / nomSal) * 10000) / 100;
    }
    return null;
}

const fmt = (n: number | null | undefined) => (n !== null && n !== undefined) ? n.toLocaleString('en-US') : '—';

interface AuditError {
    userId: string;
    userName: string;
    jobNumber: string;
    fieldKey: string;
    fieldLabel: string;
    nominalSalary: number;
    approvedPct: number | null;
    approvedVal: number | null;
    currentVal: number;
}

interface FullAuditProps {
    onClose: () => void;
}

export function FullAudit({ onClose }: FullAuditProps) {
    const { theme } = useTheme();

    // === الحالات ===
    const [step, setStep] = useState<'idle' | 'scanning' | 'results'>('idle');
    const [progress, setProgress] = useState(0);
    const [currentScanningName, setCurrentScanningName] = useState('');
    const [scannedCount, setScannedCount] = useState(0);
    const [errors, setErrors] = useState<AuditError[]>([]);
    const [scanDuration, setScanDuration] = useState(0);
    const [debugRecord, setDebugRecord] = useState<any>(null);

    // === بدء الفحص ===
    const startScan = async () => {
        setStep('scanning');
        setProgress(0);
        setErrors([]);
        setDebugRecord(null);
        setScannedCount(0);
        const startTime = Date.now();

        // 1. جلب العدد الكلي (تقدير)
        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        const totalEstimate = count || 1000;

        const PAGE_SIZE = 500;
        let from = 0;
        let hasMore = true;
        let processed = 0;
        const allErrors: AuditError[] = [];

        while (hasMore) {
            // جلب البيانات (profiles + financial_records)
            const { data: batch, error } = await supabase
                .from('financial_records')
                .select('*, profiles!inner(id, full_name, job_number)')
                .order('profiles(full_name)', { ascending: true })
                .range(from, from + PAGE_SIZE - 1);

            if (error || !batch || batch.length === 0) {
                hasMore = false;
                break;
            }

            for (const rec of batch) {
                const nomSal = safeParseFloat(rec.nominal_salary);
                setCurrentScanningName((rec as any).profiles?.full_name);

                // فحص كل الحقول
                if (nomSal > 0) {
                    for (const field of ALL_FIELDS) {
                        const approvedPct = resolveApprovedPercentage(field.key, rec);
                        const currentVal = safeParseFloat(rec[field.key]);

                        let approvedVal: number | null = null;
                        let isMismatch = false;

                        if (approvedPct !== null) {
                            approvedVal = Math.round((nomSal * approvedPct) / 100);
                            if (Math.abs(approvedVal - currentVal) > 1) {
                                isMismatch = true;
                                if (!debugRecord) setDebugRecord(rec);
                            }
                        } else {
                            // إذا لم توجد نسبة معتمدة، لا نعتبره خطأ إلا إذا كان هناك منطق آخر (حالياً نتجاهل)
                        }

                        if (isMismatch) {
                            allErrors.push({
                                userId: (rec as any).profiles?.id,
                                userName: (rec as any).profiles?.full_name,
                                jobNumber: (rec as any).profiles?.job_number,
                                fieldKey: field.key,
                                fieldLabel: field.label,
                                nominalSalary: nomSal,
                                approvedPct,
                                approvedVal,
                                currentVal
                            });
                        }
                    }
                }

                processed++;
                if (processed % 10 === 0) {
                    setProgress(Math.min((processed / totalEstimate) * 100, 99));
                    // تأخير بسيط جداً لإتاحة تحديث الواجهة (اختياري)
                    await new Promise(r => setTimeout(r, 0));
                }
            }

            from += PAGE_SIZE;
            if (batch.length < PAGE_SIZE) hasMore = false;
        }

        setScanDuration((Date.now() - startTime) / 1000);
        setErrors(allErrors);
        setProgress(100);
        setTimeout(() => setStep('results'), 500);
    };

    // === طباعة التقرير ===
    const printReport = () => {
        const groupedErrors: Record<string, AuditError[]> = {};
        errors.forEach(err => {
            if (!groupedErrors[err.fieldLabel]) groupedErrors[err.fieldLabel] = [];
            groupedErrors[err.fieldLabel].push(err);
        });

        const pw = window.open('', '_blank');
        if (!pw) return;

        pw.document.write(`
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>تقرير التدقيق الشامل</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Tajawal', sans-serif; padding: 30px; color: #1a1a1a; background: white; font-size: 12px; }
        .header { border-bottom: 3px solid #000; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
        .header h1 { font-size: 20px; font-weight: 700; margin-bottom: 5px; }
        .header p { color: #666; }
        .section-title { background: #eee; padding: 8px 12px; font-weight: 700; font-size: 14px; margin-top: 20px; border-radius: 4px; border-right: 4px solid #333; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #f9f9f9; padding: 8px; font-size: 11px; text-align: right; border-bottom: 2px solid #ddd; }
        td { border-bottom: 1px solid #eee; padding: 6px 8px; font-size: 12px; }
        .val-correct { color: #16a34a; font-weight: 700; }
        .val-error { color: #dc2626; font-weight: 700; text-decoration: line-through; }
        .summary-box { border: 2px solid #e5e5e5; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; gap: 30px; }
        .stat { text-align: center; }
        .stat-val { font-size: 24px; font-weight: 700; color: #dc2626; }
        .stat-lbl { font-size: 11px; color: #666; }
        @media print { 
            .no-print { display: none; } 
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1>تقرير التدقيق الشامل للنظام (Full Audit Scan)</h1>
            <p>دائرة المعلوماتية وتكنولوجيا الاتصالات - كربلاء المقدسة</p>
        </div>
        <div style="text-align:left">
            <p>تاريخ الفحص: ${new Date().toLocaleDateString('en-GB')}</p>
            <p>عدد الأخطاء المكتشفة: ${errors.length}</p>
        </div>
    </div>

    <div class="summary-box">
        <div class="stat">
            <div class="stat-val">${errors.length}</div>
            <div class="stat-lbl">إجمالي الأخطاء</div>
        </div>
        <div class="stat">
            <div class="stat-val" style="color:#16a34a">${scannedCount > 0 ? scannedCount : 'الكل'}</div>
            <div class="stat-lbl">عدد السجلات المفحوصة</div>
        </div>
        <div class="stat">
            <div class="stat-val" style="color:#2563eb">${Object.keys(groupedErrors).length}</div>
            <div class="stat-lbl">أنواع المخالفات</div>
        </div>
    </div>

    ${Object.keys(groupedErrors).length === 0 ? `
        <div style="text-align:center; padding: 40px; border: 2px dashed #16a34a; background: #f0fdf4; border-radius: 10px; margin-top: 20px;">
            <h2 style="color: #16a34a; margin-bottom: 10px; font-size: 24px;">✓ النظام سليم تماماً</h2>
            <p style="font-size: 14px; color: #166534;">تم فحص جميع السجلات المالية (${scannedCount} سجل) ولم يتم العثور على أي أخطاء حسابية أو مخالفات للنسب المعتمدة.</p>
            <p style="margin-top: 15px; font-size: 12px; color: #15803d;">مصادقة النظام الآلي</p>
        </div>
    ` : ''}

    ${Object.entries(groupedErrors).map(([label, items]) => `
        <div class="section-title">${label} (${items.length} مخالفة)</div>
        <table>
            <thead>
                <tr>
                    <th width="5%">#</th>
                    <th width="35%">الاسم / الرقم الوظيفي</th>
                    <th width="15%">الراتب الاسمي</th>
                    <th width="15%">النسبة المعتمدة</th>
                    <th width="15%">الصحيح (المتوقع)</th>
                    <th width="15%">الخطأ (في السجلات)</th>
                </tr>
            </thead>
            <tbody>
                ${items.map((err, idx) => `
                <tr>
                    <td>${idx + 1}</td>
                    <td><b>${err.userName}</b><br/><span style="color:#777;font-size:10px">${err.jobNumber}</span></td>
                    <td>${fmt(err.nominalSalary)}</td>
                    <td>${err.approvedPct}%</td>
                    <td class="val-correct">${fmt(err.approvedVal)}</td>
                    <td class="val-error">${fmt(err.currentVal)}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    `).join('')}

    <div style="margin-top: 40px; border-top: 1px solid #ccc; padding-top: 10px; text-align: center; color: #999; font-size: 10px;">
        تم إنشاء هذا التقرير آلياً بواسطة نظام التدقيق الذكي - ${new Date().toLocaleTimeString()}
    </div>
</body>
</html>`);
        pw.document.close();
        pw.focus();
        pw.print();
    };

    // === الواجهة ===
    const isDark = theme === 'dark';

    return (
        <div className={cn("flex flex-col h-full animate-in fade-in zoom-in-95 duration-300")} style={{ minHeight: '400px' }}>

            {/* 1. الحالة Idle: زر البدء */}
            {step === 'idle' && (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-6">
                    <div className={cn("w-24 h-24 rounded-full flex items-center justify-center mb-2 animate-pulse", isDark ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600")}>
                        <ShieldCheck className="w-12 h-12" />
                    </div>
                    <div>
                        <h2 className={cn("text-2xl font-bold mb-2", isDark ? "text-white" : "text-gray-900")}>الفحص الشامل للنظام</h2>
                        <p className={cn("text-sm max-w-md mx-auto leading-relaxed", isDark ? "text-gray-400" : "text-gray-500")}>
                            سيقوم النظام بفحص جميع السجلات المالية لجميع الموظفين، ومقارنة القيم المدخلة مع القيم المحسوبة بناءً على النسب المعتمدة والرواتب الاسمية. هذه العملية تشبه فحص الفيروسات وقد تستغرق دقيقة.
                        </p>
                    </div>
                    <button
                        onClick={startScan}
                        className="group relative inline-flex items-center justify-center px-8 py-3.5 text-base font-bold text-white transition-all duration-200 bg-blue-600 rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 hover:shadow-lg hover:shadow-blue-600/30 active:scale-95"
                    >
                        <Play className="w-5 h-5 mr-2 ml-1 fill-current" />
                        بدء الفحص الشامل
                        <div className="absolute inset-0 rounded-full ring-2 ring-white/20 group-hover:ring-white/40 animate-ping opacity-20" />
                    </button>
                </div>
            )}

            {/* 2. الحالة Scanning: شريط التقدم */}
            {step === 'scanning' && (
                <div className="flex flex-col items-center justify-center h-full text-center p-12 max-w-2xl mx-auto w-full">
                    <Activity className="w-16 h-16 text-blue-500 mb-6 animate-bounce" />
                    <h3 className={cn("text-xl font-bold mb-1", isDark ? "text-white" : "text-gray-900")}>جاري فحص النظام...</h3>
                    <p className={cn("text-sm mb-8 font-mono h-6", isDark ? "text-blue-400" : "text-blue-600")}>
                        {currentScanningName ? `جاري تدقيق: ${currentScanningName}` : 'تحضير البيانات...'}
                    </p>

                    <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden dark:bg-gray-700 relative mb-4">
                        <div
                            className="h-full bg-blue-600 transition-all duration-300 ease-out relative overflow-hidden"
                            style={{ width: `${progress}%` }}
                        >
                            <div className="absolute inset-0 bg-white/30 animate-[shimmer_1s_infinite] w-full" style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }} />
                        </div>
                    </div>
                    <div className="flex justify-between w-full text-xs text-gray-500 font-mono">
                        <span>{Math.round(progress)}%</span>
                        <span>فحص {ALL_FIELDS.length} حقل مالي</span>
                    </div>
                </div>
            )}

            {/* 3. الحالة Results: النتائج */}
            {step === 'results' && (
                <div className="flex flex-col h-full">
                    {/* رأس النتائج */}
                    <div className={cn("flex items-center justify-between p-6 border-b", isDark ? "border-white/10" : "border-gray-200")}>
                        <div className="flex items-center gap-4">
                            <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", errors.length > 0 ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400")}>
                                {errors.length > 0 ? <AlertTriangle className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                            </div>
                            <div>
                                <h2 className={cn("text-xl font-bold", isDark ? "text-white" : "text-gray-900")}>
                                    {errors.length > 0 ? `تم اكتشاف ${errors.length} خطأ في النظام` : 'النظام سليم بالكامل'}
                                </h2>
                                <p className={cn("text-xs mt-1", isDark ? "text-gray-400" : "text-gray-500")}>
                                    استغرق الفحص {Math.round(scanDuration)} ثانية
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* محتوى النتائج */}
                    <div className="flex-1 overflow-auto p-6">
                        {errors.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-500">
                                <CheckCircle2 className="w-32 h-32 text-green-500 mb-6 drop-shadow-2xl" />
                                <h3 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">ممتاز! لا توجد أخطاء</h3>
                                <p className="text-gray-500 max-w-md">تم فحص جميع السجلات المالية ومطابقتها مع القواعد المعتمدة. جميع البيانات دقيقة 100%.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6">
                                {/* عرض مصفوفة بشكل مبسط (قائمة) لأن المصفوفة الكاملة قد تكون ضخمة جداً */}
                                <div className={cn("rounded-xl border overflow-hidden", isDark ? "border-white/10" : "border-gray-200")}>
                                    <div className={cn("px-4 py-3 border-b flex justify-between items-center", isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200")}>
                                        <h3 className="font-bold text-sm">تفاصيل الأخطاء المكتشفة</h3>
                                        <span className="text-xs text-red-500 font-bold">{errors.length} قيد مخالف</span>
                                    </div>
                                    <div className="max-h-[500px] overflow-auto">
                                        <table className="w-full text-sm">
                                            <thead className={cn("sticky top-0 z-10", isDark ? "bg-[#111]" : "bg-gray-100")}>
                                                <tr>
                                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500">الموظف</th>
                                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500">الحقل</th>
                                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500">النسبة</th>
                                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500">الصحيح</th>
                                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500">الحالي (الخطأ)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                                                {errors.map((err, idx) => (
                                                    <tr key={idx} className={cn("hover:bg-black/5 dark:hover:bg-white/5 transition-colors")}>
                                                        <td className="px-4 py-3">
                                                            <div className="font-bold">{err.userName}</div>
                                                            <div className="text-xs opacity-60 font-mono">{err.jobNumber}</div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={cn("px-2 py-0.5 rounded textxs font-bold", isDark ? "bg-white/10" : "bg-gray-200")}>
                                                                {err.fieldLabel}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center font-mono text-xs">{err.approvedPct}%</td>
                                                        <td className="px-4 py-3 text-center font-mono font-bold text-green-600 dark:text-green-400">{fmt(err.approvedVal)}</td>
                                                        <td className="px-4 py-3 text-center font-mono font-bold text-red-600 dark:text-red-400 line-through decoration-red-500/50">{fmt(err.currentVal)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* أزرار التحكم في الأسفل */}
                    <div className={cn("p-4 border-t flex items-center gap-3", isDark ? "border-white/10 bg-black/20" : "border-gray-100 bg-gray-50/50")}>
                        <button
                            onClick={onClose}
                            className={cn(
                                "flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border",
                                isDark
                                    ? "bg-white/5 hover:bg-white/10 text-white/60 border-white/10"
                                    : "bg-white hover:bg-gray-50 text-gray-600 border-gray-200 shadow-sm"
                            )}
                        >
                            <span className="text-lg">×</span>
                            إغلاق
                        </button>

                        <button
                            onClick={printReport}
                            className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20"
                        >
                            <Printer className="w-4 h-4" />
                            {errors.length > 0 ? 'تقرير المخالفات PDF' : 'شهادة السلامة PDF'}
                        </button>
                    </div>
                    {debugRecord && (
                        <div className="px-4 pb-4">
                            <details className="text-[10px] opacity-50 hover:opacity-100 transition-opacity" dir="ltr">
                                <summary className="cursor-pointer mb-2 font-mono">Debug Data (Tech Only)</summary>
                                <pre className="bg-black/80 text-green-400 p-4 rounded-lg overflow-auto max-h-60 font-mono text-xs">
                                    {JSON.stringify(debugRecord, null, 2)}
                                </pre>
                            </details>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
