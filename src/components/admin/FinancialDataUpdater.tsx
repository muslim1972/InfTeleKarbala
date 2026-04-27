import React, { useState, useRef } from 'react';
import { 
    X, 
    Upload, 
    FileSpreadsheet, 
    ChevronRight, 
    ChevronLeft, 
    Check, 
    AlertTriangle,
    Search,
    User,
    ArrowRightLeft,
    Database,
    Loader2
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useEmployeeSearch } from '../../hooks/useEmployeeSearch';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { cleanCertificate, cleanFinancialAmount, normalizeForComparison } from '../../utils/profileUtils';
import { CERTIFICATES } from '../../constants/certificates';

interface FinancialDataUpdaterProps {
    onClose: () => void;
    theme?: 'light' | 'dark';
}

const TARGET_FIELDS = [
    { key: 'job_title', label: 'العنوان الوظيفي', isText: true },
    { key: 'salary_grade', label: 'الدرجة', isText: true },
    { key: 'salary_stage', label: 'المرحلة', isText: true },
    { key: 'certificate_text', label: 'الشهادة', isCertificate: true },
    { key: 'nominal_salary', label: 'الراتب الاسمي', isMoney: true },
    { key: 'certificate_allowance', label: 'مخصصات الشهادة', isMoney: true },
    { key: 'engineering_allowance', label: 'مخصصات هندسية', isMoney: true },
    { key: 'legal_allowance', label: 'مخصصات القانونية', isMoney: true },
    { key: 'transport_allowance', label: 'مخصصات النقل', isMoney: true },
    { key: 'marital_allowance', label: 'مخصصات الزوجية', isMoney: true },
    { key: 'children_allowance', label: 'مخصصات الاطفال', isMoney: true },
    { key: 'position_allowance', label: 'مخصصات المنصب', isMoney: true },
    { key: 'risk_allowance', label: 'مخصصات الخطورة', isMoney: true },
    { key: 'additional_50_percent_allowance', label: 'مخصصات اضافية 50%', isMoney: true },
    { key: 'gross_salary', label: 'الراتب الكلي', isMoney: true },
    { key: 'tax_deduction_status', label: 'حالة الاستقطاع الضريبي', isText: true },
    { key: 'tax_deduction_amount', label: 'الاستقطاع الضريبي', isMoney: true },
    { key: 'retirement_deduction', label: 'استقطاع التقاعد', isMoney: true },
    { key: 'school_stamp_deduction', label: 'استقطاع طابع المدرسة', isMoney: true },
    { key: 'social_security_deduction', label: 'استقطاع الضمان الاجتماعي', isMoney: true },
    { key: 'loan_deduction', label: 'استقطاع السلف', isMoney: true },
    { key: 'execution_deduction', label: 'استقطاع التنفيذ', isMoney: true },
    { key: 'other_deductions', label: 'استقطاعات أخرى', isMoney: true },
    { key: 'total_deductions', label: 'مجموع الاستقطاعات', isMoney: true },
    { key: 'net_salary', label: 'صافي الراتب', isMoney: true },
    { key: 'iban', label: 'IBAN', isText: true },
    { key: 'remaining_leaves_balance', label: 'رصيد الإجازات المتبقي', isMoney: true },
    { key: 'leaves_balance_expiry_date', label: 'تاريخ انتهاء الرصيد', isText: true },
];

