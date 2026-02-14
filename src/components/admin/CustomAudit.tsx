import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, AlertTriangle, CheckCircle2, Printer, Loader2, ShieldCheck, Calculator } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { useTheme } from '../../context/ThemeContext';
import { FullAudit } from './FullAudit';

// ===== النسب المعتمدة حسب rwservlet.xml =====
const APPROVED_PERCENTAGES: Record<string, number | null> = {
    certificate_allowance: null,
    engineering_allowance: null,
    legal_allowance: null,
    transport_allowance: null,
    marital_allowance: null,
    children_allowance: null,
    position_allowance: 15,
    risk_allowance: null,
    additional_50_percent_allowance: 50,
    tax_deduction_amount: null,
    loan_deduction: null,
    execution_deduction: null,
    retirement_deduction: 10,
    school_stamp_deduction: null,
    social_security_deduction: 0.25,
    other_deductions: null,
};

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

// ===== الدالة المساعدة لحل النسبة المعتمدة =====
function resolveApprovedPercentage(fieldKey: string, finData: any): number | null {
    if (!finData) return null;

    // === إجازة 5 سنوات: تصفير المخصصات ===
    if (finData.is_five_year_leave) {
        const isAllowance = ALLOWANCE_FIELDS.some(f => f.key === fieldKey);
        if (isAllowance) return 0;
    }
    if (fieldKey === 'certificate_allowance') {
        let t = finData.certificate_text ? finData.certificate_text.trim() : '';

        // تطبيع النص: إزالة الأرقام، الرموز، والمسافات لتسهيل المطابقة (Smart Fuzzy Match)
        // مثال: "دبلو م عالي 55%" -> "دبلومعالي"
        // مثال: "بكلوريوس (قديم)" -> "بكلوريوسقديم"
        const normalized = t.replace(/[0-9%.\s\-\(\)]/g, '');

        if (normalized.includes('دكتوراه')) return 150;
        if (normalized.includes('ماجستير')) return 125;
        if (normalized.includes('دبلومعالي')) return 55; // دبلوم عالي
        if (normalized.includes('بكلوريوس') || normalized.includes('بكالوريوس')) return 45;
        if (normalized.includes('دبلوم') || normalized.includes('معهد')) return 35; // دبلوم أو معهد
        if (normalized.includes('اعدادية') || normalized.includes('إعدادية')) return 25;
        if (normalized.includes('توسطة')) return 15; // متوسطة
        if (normalized.includes('بتدائية') || normalized.includes('إبتدائية')) return 15;
        if (normalized.includes('يقرأ') || normalized.includes('أمي')) return 15;

        return 0; // Default (Primary or none)
    }
    if (fieldKey === 'engineering_allowance') {
        const title = finData.job_title ? finData.job_title.trim() : '';
        // العناوين المشمولة بمخصصات هندسية (35%)
        const engineeringTitles = [
            'م مهندس',
            'مهندس',
            'ر مهندسين',
            'ر مهندسين اقدم',
            'ر مهندسين اقدم اول'
        ];

        // تطبيع العنوان للمقارنة (إزالة مسافات زائدة)
        // التحقق مما إذا كان العنوان يبدأ بأحد العناوين المذكورة أو يطابقها
        // ملاحظة: قد نحتاج لـ startWith أو includes حسب دقة البيانات
        // هنا سنستخدم includes للسلامة، أو exact match إذا كانت البيانات دقيقة
        // بناءً على طلب المستخدم، هذه هي العناوين الخمسة.

        const isEngineer = engineeringTitles.some(t => title === t || title.includes(t));

        if (isEngineer) return 35;
        return 0;
    }
    if (fieldKey === 'legal_allowance') {
        const title = finData.job_title ? finData.job_title.trim() : '';
        const cert = finData.certificate_text ? finData.certificate_text.trim() : '';
        const normalizedCert = cert.replace(/[0-9%.\s\-\(\)]/g, '');

        // العناوين القانونية المحددة بدقة
        const legalTitles = [
            'مستشار قانوني',
            'مستشار قانوني اقدم',
            'مستشار قانوني اقدم اول',
            'مشاور قانوني',
            'مشاور قانوني اقدم',
            'مشاور قانوني اقدم اول',
            'ر مستشارين',
            'ر مستشارين اقدم',
            'ر مستشارين اقدم اول',
            'ر مشاورين',
            'ر مشاورين اقدم',
            'ر مشاورين اقدم اول'
        ];
        const isLegalTitle = legalTitles.some(t => title === t || title.includes(t));
        const isBachelor = normalizedCert.includes('بكلوريوس') || normalizedCert.includes('بكالوريوس');

        if (isLegalTitle && isBachelor) return 30;
        return 0;
    }
    if (fieldKey === 'risk_allowance') {
        const pct = parseFloat(finData.risk_percentage);
        return isNaN(pct) ? null : pct;
    }
    const fixed = APPROVED_PERCENTAGES[fieldKey];
    if (fixed !== undefined && fixed !== null) return fixed;
    const nomSal = parseFloat(finData.nominal_salary) || 0;
    const storedVal = parseFloat(finData[fieldKey]) || 0;
    if (nomSal > 0 && storedVal > 0) {
        return Math.round((storedVal / nomSal) * 10000) / 100;
    }
    return null;
}

