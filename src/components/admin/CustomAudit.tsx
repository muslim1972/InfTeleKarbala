import { useState, useRef, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck, Calculator, Loader2, X, Printer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { useTheme } from '../../context/ThemeContext';
import { FullAudit } from './FullAudit';
import { getExpectedNominalSalary } from '../../utils/salaryScale';

import {
    ALLOWANCE_FIELDS,
    AUDIT_ALLOWANCE_FIELDS,
    DEDUCTION_FIELDS,
    AUDIT_DEDUCTION_FIELDS,
    SALARY_FIELDS,
    resolveApprovedPercentage,
    getLegalAllowancePercentage,
    getExpectedGrossSalary,
    getExpectedNetSalary
} from '../../utils/salaryRules';
import { printMismatchReportHTML, buildSingleAuditHTML } from '../../utils/auditPrintUtils';
import { formatCurrency } from '../../utils/formatters';
import { EmployeeSearch } from '../shared/EmployeeSearch';
import { useGovernorate } from '../../context/GovernorateContext';
import { governorateName } from '../../constants/governorates';

// ===== أنواع البيانات =====
export interface MismatchRow {
    name: string;
    jobNumber: string;
    nominalSalary: number;
    userCalc: number;
    approvedCalc: number | null;
    currentValue: number;
    notes: string;
    isFiveYearLeave?: boolean;
}

const fmt = formatCurrency;

interface CustomAuditProps {
    onClose: () => void;
}

export function CustomAudit({ onClose }: CustomAuditProps) {
    const { theme } = useTheme();
    const { activeGovernorate } = useGovernorate();
    const targetGov = activeGovernorate || sessionStorage.getItem('selectedGovernorate') || 'karbala';

    // === التبويبات الرئيسية ===
    const [activeTab, setActiveTab] = useState<'custom' | 'full'>('custom');

    // === الحالات العامة ===
    const [scope, setScope] = useState<'all' | 'specific'>('all');
    const [auditType, setAuditType] = useState<'allowances' | 'deductions' | 'salary_values' | null>(null);
    const [selectedField, setSelectedField] = useState('');

    // === وضع "اسم محدد" ===
    const [searchQuery, setSearchQuery] = useState('');

    // === مشترك ===
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [financialData, setFinancialData] = useState<any>(null);
    const [validationState, setValidationState] = useState<'idle' | 'match' | 'mismatch'>('idle');
    const [approvedPercentage, setApprovedPercentage] = useState<number | null>(null);
    const [auditResult, setAuditResult] = useState<number | null>(null);
    const [recalcResult, setRecalcResult] = useState<number | null>(null);
    const [currentValue, setCurrentValue] = useState<number | null>(null);

    // === وضع "كل المنتسبين" ===

    const [mismatchRows, setMismatchRows] = useState<MismatchRow[]>([]);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [reportGenerated, setReportGenerated] = useState(false);
    const [processedCount, setProcessedCount] = useState(0);

    const printRef = useRef<HTMLDivElement>(null);

    // === ألوان السمة ===
    const cardBg = theme === 'light' ? 'bg-white border-gray-200' : 'bg-white/5 border-white/10';
    const labelClr = theme === 'light' ? 'text-gray-600' : 'text-white/60';
    const textClr = theme === 'light' ? 'text-gray-900' : 'text-white';
    const inputBg = theme === 'light' ? 'bg-gray-50 border-gray-200 text-gray-900' : 'bg-black/40 border-white/10 text-white';
    const mutedBg = theme === 'light' ? 'bg-gray-100/80' : 'bg-white/5';


    // === جلب البيانات المالية ===
    const loadFinancialData = useCallback(async (userId: string) => {
        const { data } = await supabase
            .from('financial_records')
            .select('*')
            .eq('user_id', userId)
            .single();

        setFinancialData(data);
        return data;
    }, []);

    const resetAuditResults = () => {
        setValidationState('idle');
        setAuditResult(null);
        setRecalcResult(null);
        setCurrentValue(null);
        setApprovedPercentage(null);
        setMismatchRows([]);
        setReportGenerated(false);
        setProcessedCount(0);
    };

    useEffect(() => {
        if (scope === 'all') {
            setSelectedEmployee(null);
            setFinancialData(null);
            resetAuditResults();
        } else {
            setSelectedEmployee(null);
            setFinancialData(null);
            resetAuditResults();
        }
    }, [scope]);

    const handleSelectSuggestion = (user: any) => {
        setSelectedEmployee(user);
        setSearchQuery(user.full_name);
        loadFinancialData(user.id);
        resetAuditResults();
    };

    // === حساب فردي (لوضع التنقل ووضع اسم محدد) ===
    const calculateSingle = useCallback((finData: any, field: string) => {
        if (!finData || !field) return;

        const fieldCurrentValue = parseFloat(finData[field]) || 0;
        setCurrentValue(fieldCurrentValue);

        const nom = parseFloat(finData.nominal_salary) || 0;
        const gross = parseFloat(finData.gross_salary) || 0;
        const certAll = parseFloat(finData.certificate_allowance) || 0;
        const isFiveYear = (finData.is_five_year_leave && Math.abs(gross - nom) < 10 && certAll === 0) || (
            gross > 0 &&
            Math.abs(gross - nom) < 10 &&
            certAll === 0 &&
            (parseFloat(finData.risk_allowance) || 0) === 0
        );

        // -- تدقيق قيم الراتب --
        if (SALARY_FIELDS.some(f => f.key === field)) {
            setApprovedPercentage(null);
            let expectedValue: number | null = null;

            if (field === 'nominal_salary') {
                const grade = finData.salary_grade;
                const stage = finData.salary_stage;
                expectedValue = getExpectedNominalSalary(grade, stage, fieldCurrentValue);
            } else if (field === 'gross_salary') {
                expectedValue = getExpectedGrossSalary({ ...finData, is_five_year_leave: isFiveYear });
            } else if (field === 'net_salary') {
                expectedValue = getExpectedNetSalary({ ...finData, is_five_year_leave: isFiveYear });
            }

            setRecalcResult(expectedValue);
            setAuditResult(expectedValue);

            if (expectedValue !== null) {
                if (Math.abs(expectedValue - fieldCurrentValue) <= 1) {
                    setValidationState('match');
                } else {
                    setValidationState('mismatch');
                }
            } else {
                setValidationState('idle');
            }
            return;
        }

        // -- تدقيق المخصصات والاستقطاعات التقليدي بالنبس المئوية --
        const approved = resolveApprovedPercentage(field, { ...finData, is_five_year_leave: isFiveYear });

        setApprovedPercentage(approved);

        if (approved !== null) {
            const approvedCalc = Math.round((nom * approved) / 100);
            setRecalcResult(approvedCalc);
            setAuditResult(approvedCalc);

            if (Math.abs(approvedCalc - fieldCurrentValue) <= 1) {
                setValidationState('match');
            } else {
                setValidationState('mismatch');
            }
        } else {
            setRecalcResult(null);
            setAuditResult(null);
            setValidationState('idle');
        }
    }, []);

    // === توليد تقرير غير المطابق مع Pagination ===
    const generateMismatchReport = useCallback(async () => {
        if (!selectedField) return;
        setIsGeneratingReport(true);
        setMismatchRows([]);
        setProcessedCount(0);

        const PAGE_SIZE = 1000;
        let from = 0;
        let hasMore = true;
        const allRows: MismatchRow[] = [];
        let totalProcessed = 0;

        while (hasMore) {
            let q = supabase
                .from('financial_records')
                .select('*, profiles!inner(id, full_name, job_number, username, position_title, is_retired)')
                .order('profiles(full_name)', { ascending: true })
                .range(from, from + PAGE_SIZE - 1);

            if (targetGov) {
                q = q.eq('governorate', targetGov);
            }

            const { data: batch, error } = await q;

            if (error || !batch || batch.length === 0) {
                hasMore = false;
                break;
            }

            for (const rec of batch) {
                const nomSal = parseFloat(rec.nominal_salary) || 0;
                if (nomSal <= 0) continue;

                const profile = (rec as any).profiles;
                const uname = String(profile?.username || '');
                const fname = String(profile?.full_name || '');
                const jn = String(profile?.job_number || '').trim();
                const jt = String(rec.job_title || '').trim();

                // استبعاد الحسابات الاختبارية والتجريبية
                if (uname.startsWith('c12') || uname.includes('test') || fname.includes('تجريبي')) {
                    continue;
                }

                // كشف إجازة الخمس سنوات الفعلية
                const grossVal = parseFloat(rec.gross_salary) || 0;
                const certAllVal = parseFloat(rec.certificate_allowance) || 0;
                const isFiveYear = (rec.is_five_year_leave && Math.abs(grossVal - nomSal) < 10 && certAllVal === 0) || (
                    grossVal > 0 &&
                    Math.abs(grossVal - nomSal) < 10 &&
                    certAllVal === 0 &&
                    (parseFloat(rec.risk_allowance) || 0) === 0
                );

                // كشف العقود
                const isContract = (jn.startsWith('143264') || jt.includes('عقد')) && (parseFloat(rec.certificate_allowance) || 0) === 0;

                const fieldCurrentValue = parseFloat(rec[selectedField]) || 0;

                // إذا كان الموظف مجاز 5 سنوات والتدقيق في أحد بنود المخصصات وقيمتها 0، فهذا مطابق قانوناً
                if (isFiveYear && ALLOWANCE_FIELDS.some(f => f.key === selectedField)) {
                    if (fieldCurrentValue === 0) {
                        continue;
                    }
                }

                // إذا كان الموظف عقد والتدقيق في مخصصات الشهادة وقيمتها 0، فهذا مطابق لسلم رواتبهم
                if (isContract && selectedField === 'certificate_allowance') {
                    if (fieldCurrentValue === 0) {
                        continue;
                    }
                }

                // دمج بيانات الملف الشخصي
                const fullRecord = {
                    ...rec,
                    job_title: rec.job_title,
                    certificate_text: rec.certificate_text,
                    certificate_percentage: rec.certificate_percentage,
                    certificate_allowance: rec.certificate_allowance,
                    job_number: jn,
                    is_five_year_leave: isFiveYear
                };

                let mismatch = false;
                let note = '';
                let approvedCalc: number | null = null;

                // --- تدقيق قيم الراتب ---
                if (SALARY_FIELDS.some(f => f.key === selectedField)) {
                    if (selectedField === 'nominal_salary') {
                        const grade = rec.salary_grade;
                        const stage = rec.salary_stage;
                        approvedCalc = getExpectedNominalSalary(grade, stage, fieldCurrentValue);
                        if (approvedCalc === null) {
                            mismatch = true;
                            note = 'الدرجة والمرحلة غير صالحة أو مفقودة';
                        } else if (Math.abs(approvedCalc - fieldCurrentValue) > 1) {
                            mismatch = true;
                            note = `الراتب الاسمي لا يطابق السلم (المستحق: ${fmt(approvedCalc)})`;
                        }
                    } else if (selectedField === 'gross_salary') {
                        approvedCalc = getExpectedGrossSalary(fullRecord);
                        if (approvedCalc !== null && Math.abs(approvedCalc - fieldCurrentValue) > 1) {
                            mismatch = true;
                            note = `خطأ في جمع الراتب الكلي (المستحق: ${fmt(approvedCalc)})`;
                        }
                    } else if (selectedField === 'net_salary') {
                        approvedCalc = getExpectedNetSalary(fullRecord);
                        if (approvedCalc !== null && Math.abs(approvedCalc - fieldCurrentValue) > 1) {
                            mismatch = true;
                            note = `خطأ في حساب الراتب الصافي (الاستحقاق: ${fmt(approvedCalc)})`;
                        }
                    }
                } else {
                    // --- تدقيق مخصصات الزوجية (مقطوعة 50,000 د.ع) ---
                    if (selectedField === 'marital_allowance') {
                        if (isContract || isFiveYear) {
                            if (fieldCurrentValue === 0) continue;
                            mismatch = true;
                            note = 'لا يستحق مخصصات زوجية';
                            approvedCalc = 0;
                        } else {
                            if (fieldCurrentValue > 0 && Math.abs(fieldCurrentValue - 50000) > 10) {
                                mismatch = true;
                                note = `مخصصات الزوجية يجب أن تكون 50,000 د.ع (المستلم: ${fmt(fieldCurrentValue)})`;
                                approvedCalc = 50000;
                            }
                        }
                        if (mismatch) {
                            allRows.push({
                                name: profile?.full_name || '—',
                                jobNumber: profile?.job_number || '—',
                                nominalSalary: nomSal,
                                userCalc: approvedCalc ?? 50000,
                                approvedCalc: approvedCalc ?? 50000,
                                currentValue: fieldCurrentValue,
                                notes: note,
                                isFiveYearLeave: isFiveYear,
                            });
                        }
                        continue;
                    }

                    // --- تدقيق المخصصات والاستقطاعات التقليدي ---
                    const approved = resolveApprovedPercentage(selectedField, fullRecord);
                    if (approved === null) continue;

                    approvedCalc = Math.round((nomSal * approved) / 100);
                    mismatch = Math.abs(approvedCalc - fieldCurrentValue) > 10;

                    // === 1. تدقيق المخصصات القانونية ===
                    if (selectedField === 'legal_allowance') {
                        const riskValue = parseFloat(rec.risk_allowance) || 0;
                        if (approvedCalc > 0) {
                            if (Math.abs(approvedCalc - fieldCurrentValue) > 10) {
                                mismatch = true;
                                if (fieldCurrentValue === 0) note = 'يستحق مخصصات قانونية ولا يستلمها';
                                else note = `مبلغ المخصصات غير صحيح (يستحق ${fmt(approvedCalc)})`;
                            } else if (riskValue > 0) {
                                mismatch = true;
                                note = 'يجمع بين مخصصات القانونية والخطورة (يجب حجب الخطورة)';
                            }
                        } else {
                            if (fieldCurrentValue > 0) {
                                mismatch = true;
                                note = 'يستلم مخصصات قانونية دون توفر العنوان أو الشهادة';
                            }
                        }
                    } 
                    // === 2. تدقيق مخصصات الخطورة ===
                    else if (selectedField === 'risk_allowance') {
                        const grade = parseInt(rec.salary_grade, 10);
                        const legalPct = getLegalAllowancePercentage(fullRecord);
                        const legalVal = parseFloat(rec.legal_allowance) || 0;

                        if ([8, 9, 10].includes(grade)) {
                            approvedCalc = 0;
                            if (fieldCurrentValue > 0) {
                                mismatch = true;
                                note = `الدرجة (${grade}): الخطورة يجب أن تكون 0% وتستحق مخصصات إضافية 50%`;
                            }
                        } else if (legalPct === 30 || legalVal > 0) {
                            approvedCalc = 0;
                            if (fieldCurrentValue > 0) {
                                mismatch = true;
                                note = 'يجمع بين مخصصات القانونية والخطورة (يجب حجب الخطورة)';
                            }
                        } else {
                            approvedCalc = Math.round(nomSal * 0.30);
                            if (Math.abs(approvedCalc - fieldCurrentValue) > 10) {
                                mismatch = true;
                                if (fieldCurrentValue === 0) {
                                    note = 'يستحق مخصصات الخطورة (30%) ولا يستلمها';
                                } else if (fieldCurrentValue > approvedCalc) {
                                    note = `يستلم مخصصات خطورة أعلى من المستحق (المستحق: ${fmt(approvedCalc)})`;
                                } else {
                                    note = `يستلم مخصصات خطورة أقل من المستحق (المستحق: ${fmt(approvedCalc)})`;
                                }
                            }
                        }
                    }
                    // === 3. تدقيق مخصصات المنصب ===
                    else if (selectedField === 'position_allowance') {
                        const approvedPct = resolveApprovedPercentage('position_allowance', fullRecord);
                        approvedCalc = Math.round((nomSal * (approvedPct || 0)) / 100);
                        if (Math.abs(approvedCalc - fieldCurrentValue) > 10) {
                            mismatch = true;
                            if (approvedCalc > 0 && fieldCurrentValue === 0) {
                                note = `يستحق مخصصات منصب (${approvedPct}%) ولا يستلمها`;
                            } else if (approvedCalc === 0 && fieldCurrentValue > 0) {
                                note = 'يستلم مخصصات منصب دون عنوان إداري في النظام';
                            } else if (fieldCurrentValue > approvedCalc) {
                                note = `القيمة الحالية أعلى من المستحق (${approvedPct}%)`;
                            } else {
                                note = `القيمة الحالية أقل من المستحق (${approvedPct}%)`;
                            }
                        }
                    }
                    // === 4. تدقيق المخصصات الإضافية 50% ===
                    else if (selectedField === 'additional_50_percent_allowance') {
                        const grade = parseInt(rec.salary_grade, 10);
                        if ([8, 9, 10].includes(grade)) {
                            approvedCalc = Math.round(nomSal * 0.50);
                            if (Math.abs(approvedCalc - fieldCurrentValue) > 10) {
                                mismatch = true;
                                note = `يستحق مخصصات إضافية 50% للدرجة (${grade})`;
                            }
                        } else {
                            approvedCalc = 0;
                            if (fieldCurrentValue > 0) {
                                mismatch = true;
                                note = `المخصصات الإضافية 50% خاصة بالدرجات (8، 9، 10) فقط`;
                            }
                        }
                    }
                    // === 5. تدقيق المخصصات الهندسية (المستويان الذكيان) ===
                    else if (selectedField === 'engineering_allowance') {
                        if (Math.abs(approvedCalc - fieldCurrentValue) > 10) {
                            mismatch = true;
                            if (fieldCurrentValue === 0 && approvedCalc > 0) {
                                note = 'العنوان مهندس لكن لا توجد مخصصات';
                            } else if (approvedCalc === 0 && fieldCurrentValue > 0) {
                                note = 'يستلم مخصصات هندسية دون استحقاق';
                            } else {
                                note = `المبلغ لا يطابق نسبة الهندسية (المستحق: ${fmt(approvedCalc)})`;
                            }
                        } else if (fieldCurrentValue > 0) {
                            const isEngTitle = /مهندس|هندس/.test(jt);
                            if (!isEngTitle) {
                                mismatch = true;
                                note = 'لديه مخصصات هندسية وعنوانه ليس هندسياً';
                                approvedCalc = fieldCurrentValue;
                            }
                        }
                    }
                    else {
                        // المنطق العام لبقية الحقول (الشهادة، التقاعد، إلخ)
                        if (mismatch) {
                            if (selectedField === 'certificate_allowance') {
                                if (approvedCalc > 0 && fieldCurrentValue === 0) {
                                    note = 'لديه شهادة ولا يستلم مخصصات';
                                } else if (approvedCalc === 0 && fieldCurrentValue > 0) {
                                    note = 'يستلم مخصصات شهادة دون وجه حق';
                                } else {
                                    if (fieldCurrentValue > approvedCalc) note = `نسبة الشهادة الممنوحة أعلى من المستحق`;
                                    else note = `نسبة الشهادة الممنوحة أقل من المستحق`;
                                }
                            } else if (selectedField === 'retirement_deduction' && isFiveYear) {
                                note = `إجازة 5 سنوات: استقطاع التقاعد 25% (${fmt(approvedCalc)})`;
                            } else {
                                if (fieldCurrentValue === 0) note = 'لا يستلم المخصصات المستحقة';
                                else if (approvedCalc === 0) note = 'يستلم مخصصات غير مستحقة';
                                else if (fieldCurrentValue > approvedCalc) note = `القيمة الحالية أعلى من المستحق`;
                                else note = `القيمة الحالية أقل من المستحق`;
                            }
                        }
                    }
                }

                if (mismatch) {
                    allRows.push({
                        name: profile?.full_name || '—',
                        jobNumber: profile?.job_number || '—',
                        nominalSalary: nomSal,
                        userCalc: approvedCalc ?? 0,
                        approvedCalc: approvedCalc ?? 0,
                        currentValue: fieldCurrentValue,
                        notes: note,
                        isFiveYearLeave: isFiveYear,
                    });
                }
            }

            totalProcessed += batch.length;
            setProcessedCount(totalProcessed);
            from += PAGE_SIZE;
            if (batch.length < PAGE_SIZE) hasMore = false;
        }

        setMismatchRows(allRows);
        setIsGeneratingReport(false);
        setReportGenerated(true);
    }, [selectedField, targetGov]);

    // === التحقق اليدوي (لوضع اسم محدد) ===
    const handleVerify = () => {
        calculateSingle(financialData, selectedField);
    };

    // === طباعة تقرير فردي ===
    const printSingleReport = () => {
        const fieldsList = auditType === 'allowances' ? AUDIT_ALLOWANCE_FIELDS : auditType === 'deductions' ? AUDIT_DEDUCTION_FIELDS : SALARY_FIELDS;
        const fieldLabel = fieldsList.find(f => f.key === selectedField)?.label || '';
        const pw = window.open('', '_blank');
        if (!pw) return;
        const html = buildSingleAuditHTML(fieldLabel, selectedEmployee, financialData, approvedPercentage, auditResult, currentValue, validationState, governorateName(targetGov));
        pw.document.write(html);
        pw.document.close();
        pw.focus();
        pw.onafterprint = () => pw.close();
        pw.print();
    };

    // === طباعة تقرير الشامل ===
    const printMismatchReport = () => {
        const fieldsList = auditType === 'allowances' ? ALLOWANCE_FIELDS : auditType === 'deductions' ? DEDUCTION_FIELDS : SALARY_FIELDS;
        const fieldLabel = fieldsList.find(f => f.key === selectedField)?.label || '';

        const pw = window.open('', '_blank');
        if (!pw) return;
        const html = printMismatchReportHTML(fieldLabel, auditType, mismatchRows, governorateName(targetGov));
        pw.document.write(html);
        pw.document.close();
        pw.focus();
        pw.onafterprint = () => pw.close();
        pw.print();
    };

    // =====================================================================
    // ========================== واجهة العرض =============================
    // =====================================================================

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300" ref={printRef}>

            {/* ======= شريط التبويبات الرئيسي ======= */}
            <div className="flex p-1 space-x-1 rtl:space-x-reverse rounded-xl bg-gray-100/50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                <button
                    onClick={() => setActiveTab('custom')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all",
                        activeTab === 'custom'
                            ? "bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm"
                            : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    )}
                >
                    <Calculator className="w-4 h-4" />
                    تدقيق محدد
                </button>
                <button
                    onClick={() => setActiveTab('full')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all",
                        activeTab === 'full'
                            ? "bg-white dark:bg-white/10 text-emerald-600 dark:text-emerald-400 shadow-sm"
                            : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    )}
                >
                    <ShieldCheck className="w-4 h-4" />
                    الفحص الشامل (Scan)
                </button>
            </div>

            {/* ======= محتوى التبويبات ======= */}
            {activeTab === 'full' ? (
                <FullAudit onClose={onClose} />
            ) : (
                <>
                    {/* ======= صف 1: النطاق ======= */}
                    <div className={cn("rounded-xl border p-4", cardBg)}>
                        <div className="flex flex-col gap-3">
                            {/* صف النطاق + البحث */}
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
                                            setFinancialData(null);
                                            resetAuditResults();
                                        }}
                                        className={cn("w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:border-brand-green/50", inputBg)}
                                    >
                                        <option value="all">كل المنتسبين</option>
                                        <option value="specific">اسم محدد</option>
                                    </select>
                                </div>

                                {/* حقل البحث / التنقل */}
                                <div className="flex-1 relative">
                                    <label className={cn("text-xs font-bold mb-1.5 block", labelClr)}>البحث عن موظف</label>
                                    <EmployeeSearch
                                        onSelect={handleSelectSuggestion}
                                        placeholder={scope === 'all' ? "كل المنتسبين" : "الرقم الوظيفي أو الاسم..."}
                                        disabled={scope === 'all'}
                                        value={scope === 'all' ? '' : searchQuery}
                                        onChange={setSearchQuery}
                                        governorate={targetGov}
                                        className={scope === 'all' ? "opacity-50 cursor-not-allowed" : ""}
                                        inputClassName={scope === 'all' ? "bg-gray-100 dark:bg-white/5" : ""}
                                    />
                                </div>
                            </div>
                        </div>


                        {/* بطاقة الموظف (لغير وضع التقرير) */}
                        {selectedEmployee && financialData && scope === 'specific' && (
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

                    {/* ======= صف 2: نوع التدقيق ======= */}
                    <div className={cn("rounded-xl border p-4", cardBg)}>
                        <label className={cn("text-xs font-bold mb-3 block", labelClr)}>نوع التدقيق</label>
                        <div className="flex gap-4 mb-3 flex-wrap sm:flex-nowrap">
                            <label className={cn(
                                "flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl border transition-all flex-1 justify-center min-w-[120px]",
                                auditType === 'allowances'
                                    ? theme === 'light' ? 'bg-cyan-50 border-cyan-300 text-cyan-700' : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                                    : theme === 'light' ? 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                            )}>
                                <input type="radio" name="auditType" checked={auditType === 'allowances'} onChange={() => { setAuditType('allowances'); setSelectedField(''); resetAuditResults(); }} className="accent-cyan-500 w-4 h-4" />
                                <span className="text-sm font-bold">المخصصات</span>
                            </label>
                            <label className={cn(
                                "flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl border transition-all flex-1 justify-center min-w-[120px]",
                                auditType === 'salary_values'
                                    ? theme === 'light' ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                    : theme === 'light' ? 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                            )}>
                                <input type="radio" name="auditType" checked={auditType === 'salary_values'} onChange={() => { setAuditType('salary_values'); setSelectedField(''); resetAuditResults(); }} className="accent-amber-500 w-4 h-4" />
                                <span className="text-sm font-bold">قيم الراتب</span>
                            </label>
                            <label className={cn(
                                "flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl border transition-all flex-1 justify-center min-w-[120px]",
                                auditType === 'deductions'
                                    ? theme === 'light' ? 'bg-violet-50 border-violet-300 text-violet-700' : 'bg-violet-500/10 border-violet-500/30 text-violet-400'
                                    : theme === 'light' ? 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                            )}>
                                <input type="radio" name="auditType" checked={auditType === 'deductions'} onChange={() => { setAuditType('deductions'); setSelectedField(''); resetAuditResults(); }} className="accent-violet-500 w-4 h-4" />
                                <span className="text-sm font-bold">الاستقطاعات</span>
                            </label>
                        </div>
                        {auditType && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                <label className={cn("text-xs font-bold mb-1.5 block", labelClr)}>
                                    {auditType === 'allowances' ? 'اختر نوع المخصص' : auditType === 'deductions' ? 'اختر نوع الاستقطاع' : 'اختر الراتب المراد تدقيقه'}
                                </label>
                                <select
                                    value={selectedField}
                                    onChange={e => { setSelectedField(e.target.value); resetAuditResults(); }}
                                    className={cn("w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:border-brand-green/50", inputBg)}
                                >
                                    <option value="">— اختر —</option>
                                    {(auditType === 'allowances' ? AUDIT_ALLOWANCE_FIELDS : auditType === 'deductions' ? AUDIT_DEDUCTION_FIELDS : SALARY_FIELDS).map(f => (
                                        <option key={f.key} value={f.key}>{f.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* ======= صف 3: زر البدء (بديل نسبة الاحتساب) ======= */}
                    {selectedField && (scope === 'specific' ? financialData : true) && (
                        <div className={cn("rounded-xl border p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200", cardBg)}>
                            {/* زر البدء الأساسي */}
                            <button
                                type="button"
                                onClick={() => {
                                    if (scope === 'all') {
                                        generateMismatchReport();
                                    } else {
                                        handleVerify();
                                    }
                                }}
                                disabled={isGeneratingReport}
                                className={cn(
                                    "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                                    isGeneratingReport
                                        ? "bg-gray-400 cursor-not-allowed"
                                        : "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
                                )}
                            >
                                {isGeneratingReport ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        جاري الفحص...
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck className="w-5 h-5" />
                                        ابدأ التدقيق
                                    </>
                                )}
                            </button>

                            {/* === تحذير المطابقة (فردي) === */}
                            {validationState !== 'idle' && scope === 'specific' && (
                                <div className={cn(
                                    "rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm font-bold animate-in fade-in zoom-in duration-200",
                                    validationState === 'match'
                                        ? theme === 'light' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-green-500/10 border border-green-500/20 text-green-400'
                                        : theme === 'light' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-red-500/10 border border-red-500/20 text-red-400'
                                )}>
                                    {validationState === 'match' ? (
                                        <><CheckCircle2 className="w-4 h-4 flex-shrink-0" /><span>مطابق للنسبة المعتمدة</span></>
                                    ) : (
                                        <><AlertTriangle className="w-4 h-4 flex-shrink-0" /><span>غير مطابق! النسبة المعتمدة هي ({approvedPercentage ?? 'غير محدد'}%)</span></>
                                    )}
                                </div>
                            )}

                            {/* === نتائج فردية === */}
                            {auditResult !== null && scope === 'specific' && (
                                <div className={cn("rounded-xl border p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300", mutedBg, theme === 'light' ? 'border-gray-200' : 'border-white/10')}>
                                    <div className="flex flex-col items-start gap-0.5">
                                        <span className={cn("text-xs font-bold", labelClr)}>المستحق</span>
                                        {financialData?.is_five_year_leave && (
                                            <span className="text-[10px] text-rose-500 font-bold">(كونه يتمتع بإجازة 5 سنوات)</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={cn("text-lg font-bold font-mono", textClr)}>{fmt(auditResult)}</span>
                                        <span className={cn("text-xs font-mono px-1.5 py-0.5 rounded", theme === 'light' ? 'bg-gray-200 text-gray-600' : 'bg-white/10 text-white/50')}>{approvedPercentage ?? '?'}%</span>
                                    </div>
                                </div>
                            )}
                            {recalcResult !== null && approvedPercentage !== null && (
                                <div className="flex items-center justify-between border-t border-dashed pt-3" style={{ borderColor: theme === 'light' ? '#ddd' : 'rgba(255,255,255,0.1)' }}>
                                    <span className={cn("text-xs font-bold", labelClr)}>المستحق (حسب النسبة)</span>
                                    <div className="flex items-center gap-2">
                                        <span className={cn("text-lg font-bold font-mono", validationState === 'match' ? 'text-green-500' : 'text-amber-400')}>{fmt(recalcResult)}</span>
                                        <span className={cn("text-xs font-mono px-1.5 py-0.5 rounded", validationState === 'match' ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500')}>{approvedPercentage}%</span>
                                    </div>
                                </div>
                            )}
                            {scope === 'specific' && currentValue !== null && (
                                <div className="flex items-center justify-between border-t border-dashed pt-3" style={{ borderColor: theme === 'light' ? '#ddd' : 'rgba(255,255,255,0.1)' }}>
                                    <span className={cn("text-xs font-bold", labelClr)}>المستلم</span>
                                    <div className="flex items-center gap-2">
                                        <span className={cn("text-lg font-bold font-mono", theme === 'light' ? 'text-blue-600' : 'text-blue-400')}>{fmt(currentValue)}</span>
                                        <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded", theme === 'light' ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/10 text-blue-400')}>المستلم</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* === جدول تقرير غير المطابقين (محدّث ليعرض أعمدة إضافية) === */}
                    {scope === 'all' && reportGenerated && (
                        <div className="animate-in fade-in slide-in-from-bottom-3 duration-300 space-y-3">
                            <div className={cn("rounded-lg px-4 py-2.5 flex items-center justify-between gap-2 text-sm font-bold",
                                mismatchRows.length > 0
                                    ? theme === 'light' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-red-500/10 border border-red-500/20 text-red-400'
                                    : theme === 'light' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-green-500/10 border border-green-500/20 text-green-400'
                            )}>
                                <div className="flex items-center gap-2">
                                    {mismatchRows.length > 0 ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                                    <span>{mismatchRows.length > 0 ? `تم العثور على ${mismatchRows.length} قيد غير مطابق` : 'جميع القيود مطابقة 100%'}</span>
                                </div>
                                <span className="text-[10px] font-normal opacity-70">تم فحص {processedCount} سجل</span>
                            </div>

                            {/* الجدول */}
                            {mismatchRows.length > 0 && (
                                <div className={cn("rounded-xl border overflow-hidden", theme === 'light' ? 'border-gray-200' : 'border-white/10')}>
                                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                                        <table className="w-full text-xs">
                                            <thead className={cn("sticky top-0 z-10", theme === 'light' ? 'bg-gray-900 text-white' : 'bg-white/10 text-white')}>
                                                <tr>
                                                    <th className="px-3 py-2.5 text-right font-bold w-[40px]">#</th>
                                                    <th className="px-3 py-2.5 text-right font-bold w-[200px]">الاسم / الرقم الوظيفي</th>
                                                    <th className="px-3 py-2.5 text-center font-bold">الراتب الاسمي</th>
                                                    <th className="px-3 py-2.5 text-center font-bold">المستحق</th>
                                                    <th className="px-3 py-2.5 text-center font-bold">المستلم</th>
                                                    <th className="px-3 py-2.5 text-center font-bold">الملاحظات</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {mismatchRows.map((row, i) => (
                                                    <tr key={i} className={cn(
                                                        "border-t transition-colors",
                                                        theme === 'light' ? i % 2 === 0 ? 'bg-white' : 'bg-gray-50' : i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]',
                                                        theme === 'light' ? 'border-gray-100 hover:bg-gray-100' : 'border-white/5 hover:bg-white/5'
                                                    )}>
                                                        <td className={cn("px-3 py-2 text-right font-mono", labelClr)}>{i + 1}</td>
                                                        <td className={cn("px-3 py-2 text-right font-bold", textClr)}>
                                                            {row.name}
                                                            <div className={cn("text-[9px] font-mono", labelClr)}>#{row.jobNumber}</div>
                                                        </td>
                                                        <td className={cn("px-3 py-2 text-center font-mono", textClr)}>{fmt(row.nominalSalary)}</td>
                                                        <td className={cn("px-3 py-2 text-center font-mono font-bold", textClr)}>{fmt(row.approvedCalc)}</td>
                                                        <td className={cn("px-3 py-2 text-center font-mono font-bold", theme === 'light' ? 'text-blue-600' : 'text-blue-400')}>{fmt(row.currentValue)}</td>
                                                        <td className="px-3 py-2 text-center font-bold text-red-500 text-[10px]">{row.notes}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
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

                        {/* زر الطباعة */}
                        {(auditResult !== null || (reportGenerated && mismatchRows.length > 0)) && (
                            <button
                                onClick={scope === 'all' ? printMismatchReport : printSingleReport}
                                className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20"
                            >
                                <Printer className="w-4 h-4" />
                                PDF / طباعة
                            </button>
                        )}
                    </div>

                    {/* ======= نافذة التحليل الذكي (تمت إزالتها) ======= */}
                </>
            )}
        </div>
    );
}