const DEFAULT_MAPPING_HINTS: Record<string, string[]> = {
    'job_number': ['الرقم الوظيفي', 'رقم_وظيفي', 'job_number'],
    'job_title': ['العنوان الوظيفي', 'job_title'],
    'salary_grade': ['الدرجة', 'grade'],
    'salary_stage': ['المرحلة', 'stage'],
    'certificate_text': ['الشهادة', 'التحصيل الدراسي'],
    'nominal_salary': ['الراتب الاسمي', 'الراتب الأسمي'],
    'certificate_allowance': ['مخصصات الشهادة'],
    'engineering_allowance': ['مخصصات هندسية', 'مخصصات الهندسة'],
    'legal_allowance': ['مخصصات القانونية', 'مخصصات قانونية'],
    'transport_allowance': ['مخصصات النقل', 'النقل'],
    'marital_allowance': ['مخصصات الزوجية', 'الزوجية'],
    'children_allowance': ['مخصصات الاطفال', 'الاولاد', 'الأطفال'],
    'position_allowance': ['مخصصات المنصب', 'المنصب'],
    'risk_allowance': ['مخصصات الخطورة', 'الخطورة'],
    'additional_50_percent_allowance': ['المخصصات الاضافية 50%', 'مخصصات اضافية 50%'],
    'gross_salary': ['الراتب الاجمالي ( الايرادات)', 'الراتب الكلي', 'الراتب الإجمالي'],
    'tax_deduction_status': ['حالة الموظف في الاستقطاع الضريبي', 'حالة الاستقطاع الضريبي'],
    'tax_deduction_amount': ['الضريبة', 'مبلغ الضريبة'],
    'retirement_deduction': ['استقطاع التقاعد', 'التقاعد'],
    'school_stamp_deduction': ['استقطاع طابع المدرسة', 'طابع مدرسي'],
    'social_security_deduction': ['استقطاع الضمان الاجتماعي', 'الحماية الاجتماعية'],
    'loan_deduction': ['استقطاع السلف', 'استقطاع مبلغ القرض'],
    'execution_deduction': ['استقطاع التنفيذ', 'مبلغ التنفيذ'],
    'other_deductions': ['استقطاعات أخرى', 'طرح مبلغ'],
    'total_deductions': ['مجموع الاستقطاعات', 'اجمالي الاستقطاعات'],
    'net_salary': ['صافي الراتب', 'الراتب الصافي'],
    'iban': ['IBAN', 'الايبان'],
};

