import { useState } from 'react';
import { Play, CheckCircle2, AlertTriangle, Printer, ShieldCheck, GraduationCap, Activity } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { useTheme } from '../../context/ThemeContext';
import { CERTIFICATES } from '../../constants/certificates';

// دالة مساعدة
const safeParseFloat = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const cleanVal = val.replace(/[^0-9.-]/g, '');
        return parseFloat(cleanVal) || 0;
    }
    return 0;
};

const fmt = (n: number | null | undefined) => (n !== null && n !== undefined) ? n.toLocaleString('en-US') : '—';

interface AuditError {
    userId: string;
    userName: string;
    jobNumber: string;
    certificate: string;
    nominalSalary: number;
    approvedPct: number;
    approvedVal: number;
    currentVal: number;
    diff: number;
    debugRaw?: any;
    debugType?: string;
}

interface FullAuditProps {
    onClose: () => void;
}

export function FullAudit({ onClose }: FullAuditProps) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    // === الحالات ===
    const [step, setStep] = useState<'idle' | 'scanning' | 'results'>('idle');
    const [currentCertLabel, setCurrentCertLabel] = useState('');
    const [progress, setProgress] = useState(0);
    const [errors, setErrors] = useState<AuditError[]>([]);
    const [scannedCount, setScannedCount] = useState(0);

    // === بدء الفحص (Smart Audit 2.0) ===
    const startScan = async () => {
        setStep('scanning');
        setErrors([]);
        setScannedCount(0);
        setProgress(0);

        const allErrors: AuditError[] = [];
        let processedCount = 0;
        const totalPhases = CERTIFICATES.length;

        for (let i = 0; i < totalPhases; i++) {
            const certDef = CERTIFICATES[i];
            setCurrentCertLabel(certDef.label);
            setProgress(Math.round((i / totalPhases) * 100));

            // تحديد قيم البحث (الاسم + المرادفات)
            const searchValues = [certDef.label, ...(certDef.aliases || [])];

            // جلب السجلات لهذه الشهادة فقط
            // نستخدم in() للبحث عن الاسم والمرادفات
            const { data: batch, error } = await supabase
                .from('financial_records')
                .select('*, profiles!inner(id, full_name, job_number)')
                .in('certificate_text', searchValues);

            if (error) {
                console.error(`Error fetching ${certDef.label}:`, error);
                continue;
            }

            if (batch && batch.length > 0) {
                for (const rec of batch) {
                    const nomSal = safeParseFloat(rec.nominal_salary);
                    // إذا الراتب الاسمي 0، نتجاهل القيد لأنه لا يمكن الحساب عليه
                    if (nomSal <= 0) continue;

                    const rawCertAllowance = rec.certificate_allowance;
                    const currentVal = safeParseFloat(rawCertAllowance);
                    const expectedVal = Math.round((nomSal * certDef.percentage) / 100);

                    // المقارنة: نسمح بفرق بسيط (1 دينار) بسبب التقريب
                    if (Math.abs(expectedVal - currentVal) > 1) {
                        allErrors.push({
                            userId: (rec as any).profiles?.id,
                            userName: (rec as any).profiles?.full_name || 'غير معروف',
                            jobNumber: (rec as any).profiles?.job_number || '—',
                            certificate: certDef.label, // نعرض الاسم الرسمي للشهادة
                            nominalSalary: nomSal,
                            approvedPct: certDef.percentage,
                            approvedVal: expectedVal,
                            currentVal: currentVal,
                            diff: currentVal - expectedVal,
                            debugRaw: rawCertAllowance,
                            debugType: typeof rawCertAllowance
                        });
                    }
                    processedCount++;
                }
            }

            // تأخير بسيط لمحاكاة "التفكير" وليشعر المستخدم بالخطوات (UI/UX)
            // وأيضاً لتجنب تجميد المتصفح
            await new Promise(r => setTimeout(r, 800));
        }

        setScannedCount(processedCount);
        setErrors(allErrors);
        setProgress(100);
        setTimeout(() => setStep('results'), 500);
    };

    // === طباعة التقرير ===
    const printReport = () => {
        const groupedErrors: Record<string, AuditError[]> = {};
        errors.forEach(err => {
            if (!groupedErrors[err.certificate]) groupedErrors[err.certificate] = [];
            groupedErrors[err.certificate].push(err);
        });

        const pw = window.open('', '_blank');
        if (!pw) return;

        pw.document.write(`
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>تقرير تدقيق الشهادات</title>
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
            <h1>تقرير تدقيق مخصصات الشهادات (Smart Audit 2.0)</h1>
            <p>دائرة المعلوماتية وتكنولوجيا الاتصالات</p>
        </div>
        <div style="text-align:left">
            <p>تاريخ الفحص: ${new Date().toLocaleDateString('en-GB')}</p>
            <p>المخالفات: ${errors.length}</p>
        </div>
    </div>

    <div class="summary-box">
        <div class="stat">
            <div class="stat-val">${errors.length}</div>
            <div class="stat-lbl">إجمالي المخالفات</div>
        </div>
        <div class="stat">
            <div class="stat-val" style="color:#2563eb">${Object.keys(groupedErrors).length}</div>
            <div class="stat-lbl">شهادات فيها أخطاء</div>
        </div>
    </div>

    ${Object.keys(groupedErrors).length === 0 ? `
        <div style="text-align:center; padding: 40px; border: 2px dashed #16a34a;">
            <h2 style="color: #16a34a;">✓ جميع الشهادات مطابقة 100%</h2>
        </div>
    ` : ''}

    ${Object.entries(groupedErrors).map(([cert, items]) => `
        <div class="section-title">شهادة ${cert} (${items.length} مخالفة)</div>
        <table>
            <thead>
                <tr>
                    <th width="5%">#</th>
                    <th width="30%">الموظف</th>
                    <th width="15%">الراتب الاسمي</th>
                    <th width="10%">النسبة</th>
                    <th width="20%">المستحق (صحيح)</th>
                    <th width="20%">المصروف (خطأ)</th>
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
</body>
</html>`);
        pw.document.close();
        pw.focus();
        pw.print();
    };

    return (
        <div className={cn("flex flex-col h-full animate-in fade-in zoom-in-95 duration-300")} style={{ minHeight: '400px' }}>

            {/* 1. Idle State */}
            {step === 'idle' && (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-6">
                    <div className={cn("w-24 h-24 rounded-full flex items-center justify-center mb-2 animate-pulse", isDark ? "bg-violet-500/10 text-violet-400" : "bg-violet-50 text-violet-600")}>
                        <GraduationCap className="w-12 h-12" />
                    </div>
                    <div>
                        <h2 className={cn("text-2xl font-bold mb-2", isDark ? "text-white" : "text-gray-900")}>تدقيق مخصصات الشهادات</h2>
                        <p className={cn("text-sm max-w-md mx-auto leading-relaxed opacity-70", isDark ? "text-gray-400" : "text-gray-500")}>
                            سيقوم النظام بفحص الشهادات بالتسلسل (من الدكتوراه إلى "أمي")، ومطابقة راتب كل موظف مع النسبة المستحقة لشهادته بدقة متناهية.
                        </p>
                    </div>
                    <button
                        onClick={startScan}
                        className="group relative inline-flex items-center justify-center px-8 py-3.5 text-base font-bold text-white transition-all duration-200 bg-violet-600 rounded-full hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-600 hover:shadow-lg hover:shadow-violet-600/30 active:scale-95"
                    >
                        <Play className="w-5 h-5 mr-2 ml-1 fill-current" />
                        بدء فحص الشهادات
                    </button>

                    {/* عرض قائمة الشهادات التي سيتم فحصها */}
                    <div className="mt-8 flex flex-wrap gap-2 justify-center max-w-lg opacity-60">
                        {CERTIFICATES.map(c => (
                            <span key={c.label} className="px-2 py-1 rounded text-[10px] border border-current">{c.label} {c.percentage}%</span>
                        ))}
                    </div>
                </div>
            )}

            {/* 2. Scanning State */}
            {step === 'scanning' && (
                <div className="flex flex-col items-center justify-center h-full text-center p-12 max-w-2xl mx-auto w-full">
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-violet-500/20 blur-xl rounded-full animate-pulse"></div>
                        <GraduationCap className="w-20 h-20 text-violet-500 relative z-10 animate-bounce" />
                    </div>

                    <h3 className={cn("text-xl font-bold mb-1", isDark ? "text-white" : "text-gray-900")}>
                        جاري تدقيق: <span className="text-violet-500">{currentCertLabel}</span>
                    </h3>
                    <p className={cn("text-sm mb-8 font-mono h-6 opacity-60", isDark ? "text-gray-300" : "text-gray-600")}>
                        يتم البحث عن الموظفين ومطابقة النسب...
                    </p>

                    <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden dark:bg-gray-700 relative mb-4">
                        <div
                            className="h-full bg-violet-600 transition-all duration-500 ease-out relative"
                            style={{ width: `${progress}%` }}
                        >
                            <div className="absolute inset-0 bg-white/30 animate-[shimmer_1s_infinite] w-full" style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }} />
                        </div>
                    </div>
                    <div className="flex justify-between w-full text-xs text-gray-500 font-mono">
                        <span>{progress}%</span>
                        <span>تم فحص {scannedCount} قيد حتى الآن</span>
                    </div>
                </div>
            )}

            {/* 3. Results State */}
            {step === 'results' && (
                <div className="flex flex-col h-full">
                    <div className={cn("flex items-center justify-between p-6 border-b", isDark ? "border-white/10" : "border-gray-200")}>
                        <div className="flex items-center gap-4">
                            <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", errors.length > 0 ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400")}>
                                {errors.length > 0 ? <AlertTriangle className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                            </div>
                            <div>
                                <h2 className={cn("text-xl font-bold", isDark ? "text-white" : "text-gray-900")}>
                                    {errors.length > 0 ? `تم اكتشاف ${errors.length} مخالفة في الشهادات` : 'سجلات الشهادات سليمة 100%'}
                                </h2>
                                <p className={cn("text-xs mt-1 opacity-60", isDark ? "text-gray-400" : "text-gray-500")}>
                                    شمل الفحص جميع المستويات من الدكتوراه إلى الأمي
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-6">
                        {errors.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-500">
                                <CheckCircle2 className="w-32 h-32 text-green-500 mb-6 drop-shadow-2xl" />
                                <h3 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">ممتاز!</h3>
                                <p className="text-gray-500 max-w-md">جميع مخصصات الشهادات مطابقة للنسب المقررة.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* تجميع النتائج حسب الشهادة */}
                                {CERTIFICATES.map(cert => {
                                    const certErrors = errors.filter(e => e.certificate === cert.label);
                                    if (certErrors.length === 0) return null;

                                    return (
                                        <div key={cert.label} className={cn("rounded-xl border overflow-hidden", isDark ? "border-white/10" : "border-gray-200")}>
                                            <div className={cn("px-4 py-3 border-b flex justify-between items-center", isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200")}>
                                                <h3 className="font-bold text-sm flex items-center gap-2">
                                                    <span className={cn("w-2 h-2 rounded-full bg-red-500")}></span>
                                                    شهادة {cert.label} ({cert.percentage}%)
                                                </h3>
                                                <span className="text-xs text-red-500 font-bold bg-red-500/10 px-2 py-1 rounded">{certErrors.length} مخالفة</span>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead className={cn("text-xs font-bold text-gray-500", isDark ? "bg-[#111]" : "bg-gray-100")}>
                                                        <tr>
                                                            <th className="px-4 py-2 text-right">الموظف</th>
                                                            <th className="px-4 py-2 text-center">الراتب الاسمي</th>
                                                            <th className="px-4 py-2 text-center text-green-600">المستحق</th>
                                                            <th className="px-4 py-2 text-center text-red-500">المصروف (الخطأ)</th>
                                                            <th className="px-4 py-2 text-center">الفرق</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                                                        {certErrors.map((err, idx) => (
                                                            <tr key={idx} className={cn("hover:bg-black/5 dark:hover:bg-white/5 transition-colors")}>
                                                                <td className="px-4 py-3 font-bold">
                                                                    {err.userName}
                                                                    <div className="text-[10px] opacity-50 font-mono font-normal flex flex-wrap gap-2 items-center">
                                                                        <span>{err.jobNumber}</span>
                                                                        {/* عرض معلومات التصحيح التقنية */}
                                                                        {(err.debugRaw !== undefined || err.debugType) && (
                                                                            <span dir="ltr" className="text-red-500 bg-red-500/5 px-1 rounded flex items-center gap-1" title="القيمة الخام في قاعدة البيانات">
                                                                                <Activity className="w-3 h-3" />
                                                                                DB: {String(err.debugRaw)} ({err.debugType})
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-center font-mono opacity-80">{fmt(err.nominalSalary)}</td>
                                                                <td className="px-4 py-3 text-center font-mono font-bold text-green-600 dark:text-green-400">{fmt(err.approvedVal)}</td>
                                                                <td className="px-4 py-3 text-center font-mono font-bold text-red-600 dark:text-red-400 line-through decoration-red-500/50">{fmt(err.currentVal)}</td>
                                                                <td className="px-4 py-3 text-center font-mono text-xs" dir="ltr">
                                                                    {err.diff > 0 ? `+${fmt(err.diff)}` : fmt(err.diff)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className={cn("p-4 border-t flex items-center gap-3", isDark ? "border-white/10 bg-black/20" : "border-gray-100 bg-gray-50/50")}>
                        <button
                            onClick={onClose}
                            className={cn(
                                "flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border",
                                isDark ? "bg-white/5 hover:bg-white/10 text-white/60 border-white/10" : "bg-white hover:bg-gray-50 text-gray-600 border-gray-200 shadow-sm"
                            )}
                        >
                            إغلاق
                        </button>
                        <button
                            onClick={printReport}
                            className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-600/20"
                        >
                            <Printer className="w-4 h-4" />
                            طباعة التقرير
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