// ===== تنسيق الأرقام =====
const fmt = (n: number | null | undefined) => (n !== null && n !== undefined) ? n.toLocaleString('en-US') : '—';

// ===== أنواع البيانات =====
interface MismatchRow {
    name: string;
    jobNumber: string;
    nominalSalary: number;
    userCalc: number;
    approvedCalc: number | null;
    currentValue: number;
    notes: string;
    isFiveYearLeave?: boolean;
}

interface CustomAuditProps {
    onClose: () => void;
}

export function CustomAudit({ onClose }: CustomAuditProps) {
    const { theme } = useTheme();

    // === التبويبات الرئيسية ===
    const [activeTab, setActiveTab] = useState<'custom' | 'full'>('custom');

    const searchRef = useRef<HTMLDivElement>(null);

    // === الحالات العامة ===
    const [scope, setScope] = useState<'all' | 'specific'>('all');
    const [auditType, setAuditType] = useState<'allowances' | 'deductions' | null>(null);
    const [selectedField, setSelectedField] = useState('');

    // === وضع "اسم محدد" ===
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

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

    // === بحث الاقتراحات ===
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
    const loadFinancialData = useCallback(async (userId: string) => {
        const { data } = await supabase
            .from('financial_records')
            .select('*')
            .eq('user_id', userId)
            .single();
        setFinancialData(data);
        return data;
    }, []);

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

    const handleSelectSuggestion = (user: any) => {
        setSelectedEmployee(user);
        setSearchQuery(user.full_name);
        setShowSuggestions(false);
        loadFinancialData(user.id);
        resetAuditResults();
    };

    // === حساب فردي (لوضع التنقل ووضع اسم محدد) ===
    const calculateSingle = useCallback((finData: any, field: string) => {
        if (!finData || !field) return;

        const nominalSalary = parseFloat(finData.nominal_salary) || 0;
        const approved = resolveApprovedPercentage(field, finData);
        const fieldCurrentValue = parseFloat(finData[field]) || 0;

        setApprovedPercentage(approved);
        setCurrentValue(fieldCurrentValue);

        if (approved !== null) {
            const approvedCalc = Math.round((nominalSalary * approved) / 100);
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
            const { data: batch, error } = await supabase
                .from('financial_records')
                .select('*, profiles!inner(full_name, job_number)')
                .order('profiles(full_name)', { ascending: true })
                .range(from, from + PAGE_SIZE - 1);

            if (error || !batch || batch.length === 0) {
                hasMore = false;
                break;
            }

            for (const rec of batch) {
                const nomSal = parseFloat(rec.nominal_salary) || 0;
                if (nomSal <= 0) continue;

                // Pass the job_title from the joined profile to the resolver if needed, 
                // though resolveApprovedPercentage currently expects it in the main object.
                // We'll merge it to be safe or rely on what resolveApprovedPercentage uses.
                // logic in resolveApprovedPercentage uses finData.job_title.
                // The query selects profiles(job_title), we need to map it if not present in finData.
                const profile = (rec as any).profiles;
                const fullRecord = { ...rec, job_title: profile?.job_title || rec.job_title };

                const approved = resolveApprovedPercentage(selectedField, fullRecord);
                if (approved === null) continue;

                const fieldCurrentValue = parseFloat(rec[selectedField]) || 0;
                const approvedCalc = Math.round((nomSal * approved) / 100);

                let mismatch = Math.abs(approvedCalc - fieldCurrentValue) > 1;
                let note = '';

                // === منطق خاص للمخصصات القانونية (الشرط الرباعي) ===
                if (selectedField === 'legal_allowance') {
                    const riskValue = parseFloat(rec.risk_allowance) || 0;

                    // إذا كان مستحقاً (30%)
                    if (approvedCalc > 0) {
                        // 1. يجب أن يستلم المبلغ الصحيح
                        if (Math.abs(approvedCalc - fieldCurrentValue) > 1) {
                            mismatch = true;
                            if (fieldCurrentValue === 0) note = 'يستحق مخصصات قانونية ولا يستلمها';
                            else note = `مبلغ المخصصات غير صحيح (يستحق ${fmt(approvedCalc)})`;
                        }
                        // 2. يجب أن تكون مخصصات الخطورة 0
                        else if (riskValue > 0) {
                            mismatch = true;
                            note = 'يجمع بين مخصصات القانونية والخطورة (يجب حجب الخطورة)';
                        }
                    }
                    // إذا لم يكن مستحقاً (0%)
                    else {
                        if (fieldCurrentValue > 0) {
                            mismatch = true;
                            const title = fullRecord.job_title || '';
                            const cert = fullRecord.certificate_text || '';
                            const normalizedCert = cert.replace(/[0-9%.\s\-\(\)]/g, '');

                            const legalTitles = [
                                'مستشار قانوني',
                                'مستشار قانوني اقدم',
                                'مستشار قانوني اقدم اول',
                                'مشاور قانوني',
                                'مشاور قانوني اقدم',
                                'مشاور قانوني اقدم اول',
                                'ر مستشارين',
                                'ر مستشارين اقدم',
                                'ر مستشارين اقدم اول',
                                'ر مشاورين',
                                'ر مشاورين اقدم',
                                'ر مشاورين اقدم اول'
                            ];
                            const isLegalTitle = legalTitles.some(t => title === t || title.includes(t));
                            const isBachelor = normalizedCert.includes('بكلوريوس') || normalizedCert.includes('بكالوريوس');

                            if (!isLegalTitle && !isBachelor) note = 'العنوان والشهادة لا يطابقان شروط القانونية';
                            else if (!isLegalTitle) note = 'العنوان ليس ضمن العناوين القانونية المعتمدة';
                            else if (!isBachelor) note = 'الشهادة ليست بكلوريوس';
                            else note = 'يستلم مخصصات غير مستحقة';
                        }
                    }
                } else {
                    // المنطق العام لبقية الحقول
                    if (mismatch) {
                        if (selectedField === 'engineering_allowance') {
                            if (approvedCalc > 0 && fieldCurrentValue === 0) {
                                note = 'العنوان مهندس لكن لا توجد مخصصات';
                            } else if (approvedCalc === 0 && fieldCurrentValue > 0) {
                                note = 'عدم تطابق المخصصات مع العنوان';
                            } else {
                                if (fieldCurrentValue > approvedCalc) note = `يستلم زيادة عن الاستحقاق (${fmt(fieldCurrentValue - approvedCalc)})`;
                                else note = `يستلم أقل من الاستحقاق (${fmt(approvedCalc - fieldCurrentValue)})`;
                            }
                        } else if (selectedField === 'certificate_allowance') {
                            if (approvedCalc > 0 && fieldCurrentValue === 0) {
                                note = 'لديه شهادة ولا يستلم مخصصات';
                            } else if (approvedCalc === 0 && fieldCurrentValue > 0) {
                                note = 'يستلم مخصصات شهادة دون وجه حق';
                            } else {
                                if (fieldCurrentValue > approvedCalc) note = `نسبة الشهادة الممنوحة أعلى من المستحق`;
                                else note = `نسبة الشهادة الممنوحة أقل من المستحق`;
                            }
                        } else {
                            if (fieldCurrentValue === 0) note = 'لا يستلم المخصصات المستحقة';
                            else if (approvedCalc === 0) note = 'يستلم مخصصات غير مستحقة';
                            else if (fieldCurrentValue > approvedCalc) note = `القيمة الحالية أعلى من المستحق`;
                            else note = `القيمة الحالية أقل من المستحق`;
                        }
                    }
                }

                if (mismatch) {
                    allRows.push({
                        name: profile?.full_name || '—',
                        jobNumber: profile?.job_number || '—',
                        nominalSalary: nomSal,
                        userCalc: approvedCalc,
                        approvedCalc,
                        currentValue: fieldCurrentValue,
                        notes: note,
                        isFiveYearLeave: rec.is_five_year_leave,
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
    }, [selectedField]);

    // === التحقق اليدوي (لوضع اسم محدد) ===
    const handleVerify = () => {
        calculateSingle(financialData, selectedField);
    };

    // === طباعة تقرير فردي ===
    const printSingleReport = () => {
        const fieldLabel = [...ALLOWANCE_FIELDS, ...DEDUCTION_FIELDS].find(f => f.key === selectedField)?.label || '';
        const pw = window.open('', '_blank');
        if (!pw) return;
        pw.document.write(buildSingleHTML(fieldLabel));
        pw.document.close();
        pw.focus();
        pw.print();
    };

    // === طباعة تقرير الشامل ===
    const printMismatchReport = () => {
        const fieldLabel = [...ALLOWANCE_FIELDS, ...DEDUCTION_FIELDS].find(f => f.key === selectedField)?.label || '';

        const pw = window.open('', '_blank');
        if (!pw) return;
        pw.document.write(`
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>تقرير القيود غير المطابقة</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Tajawal', sans-serif; padding: 30px; color: #1a1a1a; background: white; font-size: 12px; }
        .header { border-bottom: 3px solid #000; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
        .header h1 { font-size: 18px; }
        .summary { display: flex; gap: 15px; margin-bottom: 15px; }
        .summary-item { background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 6px; padding: 8px 12px; }
        .summary-item .label { font-size: 10px; color: #888; }
        .summary-item .value { font-size: 14px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #1a1a1a; color: white; padding: 8px 6px; font-size: 11px; text-align: center; }
        td { border: 1px solid #ddd; padding: 6px; text-align: center; font-size: 12px; }
        tr:nth-child(even) { background: #fafafa; }
        .mismatch { color: #dc2626; font-weight: 700; }
        .footer { margin-top: 25px; padding-top: 10px; border-top: 1px solid #ccc; text-align: center; color: #999; font-size: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <div><h1>تقرير القيود غير المطابقة</h1><p style="color:#666">دائرة المعلوماتية وتكنولوجيا التصالات</p></div>
        <div style="text-align:left"><p>نوع: ${auditType === 'allowances' ? 'مخصصات' : 'استقطاعات'} — ${fieldLabel}</p></div>
    </div>
    <div class="summary">
        <div class="summary-item"><div class="label">غير المطابق</div><div class="value mismatch">${mismatchRows.length}</div></div>
    </div>
    <table>
        <thead>
            <tr><th>#</th><th>الاسم</th><th>الراتب الاسمي</th><th>الاستحقاق حسب النسبة</th><th>الرقم حسب المالية</th><th>الملاحظات</th></tr>
        </thead>
        <tbody>
            ${mismatchRows.map((r, i) => `
            <tr>
                <td>${i + 1}</td>
                <td style="text-align:right">${r.name}<br/><small>${r.jobNumber}</small></td>
                <td>${fmt(r.nominalSalary)}</td>
                <td>
                    ${fmt(r.approvedCalc)}
                    ${r.isFiveYearLeave ? '<br/><small style="color:red; font-size:9px">(إجازة 5 سنوات)</small>' : ''}
                </td>
                <td class="mismatch">${fmt(r.currentValue)}</td>
                <td style="font-size:11px; color:#dc2626">${r.notes}</td>
            </tr>`).join('')}
        </tbody>
    </table>
    <div class="footer"><p>تقرير تدقيقي لأغراض المراجعة</p></div>
</body>
</html>`);
        pw.document.close();
        pw.focus();
        pw.print();
    };

    // === بناء HTML التقرير الفردي ===
    const buildSingleHTML = (fieldLabel: string) => `
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
    </style>
</head>
<body>
    <div class="header">
        <div><h1>تقرير تدقيق محدد</h1><p style="color:#666">دائرة المعلوماتية وتكنولوجيا الاتصالات</p></div>
        <div style="text-align:left"><p>${fieldLabel}</p></div>
    </div>
    <div class="info-grid">
        <div class="info-item"><div class="label">اسم الموظف</div><div class="value">${selectedEmployee?.full_name || '—'}</div></div>
        <div class="info-item"><div class="label">الراتب الاسمي</div><div class="value">${fmt(financialData?.nominal_salary)} د.ع</div></div>
    </div>
    <div class="result-section">
        <div class="result-row"><span class="label">النسبة المعتمدة</span><span class="value">${approvedPercentage !== null ? approvedPercentage + '%' : 'غير محدد'}</span></div>
        <div class="result-row">
            <div style="display:flex; flex-direction:column">
                <span class="label">الاستحقاق (المحسوب)</span>
                ${financialData?.is_five_year_leave ? '<span style="font-size:10px; color:#dc2626; margin-top:2px">(كونه يتمتع بإجازة 5 سنوات)</span>' : ''}
            </div>
            <span class="value">${fmt(auditResult ?? 0)} د.ع</span>
        </div>
        <div class="result-row"><span class="label">القيمة الحالية</span><span class="value">${fmt(currentValue)} د.ع</span></div>
        <div class="result-row"><span class="label">الحالة</span><span class="value ${validationState === 'match' ? 'match' : 'mismatch'}">${validationState === 'match' ? '✓ مطابق' : '✗ غير مطابق'}</span></div>
    </div>
    <div class="footer"><p>تقرير تدقيقي لأغراض المراجعة</p></div>
</body>
</html>`;

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
                                <div className="flex-1 relative" ref={searchRef}>
                                    <label className={cn("text-xs font-bold mb-1.5 block", labelClr)}>البحث عن موظف</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder={scope === 'all' ? "كل المنتسبين" : "الرقم الوظيفي أو الاسم..."}
                                            value={scope === 'all' ? '' : searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            onFocus={() => scope === 'specific' && suggestions.length > 0 && setShowSuggestions(true)}
                                            disabled={scope === 'all'}
                                            className={cn("w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:border-brand-green/50 pr-9",
                                                inputBg,
                                                scope === 'all' && "opacity-50 cursor-not-allowed bg-gray-100 dark:bg-white/5"
                                            )}
                                        />
                                        <Search className={cn("absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4", labelClr)} />
                                        {isSearching && scope === 'specific' && (
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-brand-green/50 border-t-transparent rounded-full animate-spin" />
                                        )}
                                        {/* الاقتراحات */}
                                        {showSuggestions && suggestions.length > 0 && scope === 'specific' && searchRef.current && createPortal(
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
                        <div className="flex gap-4 mb-3">
                            <label className={cn(
                                "flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl border transition-all flex-1 justify-center",
                                auditType === 'allowances'
                                    ? theme === 'light' ? 'bg-cyan-50 border-cyan-300 text-cyan-700' : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                                    : theme === 'light' ? 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                            )}>
                                <input type="radio" name="auditType" checked={auditType === 'allowances'} onChange={() => { setAuditType('allowances'); setSelectedField(''); resetAuditResults(); }} className="accent-cyan-500 w-4 h-4" />
                                <span className="text-sm font-bold">المخصصات</span>
                            </label>
                            <label className={cn(
                                "flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl border transition-all flex-1 justify-center",
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
                                        <span className={cn("text-xs font-bold", labelClr)}>المستحق (حسب النسبة المعتمدة)</span>
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
                                    <span className={cn("text-xs font-bold", labelClr)}>إعادة الاحتساب (النسبة المعتمدة)</span>
                                    <div className="flex items-center gap-2">
                                        <span className={cn("text-lg font-bold font-mono", validationState === 'match' ? 'text-green-500' : 'text-amber-400')}>{fmt(recalcResult)}</span>
                                        <span className={cn("text-xs font-mono px-1.5 py-0.5 rounded", validationState === 'match' ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500')}>{approvedPercentage}%</span>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center justify-between border-t border-dashed pt-3" style={{ borderColor: theme === 'light' ? '#ddd' : 'rgba(255,255,255,0.1)' }}>
                                <span className={cn("text-xs font-bold", labelClr)}>الظاهر حالياً من شعبة المالية</span>
                                <div className="flex items-center gap-2">
                                    <span className={cn("text-lg font-bold font-mono", theme === 'light' ? 'text-blue-600' : 'text-blue-400')}>{fmt(currentValue)}</span>
                                    <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded", theme === 'light' ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/10 text-blue-400')}>المالية</span>
                                </div>
                            </div>
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
                                                    <th className="px-3 py-2.5 text-center font-bold">المستحق (المحسوب)</th>
                                                    <th className="px-3 py-2.5 text-center font-bold">الرقم الحالي</th>
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