export const FinancialDataUpdater: React.FC<FinancialDataUpdaterProps> = ({ onClose, theme = 'light' }) => {
    const [step, setStep] = useState(1);
    const [scope, setScope] = useState<'all' | 'single'>('all');
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [excelData, setExcelData] = useState<any[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [processedCount, setProcessedCount] = useState(0);
    const [processingMessage, setProcessingMessage] = useState<string>('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const { query: searchQuery, setQuery: setSearchQuery, results, isSearching } = useEmployeeSearch();

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(arrayBuffer);
            
            const worksheet = workbook.worksheets[0];
            if (!worksheet) {
                toast.error('الملف فارغ');
                return;
            }

            // Get headers from first row
            const headerRow = worksheet.getRow(1);
            const excelHeaders: string[] = [];
            headerRow.eachCell((cell) => {
                excelHeaders.push(String(cell.value || '').trim());
            });

            if (excelHeaders.length === 0) {
                toast.error('لم يتم العثور على عناوين أعمدة');
                return;
            }

            setHeaders(excelHeaders);

            // Get data rows
            const rows: any[] = [];
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header row
                
                const obj: any = {};
                excelHeaders.forEach((h, i) => {
                    const cell = row.getCell(i + 1);
                    obj[h] = cell.value;
                });
                rows.push(obj);
            });

            setExcelData(rows);

            // Auto-mapping based on hints
            const initialMapping: Record<string, string> = {};
            
            // 1. Mandatory match field
            const jobIdMatch = excelHeaders.find(h => 
                DEFAULT_MAPPING_HINTS['job_number'].some(hint => 
                    h === hint || h.includes(hint) || normalizeForComparison(h) === normalizeForComparison(hint)
                )
            );
            if (jobIdMatch) initialMapping['job_number'] = jobIdMatch;

            // 2. All target fields
            [...TARGET_FIELDS, {key: 'job_number', label: 'الرقم الوظيفي'}].forEach(field => {
                const fieldHints = DEFAULT_MAPPING_HINTS[field.key] || [field.label];
                
                // Try EXACT matches first
                let match = excelHeaders.find(h => 
                    fieldHints.some(hint => 
                        h === hint || normalizeForComparison(h) === normalizeForComparison(hint)
                    )
                );
                
                // Only then try includes
                if (!match) {
                    match = excelHeaders.find(h => 
                        fieldHints.some(hint => h.includes(hint))
                    );
                }
                
                if (match) initialMapping[field.key] = match;
            });
            
            setMapping(initialMapping);
            toast.success(`تم تحميل ${rows.length} سجل مالي بنجاح`);
        } catch (error) {
            console.error(error);
            toast.error('خطأ في قراءة ملف Excel');
        }
    };

    const handleStartPreview = async () => {
        if (excelData.length === 0) {
            toast.error('يرجى رفع ملف Excel أولاً');
            return;
        }

        if (!mapping['job_number']) {
            toast.error('يجب ربط حقل "الرقم الوظيفي" للمطابقة');
            return;
        }

        setIsProcessing(true);
        setProcessingMessage('جاري البحث عن الموظفين...');
        setProgress(0);
        
        try {
            const previewRows: any[] = [];
            
            let rowsToProcess = excelData;
            if (scope === 'single' && selectedEmployee) {
                rowsToProcess = excelData.filter(row => String(row[mapping['job_number']]) === String(selectedEmployee.job_number));
            }

            const jobNumbers = rowsToProcess.map(r => String(r[mapping['job_number']]));
            
            // 1. Get user IDs via profiles table (BATHCED for large lists)
            const FETCH_BATCH_SIZE = 200;
            const profiles: any[] = [];
            for (let i = 0; i < jobNumbers.length; i += FETCH_BATCH_SIZE) {
                const batchJobNums = jobNumbers.slice(i, i + FETCH_BATCH_SIZE);
                const { data: batchProfiles, error: pError } = await supabase
                    .from('profiles')
                    .select('id, job_number, full_name')
                    .in('job_number', batchJobNums);
                
                if (pError) throw pError;
                if (batchProfiles) profiles.push(...batchProfiles);
                const currentP = Math.round(((i + batchJobNums.length) / jobNumbers.length) * 50);
                console.log(`[Diagnostic] Profiles chunk: ${profiles.length}/${jobNumbers.length} (${currentP}%)`);
                setProgress(currentP);
            }

            if (profiles.length === 0) {
                toast.error('لم يتم العثور على موظفين مطابقين في قاعدة البيانات');
                setIsProcessing(false);
                return;
            }

            // 2. Get current financial records (BATCHED - smaller size for large data)
            setProcessingMessage('جاري جلب السجلات المالية الحالية...');
            const userIds = profiles.map(p => p.id);
            const currentFinancials: any[] = [];
            const FIN_BATCH_SIZE = 50; // Much smaller batch for financial data
            
            for (let i = 0; i < userIds.length; i += FIN_BATCH_SIZE) {
                const batchUserIds = userIds.slice(i, i + FIN_BATCH_SIZE);
                console.log(`[Diagnostic] Fetching financial batch for ${batchUserIds.length} users...`);
                const { data: batchFin, error: fError } = await supabase
                    .from('financial_records')
                    .select('*')
                    .in('user_id', batchUserIds);
                
                if (fError) {
                    console.error('[Diagnostic] Financial fetch error:', fError);
                    throw fError;
                }
                if (batchFin) currentFinancials.push(...batchFin);
                const currentP = 50 + Math.round(((i + batchUserIds.length) / userIds.length) * 50);
                console.log(`[Diagnostic] Financials chunk: ${currentFinancials.length}/${userIds.length} (${currentP}%)`);
                setProgress(currentP);
            }

            setProcessingMessage('جاري تحليل ومعالجة البيانات...');
            setProgress(0);
            setProcessedCount(0);

            rowsToProcess.forEach(row => {
                const jobNum = String(row[mapping['job_number']]);
                const profile = profiles.find(p => String(p.job_number) === jobNum);
                
                if (profile) {
                    const existing = currentFinancials?.find(f => f.user_id === profile.id);
                    const updates: any = { job_number: jobNum, userId: profile.id, displayName: profile.full_name, existingId: existing?.id };
                    let hasChanges = false;
                    
                    // 1. Regular mapped fields
                    TARGET_FIELDS.forEach(field => {
                        let excelValue = row[mapping[field.key]];
                        if (excelValue !== undefined && excelValue !== null) {
                            if (field.isCertificate) {
                                excelValue = cleanCertificate(excelValue);
                            } else if (field.isMoney) {
                                excelValue = cleanFinancialAmount(excelValue);
                            }

                            const fromValue = existing ? existing[field.key] : null;
                            const modified = String(fromValue || '') !== String(excelValue || '');
                            
                            updates[field.key] = {
                                from: fromValue,
                                to: excelValue,
                                modified: modified
                            };
                            if (modified) hasChanges = true;

                            // Debug logging for the first few rows
                            if (previewRows.length < 5) {
                                console.log(`[Diagnostic] Row ${previewRows.length} - ${field.key}: Mapping "${mapping[field.key]}" -> Value: ${excelValue} (Modified: ${modified})`);
                            }
                        } else if (previewRows.length < 5 && mapping[field.key]) {
                            console.warn(`[Diagnostic] Row ${previewRows.length} - ${field.key}: Column "${mapping[field.key]}" exists but cell is empty.`);
                        }
                    });

                    // 2. Automated Certificate Percentage
                    if (updates['certificate_text']) {
                        const certText = updates['certificate_text'].to;
                        const certDef = CERTIFICATES.find(c => 
                            certText === c.label || 
                            (c.aliases && c.aliases.includes(certText)) ||
                            normalizeForComparison(certText) === normalizeForComparison(c.label)
                        );
                        
                        if (certDef) {
                            const fromValue = existing ? existing['certificate_percentage'] : null;
                            const toValue = certDef.percentage;
                            const modified = Number(fromValue) !== Number(toValue);
                            
                            updates['certificate_percentage'] = {
                                from: fromValue,
                                to: toValue,
                                modified: modified
                            };
                            if (modified) hasChanges = true;
                        }
                    }
                    
                    if (hasChanges) {
                        previewRows.push(updates);
                    }
                }
            });

            setPreviewData(previewRows);
            if (previewRows.length === 0) {
                toast('لا توجد تغييرات مالية لتحديثها', { icon: 'ℹ️' });
            } else {
                setStep(3);
            }
        } catch (error) {
            console.error(error);
            toast.error('خطأ أثناء تحضير المعاينة');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleInjectData = async () => {
        setIsProcessing(true);
        setProcessingMessage('جاري حقن البيانات...');
        setProgress(0);
        let successCount = 0;
        let failCount = 0;
        const total = previewData.length;
        const BATCH_SIZE = 50;

        try {
            for (let i = 0; i < total; i += BATCH_SIZE) {
                const batch = previewData.slice(i, i + BATCH_SIZE);
                const dataToSaveList = batch.map(row => {
                    const dataToSave: any = { 
                        user_id: row.userId, 
                        updated_at: new Date().toISOString(),
                        last_modified_by_name: 'System/Batch Update' 
                    };
                    
                    TARGET_FIELDS.forEach(field => {
                        // FIX: Include all mapped fields to ensure data is written correctly
                        // even if 'modified' detection was tricky (e.g. null vs 0 issues)
                        if (row[field.key]) {
                            dataToSave[field.key] = row[field.key].to;
                        }
                    });

                    if (row['certificate_percentage']) {
                        dataToSave['certificate_percentage'] = row['certificate_percentage'].to;
                    }
                    
                    return dataToSave;
                });

                const { error } = await supabase
                    .from('financial_records')
                    .upsert(dataToSaveList, { onConflict: 'user_id' });

                if (error) {
                    console.error(`Error updating batch starting at ${i}:`, error);
                    failCount += batch.length;
                } else {
                    successCount += batch.length;
                }
                
                setProcessedCount(i + batch.length);
                const currentProgress = Math.min(100, Math.round(((i + batch.length) / total) * 100));
                setProgress(currentProgress);
            }

            toast.success(`تم تحديث ${successCount} سجل مالي بنجاح${failCount > 0 ? `، وفشل ${failCount}` : ''}`);
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('حدث خطأ أثناء حقن البيانات المالية');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <style dangerouslySetInnerHTML={{ __html: `
                .rtl-select {
                    appearance: none !important;
                    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e") !important;
                    background-repeat: no-repeat !important;
                    background-position: left 0.5rem center !important;
                    background-size: 1em !important;
                    padding-left: 2rem !important;
                }
            `}} />
            <div className={cn(
                "w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden transition-all duration-500 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800",
                theme === 'dark' ? 'dark' : ''
            )}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                            <FileSpreadsheet className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">تحديث تفاصيل الراتب</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">حقن البيانات المالية من ملف Excel (جدول الراتب)</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-red-50 hover:text-red-500 transition-colors">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {isProcessing && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 px-6 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Loader2 className="w-3 h-3 text-green-500 animate-spin" />
                            <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">
                                {processingMessage || 'جاري المعالجة'}: {previewData.length > 0 ? `${processedCount} من أصل ${previewData.length}` : `${progress}%`}
                            </span>
                        </div>
                        <span className="text-[10px] font-bold text-green-600 dark:text-green-400">{progress}%</span>
                    </div>
                )}

                {isProcessing && progress > 0 && (
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-full bg-green-500 transition-all duration-300 shadow-[0_0_10px_rgba(34,197,94,0.5)]" style={{ width: `${progress}%` }} />
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-6">
                    <div className="flex items-center justify-center mb-8">
                        {[1, 2, 3].map((s) => (
                            <React.Fragment key={s}>
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300",
                                    step === s ? "bg-green-500 text-white shadow-lg shadow-green-500/30 scale-110" : 
                                    step > s ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                                )}>
                                    {step > s ? <Check className="w-4 h-4" /> : s}
                                </div>
                                {s < 3 && <div className={cn("w-12 h-0.5 mx-2", step > s ? "bg-green-500" : "bg-slate-200 dark:bg-slate-800")} />}
                            </React.Fragment>
                        ))}
                    </div>

                    {step === 1 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">نطاق التحديث</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => setScope('all')} className={cn("p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2", scope === 'all' ? "border-green-500 bg-green-50/50 dark:bg-green-900/10" : "border-slate-100 dark:border-slate-800")}>
                                            <Database className={cn("w-6 h-6", scope === 'all' ? "text-green-500" : "text-slate-400")} />
                                            <span className="text-sm font-medium">تحديث الكل</span>
                                        </button>
                                        <button onClick={() => setScope('single')} className={cn("p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2", scope === 'single' ? "border-green-500 bg-green-50/50 dark:bg-green-900/10" : "border-slate-100 dark:border-slate-800")}>
                                            <User className={cn("w-6 h-6", scope === 'single' ? "text-green-500" : "text-slate-400")} />
                                            <span className="text-sm font-medium">موظف محدد</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">ملف Excel (الراتب)</label>
                                    <div onClick={() => fileInputRef.current?.click()} className="h-[108px] border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-green-500 cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-800/30">
                                        <Upload className="w-6 h-6 text-slate-400" />
                                        <span className="text-xs text-slate-500">{excelData.length > 0 ? `تم اختيار ${excelData.length} سجل` : "اضغط لرفع الملف"}</span>
                                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
                                    </div>
                                </div>
                            </div>

                            {scope === 'single' && (
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                                    <div className="relative">
                                        {isSearching ? <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500 w-4 h-4 animate-spin" /> : <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />}
                                        <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="ابحث عن الموظف..." className="pr-10" />
                                    </div>
                                    {results.length > 0 && !selectedEmployee && (
                                        <div className="max-h-40 overflow-y-auto rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800">
                                            {results.map((emp) => (
                                                <button key={emp.id} onClick={() => { setSelectedEmployee(emp); setSearchQuery(''); }} className="w-full p-3 text-right hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between border-b last:border-0 dark:border-slate-700">
                                                    <span className="text-sm font-medium">{emp.full_name}</span>
                                                    <span className="text-xs text-slate-500">{emp.job_number}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {selectedEmployee && (
                                        <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white"><Check className="w-4 h-4" /></div>
                                                <div>
                                                    <p className="text-sm font-bold text-green-700 dark:text-green-400">{selectedEmployee.full_name}</p>
                                                    <p className="text-xs text-green-600/70">{selectedEmployee.job_number}</p>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => setSelectedEmployee(null)} className="text-green-600 hover:text-green-700">تغيير</Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {excelData.length > 0 && (
                                <div className="flex justify-end pt-4 border-t dark:border-slate-800">
                                    <Button onClick={() => setStep(2)} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                                        متابعة لربط الأعمدة
                                        <ChevronLeft className="w-4 h-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-in slide-in-from-left-4 fade-in duration-500">
                            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/50 p-4 rounded-xl flex gap-3 text-amber-800 dark:text-amber-400">
                                <AlertTriangle className="w-5 h-5 shrink-0" />
                                <div className="text-xs space-y-1">
                                    <p className="font-bold">تنبيه المطابقة المالية:</p>
                                    <p>سيتم تحديث سجلات الراتب بناءً على <strong>الرقم الوظيفي</strong>. إذا لم يتوفر سجل مالي للموظف، سيتم إنشاء سجل جديد.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
                                    <label className="text-xs font-bold text-slate-500 mb-3 block">حقل المطابقة</label>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 text-sm font-bold p-2 bg-white dark:bg-slate-800 rounded border dark:border-slate-700">الرقم الوظيفي</div>
                                        <ArrowRightLeft className="w-4 h-4 text-slate-300" />
                                        <select value={mapping['job_number'] || ''} onChange={(e) => setMapping({ ...mapping, job_number: e.target.value })} className="rtl-select flex-1 p-2 text-sm rounded bg-white dark:bg-slate-800 border dark:border-slate-700 focus:ring-2 ring-green-500 outline-none">
                                            <option value="">اختر من Excel...</option>
                                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
                                    <label className="text-xs font-bold text-slate-500 mb-3 block">بيانات الراتب</label>
                                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                                        {TARGET_FIELDS.map((field) => (
                                            <div key={field.key} className="flex items-center gap-3">
                                                <div className="flex-1 text-xs p-2 bg-white dark:bg-slate-800 rounded border dark:border-slate-700">{field.label}</div>
                                                <ArrowRightLeft className="w-3 h-3 text-slate-300" />
                                                <select value={mapping[field.key] || ''} onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })} className="rtl-select flex-1 p-2 text-xs rounded bg-white dark:bg-slate-800 border dark:border-slate-700 outline-none">
                                                    <option value="">تجاهل</option>
                                                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between pt-4 border-t dark:border-slate-800">
                                <Button variant="ghost" onClick={() => setStep(1)} className="gap-2"><ChevronRight className="w-4 h-4" />رجوع</Button>
                                <Button onClick={handleStartPreview} disabled={isProcessing} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                    بدء المعاينة
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 animate-in zoom-in-95 fade-in duration-500">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">سجلات الراتب المقترحة ({previewData.length})</h3>
                                <div className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">التغييرات فقط</div>
                            </div>

                            <div className="border rounded-xl overflow-hidden dark:border-slate-800">
                                <div className="max-h-[400px] overflow-auto">
                                    <table className="w-full text-right text-xs">
                                        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700">
                                            <tr>
                                                <th className="p-3">الموظف</th>
                                                <th className="p-3">تغييرات الراتب</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-slate-800">
                                            {previewData.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <td className="p-3 align-top">
                                                        <div className="font-bold">{row.displayName}</div>
                                                        <div className="text-[10px] text-slate-500">{row.job_number}</div>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex flex-wrap gap-2">
                                                            {TARGET_FIELDS.map(field => row[field.key]?.modified && (
                                                                <div key={field.key} className="bg-white dark:bg-slate-900 border dark:border-slate-700 p-2 rounded shadow-sm min-w-[150px]">
                                                                    <div className="text-[9px] text-slate-400 mb-1">{field.label}</div>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-red-500 line-through opacity-50">{row[field.key].from !== null ? (field.isMoney ? `${row[field.key].from} د.ع` : row[field.key].from) : 'فارغ'}</span>
                                                                        <ChevronLeft className="w-3 h-3 text-slate-300" />
                                                                        <span className="text-green-600 font-bold">{field.isMoney ? `${row[field.key].to} د.ع` : row[field.key].to}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="flex justify-between pt-4 border-t dark:border-slate-800">
                                <Button variant="ghost" onClick={() => setStep(2)} disabled={isProcessing} className="gap-2"><ChevronRight className="w-4 h-4" />رجوع</Button>
                                <Button onClick={handleInjectData} disabled={isProcessing || previewData.length === 0} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    تأكيد تحديث الرواتب
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
