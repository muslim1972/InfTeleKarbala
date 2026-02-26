import { useState, useMemo } from 'react';
import { Calculator, Info, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getExpectedNominalSalary } from '../../utils/salaryScale';

export function SalaryCalculator() {
    // 1. Basic Inputs
    const [grade, setGrade] = useState<string>('10');
    const [stage, setStage] = useState<string>('1');
    const [certificate, setCertificate] = useState<string>('primary');
    const [isEngineer, setIsEngineer] = useState(false);
    const [position, setPosition] = useState<string>('none');
    const [transportAllowance, setTransportAllowance] = useState<number>(20000);

    // 2. Social & Family (Manual input as requested)
    const [isMarried, setIsMarried] = useState(false);
    const [maritalAllowance, setMaritalAllowance] = useState<number>(50000);
    const [hasChildren, setHasChildren] = useState(false);
    const [childrenCount, setChildrenCount] = useState<number>(1);
    const CHILD_FIXED_AMOUNT = 10000;

    // 3. Deductions
    const [loanDeduction, setLoanDeduction] = useState<number>(0);
    const [executionDeduction, setExecutionDeduction] = useState<number>(0);
    const [taxDeduction, setTaxDeduction] = useState<number>(0);

    // Calculation Logic
    const results = useMemo(() => {
        // A. Nominal Salary
        const nominal = getExpectedNominalSalary(grade, stage) || 0;

        // B. Certificate Allowance %
        let certPct = 0;
        switch (certificate) {
            case 'phd': certPct = 150; break;
            case 'master': certPct = 125; break;
            case 'diploma_high': certPct = 55; break;
            case 'bachelor': certPct = 45; break;
            case 'diploma': certPct = 35; break;
            case 'secondary': certPct = 25; break;
            case 'intermediate':
            case 'primary':
            case 'illiterate': certPct = 15; break;
        }
        const certAmount = (nominal * certPct) / 100;

        // C. Position Allowance %
        let posPct = 0;
        switch (position) {
            case 'director': posPct = 25; break;
            case 'assistant': posPct = 20; break;
            case 'head_dept': posPct = 20; break;
            case 'head_div': posPct = 15; break;
        }
        const posAmount = (nominal * posPct) / 100;

        // D. Risk Allowance %
        // Base 30%, 50% for grades 8, 9, 10
        const isLowGrade = ['8', '9', '10'].includes(grade);
        const riskPct = isLowGrade ? 50 : 30;
        const riskAmount = (nominal * riskPct) / 100;

        // E. Engineering Allowance %
        const engPct = isEngineer ? 35 : 0;
        const engAmount = (nominal * engPct) / 100;

        // F. Marital & Children (Fixed per request)
        const maritalVal = isMarried ? maritalAllowance : 0;
        const childrenVal = hasChildren ? (childrenCount * CHILD_FIXED_AMOUNT) : 0;

        // Total Gross
        const totalAllowances = certAmount + posAmount + riskAmount + engAmount + maritalVal + childrenVal + transportAllowance;
        const gross = nominal + totalAllowances;

        // G. General Deduction (10% from NOMINAL as per user correction)
        const generalDeductionVal = nominal * 0.1;

        // Total Net
        const totalDeductions = generalDeductionVal + loanDeduction + executionDeduction + taxDeduction;
        const net = gross - totalDeductions;

        return {
            nominal,
            certAmount,
            posAmount,
            riskAmount,
            engAmount,
            maritalVal,
            childrenVal,
            transportAllowance,
            gross,
            generalDeductionVal,
            totalDeductions,
            net
        };
    }, [grade, stage, certificate, isEngineer, position, isMarried, maritalAllowance, hasChildren, childrenCount, transportAllowance, loanDeduction, executionDeduction, taxDeduction]);

    const fmt = (n: number) => Math.round(n).toLocaleString();

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xl animate-in fade-in zoom-in duration-300">
            {/* Header */}
            <div className="p-4 bg-brand-green text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Calculator className="w-5 h-5" />
                    <h3 className="font-bold">حاسبة الراتب التقريبية</h3>
                </div>
                <div className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    اصدار تجريبي
                </div>
            </div>

            <div className="p-6 space-y-8">
                {/* 1. Career Info Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <label className="block text-xs font-bold text-zinc-500 mr-1">الدرجة الوظيفية</label>
                        <select
                            value={grade}
                            onChange={(e) => setGrade(e.target.value)}
                            className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-brand-green/50 outline-none transition-all font-bold"
                        >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(g => (
                                <option key={g} value={g}>الدرجة {g}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-4">
                        <label className="block text-xs font-bold text-zinc-500 mr-1">المرحلة</label>
                        <select
                            value={stage}
                            onChange={(e) => setStage(e.target.value)}
                            className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-brand-green/50 outline-none transition-all font-bold"
                        >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(s => (
                                <option key={s} value={s}>المرحلة {s}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-4">
                        <label className="block text-xs font-bold text-zinc-500 mr-1">الشهادة الدراسية</label>
                        <div className="flex gap-2">
                            <select
                                value={certificate}
                                onChange={(e) => setCertificate(e.target.value)}
                                className="flex-1 p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-brand-green/50 outline-none transition-all font-bold"
                            >
                                <option value="phd">دكتوراه (150%)</option>
                                <option value="master">ماجستير (125%)</option>
                                <option value="diploma_high">دبلوم عالي (55%)</option>
                                <option value="bachelor">بكلوريوس (45%)</option>
                                <option value="diploma">دبلوم / معهد (35%)</option>
                                <option value="secondary">اعدادية (25%)</option>
                                <option value="intermediate">متوسطة وما دون (15%)</option>
                            </select>
                            <label className="flex items-center gap-2 px-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isEngineer}
                                    onChange={(e) => setIsEngineer(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                <span className="text-xs font-bold text-blue-700 dark:text-blue-300">مهندس</span>
                            </label>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="block text-xs font-bold text-zinc-500 mr-1">المنصب الإداري</label>
                        <select
                            value={position}
                            onChange={(e) => setPosition(e.target.value)}
                            className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-brand-green/50 outline-none transition-all font-bold"
                        >
                            <option value="none">بدون منصب</option>
                            <option value="director">مدير مديرية (25%)</option>
                            <option value="assistant">معاون (20%)</option>
                            <option value="head_dept">رئيس قسم (20%)</option>
                            <option value="head_div">مسؤول شعبة (15%)</option>
                        </select>
                    </div>

                    <div className="space-y-4">
                        <label className="block text-xs font-bold text-zinc-500 mr-1">مخصصات النقل</label>
                        <select
                            value={transportAllowance}
                            onChange={(e) => setTransportAllowance(Number(e.target.value))}
                            className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-brand-green/50 outline-none transition-all font-bold"
                        >
                            <option value={20000}>20,000 د.ع</option>
                            <option value={30000}>30,000 د.ع</option>
                        </select>
                    </div>
                </div>

                {/* 2. Social Info Section */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 space-y-6">
                    <h4 className="text-sm font-bold flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                        <Info className="w-4 h-4 text-zinc-400" />
                        البيانات الاجتماعية (الزوجية والأطفال)
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={isMarried}
                                    onChange={(e) => setIsMarried(e.target.checked)}
                                    className="w-5 h-5 text-brand-green rounded"
                                />
                                <span className="text-sm font-bold group-hover:text-brand-green transition-colors">متزوج</span>
                            </label>
                            {isMarried && (
                                <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
                                    <label className="text-[10px] text-zinc-400 mr-1">مبلغ الزوجية</label>
                                    <input
                                        type="number"
                                        placeholder="قيمة مخصصات الزوجية..."
                                        value={maritalAllowance || ''}
                                        onChange={(e) => setMaritalAllowance(Number(e.target.value))}
                                        className="w-full p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-center font-bold"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={hasChildren}
                                    onChange={(e) => setHasChildren(e.target.checked)}
                                    className="w-5 h-5 text-brand-green rounded"
                                />
                                <span className="text-sm font-bold group-hover:text-brand-green transition-colors">لديك أطفال</span>
                            </label>
                            {hasChildren && (
                                <div className="animate-in slide-in-from-top-2 duration-300">
                                    <label className="block text-[10px] text-zinc-400 mb-1 mr-1">عدد الأطفال (10,000 لكل طفل)</label>
                                    <select
                                        value={childrenCount}
                                        onChange={(e) => setChildrenCount(Number(e.target.value))}
                                        className="w-full p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold"
                                    >
                                        {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} أطفال</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. Deductions Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { label: 'استقطاع القرض', val: loanDeduction, set: setLoanDeduction },
                        { label: 'استقطاع التنفيذ', val: executionDeduction, set: setExecutionDeduction },
                        { label: 'استقطاع الضريبة', val: taxDeduction, set: setTaxDeduction }
                    ].map((d, i) => (
                        <div key={i} className="space-y-2">
                            <label className="text-[10px] font-bold text-zinc-500 block mr-1">{d.label}</label>
                            <input
                                type="number"
                                value={d.val || ''}
                                onChange={(e) => d.set(Number(e.target.value))}
                                className="w-full p-3 bg-red-50/30 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl text-center font-bold text-red-600 dark:text-red-400"
                            />
                        </div>
                    ))}
                </div>

                {/* 4. RESULTS VIEW */}
                <div className="border-t-2 border-dashed border-zinc-100 dark:border-zinc-800 pt-8 mt-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        {/* Summary BreakDown */}
                        <div className="space-y-6">
                            {/* Allowances List */}
                            <div className="space-y-3">
                                <h5 className="text-[10px] font-black text-brand-green uppercase tracking-widest border-b border-brand-green/20 pb-1">المخصصات والاستحقاق</h5>
                                {[
                                    { label: 'الراتب الاسمي', val: results.nominal, color: 'text-zinc-600 dark:text-zinc-400' },
                                    { label: 'مخصصات الشهادة', val: results.certAmount, color: 'text-emerald-600' },
                                    { label: 'مخصصات الخطورة', val: results.riskAmount, color: 'text-emerald-600' },
                                    { label: 'مخصصات المنصب', val: results.posAmount, color: 'text-emerald-600' },
                                    { label: 'مخصصات هندسية', val: results.engAmount, color: 'text-emerald-600' },
                                    { label: 'مخصصات النقل', val: results.transportAllowance, color: 'text-emerald-600' },
                                    { label: `الزوجية والأطفال`, val: results.maritalVal + results.childrenVal, color: 'text-emerald-600' },
                                ].map((row, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm">
                                        <span className="text-zinc-500">{row.label}</span>
                                        <span className={cn("font-mono font-bold", row.color)}>{fmt(row.val)} د.ع</span>
                                    </div>
                                ))}
                                <div className="flex justify-between items-center text-sm font-black pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                    <span className="text-zinc-700 dark:text-zinc-300">الراتب الكلي (Gross)</span>
                                    <span className="text-zinc-900 dark:white font-mono">{fmt(results.gross)} د.ع</span>
                                </div>
                            </div>

                            {/* Deductions List */}
                            <div className="space-y-3">
                                <h5 className="text-[10px] font-black text-rose-500 uppercase tracking-widest border-b border-rose-500/20 pb-1">تفاصيل الاستقطاعات</h5>
                                {[
                                    { label: 'استقطاع عام (10% من الاسمي)', val: results.generalDeductionVal, color: 'text-rose-500' },
                                    { label: 'استقطاع القرض البنكي', val: loanDeduction, color: 'text-rose-500' },
                                    { label: 'استقطاع الـتـنـفـيـذ', val: executionDeduction, color: 'text-rose-500' },
                                    { label: 'الاستـقـطاع الضريبي', val: taxDeduction, color: 'text-rose-500' },
                                ].map((row, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm">
                                        <span className="text-zinc-500">{row.label}</span>
                                        <span className={cn("font-mono font-bold", row.color)}>{fmt(row.val)} د.ع</span>
                                    </div>
                                ))}
                                <div className="flex justify-between items-center text-sm font-black pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                    <span className="text-zinc-700 dark:text-zinc-300">مجموع الاستقطاعات (من الاسمي + خاص)</span>
                                    <span className="text-rose-600 font-mono">{fmt(results.totalDeductions)} د.ع</span>
                                </div>
                            </div>
                        </div>

                        {/* Final Score Card */}
                        <div className="bg-brand-green/10 dark:bg-brand-green/5 p-6 rounded-3xl border-2 border-brand-green flex flex-col items-center justify-center relative shadow-2xl shadow-brand-green/10">
                            <CheckCircle2 className="w-8 h-8 text-brand-green absolute -top-4 bg-white dark:bg-zinc-900 rounded-full" />
                            <p className="text-xs font-bold text-brand-green uppercase tracking-widest mb-2">صافي الراتب المتوقع</p>
                            <div className="text-4xl md:text-5xl font-black text-brand-green font-mono tracking-tighter">
                                {fmt(results.net)}
                            </div>
                            <p className="text-[10px] text-zinc-400 mt-4 leading-relaxed text-center">
                                * هذا الاحتساب تقريبي بناءً على القواعد العامة المعتمدة للشركة ولا يعتبر كشفا رسمياً للراتب.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Calculate Button (Visual only as calculation is reactive) */}
                <div className="flex justify-center pt-4">
                    <button className="px-10 py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl font-black text-lg hover:scale-105 transition-transform flex items-center gap-3 active:scale-95 shadow-xl">
                        <Calculator className="w-6 h-6" />
                        احتساب الراتب
                    </button>
                </div>
            </div>
        </div>
    );
}
