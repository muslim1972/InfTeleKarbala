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
import * as XLSX from 'xlsx';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useEmployeeSearch } from '../../hooks/useEmployeeSearch';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { cleanText } from '../../utils/profileUtils';

interface ProfileDataUpdaterProps {
    onClose: () => void;
    theme?: 'light' | 'dark';
}

const TARGET_FIELDS = [
    { key: 'full_name', label: 'الاسم الكامل' },
    { key: 'graduation_year', label: 'سنة التخرج' },
    { key: 'specialization', label: 'التخصص (PROF)' },
    { key: 'work_nature', label: 'طبيعة العمل' },
    { key: 'appointment_date', label: 'تاريخ التعيين' },
    { key: 'dept_text', label: 'القسم' },
    { key: 'section_text', label: 'الشعبة' },
    { key: 'unit_text', label: 'الوحدة' },
];

export const ProfileDataUpdater: React.FC<ProfileDataUpdaterProps> = ({ onClose, theme = 'light' }) => {
    const [step, setStep] = useState(1);
    const [scope, setScope] = useState<'all' | 'single'>('all');
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [excelData, setExcelData] = useState<any[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const { query: searchQuery, setQuery: setSearchQuery, results, isSearching } = useEmployeeSearch();

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
                
                if (data.length > 0) {
                    const excelHeaders = data[0].map(h => String(h));
                    setHeaders(excelHeaders);
                    
                    // Convert to objects for easier handling
                    const rows = data.slice(1).map(row => {
                        const obj: any = {};
                        excelHeaders.forEach((h, i) => {
                            obj[h] = row[i];
                        });
                        return obj;
                    });
                    setExcelData(rows);

                    // Auto-mapping logic (matching by name or common keys)
                    const initialMapping: Record<string, string> = {};
                    TARGET_FIELDS.forEach(field => {
                        const match = excelHeaders.find(h => 
                            h === field.label || 
                            h.includes(field.label) || 
                            h.toLowerCase() === field.key.toLowerCase()
                        );
                        if (match) initialMapping[field.key] = match;
                    });
                    
                    // Always try to find job_number for matching
                    const jobIdMatch = excelHeaders.find(h => h.includes('رقم_وظيفي') || h.includes('الرقم الوظيفي') || h.toLowerCase() === 'job_number');
                    if (jobIdMatch) initialMapping['job_number'] = jobIdMatch;
                    
                    setMapping(initialMapping);
                    toast.success(`تم تحميل ${rows.length} سجل بنجاح`);
                }
            } catch (error) {
                console.error(error);
                toast.error('خطأ في قراءة ملف Excel');
            }
        };
        reader.readAsBinaryString(file);
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
        try {
            const previewRows: any[] = [];
            
            // If single employee, filter excel data
            let rowsToProcess = excelData;
            if (scope === 'single' && selectedEmployee) {
                rowsToProcess = excelData.filter(row => String(row[mapping['job_number']]) === String(selectedEmployee.job_number));
                if (rowsToProcess.length === 0) {
                    toast.error('لم يتم العثور على الرقم الوظيفي للموظف المختار في ملف Excel');
                    setIsProcessing(false);
                    return;
                }
            }

            // Get current profiles data for these job numbers to show what will change
            const jobNumbers = rowsToProcess.map(r => String(r[mapping['job_number']]));
            const { data: currentProfiles } = await supabase
                .from('profiles')
                .select('*')
                .in('job_number', jobNumbers);

            rowsToProcess.forEach(row => {
                const jobNum = String(row[mapping['job_number']]);
                const existing = currentProfiles?.find(p => String(p.job_number) === jobNum);
                
                if (existing) {
                    const updates: any = { job_number: jobNum, id: existing.id, full_name: existing.full_name };
                    let hasChanges = false;
                    
                    TARGET_FIELDS.forEach(field => {
                        let excelValue = row[mapping[field.key]];
                        if (excelValue !== undefined && excelValue !== null) {
                            // Apply cleaning to organizational fields
                            if (['dept_text', 'section_text', 'unit_text'].includes(field.key)) {
                                excelValue = cleanText(excelValue);
                            }

                            updates[field.key] = {
                                from: existing[field.key],
                                to: excelValue,
                                modified: String(existing[field.key] || '') !== String(excelValue || '')
                            };
                            if (updates[field.key].modified) hasChanges = true;
                        }
                    });
                    
                    if (hasChanges) {
                        previewRows.push(updates);
                    }
                }
            });

            setPreviewData(previewRows);
            if (previewRows.length === 0) {
                toast('لا توجد تغييرات لتحديثها', { icon: 'ℹ️' });
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
        setProgress(0);
        let successCount = 0;
        let failCount = 0;

        try {
            for (let i = 0; i < previewData.length; i++) {
                const row = previewData[i];
                const updates: any = {};
                
                TARGET_FIELDS.forEach(field => {
                    if (row[field.key] && row[field.key].modified) {
                        updates[field.key] = row[field.key].to;
                    }
                });

                const { error } = await supabase
                    .from('profiles')
                    .update(updates)
                    .eq('id', row.id);

                if (error) {
                    console.error(`Error updating ${row.full_name}:`, error);
                    failCount++;
                } else {
                    successCount++;
                }
                
                setProgress(Math.round(((i + 1) / previewData.length) * 100));
            }

            toast.success(`تم تحديث ${successCount} سجل بنجاح${failCount > 0 ? `، وفشل ${failCount}` : ''}`);
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('حدث خطأ أثناء حقن البيانات');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            {/* CSS to fix select arrow position in RTL */}
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
                        <div className="p-2 bg-teal-500/10 rounded-lg">
                            <FileSpreadsheet className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">تحديث المعلومات الأساسية</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">حقن البيانات من ملف Excel إلى سجلات الموظفين</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-red-50 hover:text-red-500 transition-colors">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Progress Bar (Visible during processing) */}
                {isProcessing && progress > 0 && (
                    <div className="h-1 w-full bg-slate-100 dark:bg-slate-800">
                        <div 
                            className="h-full bg-teal-500 transition-all duration-300" 
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Step Indicators */}
                    <div className="flex items-center justify-center mb-8">
                        {[1, 2, 3].map((s) => (
                            <React.Fragment key={s}>
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300",
                                    step === s ? "bg-teal-500 text-white shadow-lg shadow-teal-500/30 scale-110" : 
                                    step > s ? "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                                )}>
                                    {step > s ? <Check className="w-4 h-4" /> : s}
                                </div>
                                {s < 3 && <div className={cn("w-12 h-0.5 mx-2", step > s ? "bg-teal-500" : "bg-slate-200 dark:bg-slate-800")} />}
                            </React.Fragment>
                        ))}
                    </div>

                    {step === 1 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Scope Selection */}
                                <div className="space-y-4">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">نطاق التحديث</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setScope('all')}
                                            className={cn(
                                                "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                                                scope === 'all' ? "border-teal-500 bg-teal-50/50 dark:bg-teal-900/10" : "border-slate-100 dark:border-slate-800"
                                            )}
                                        >
                                            <Database className={cn("w-6 h-6", scope === 'all' ? "text-teal-500" : "text-slate-400")} />
                                            <span className="text-sm font-medium">تحديث الكل</span>
                                        </button>
                                        <button
                                            onClick={() => setScope('single')}
                                            className={cn(
                                                "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                                                scope === 'single' ? "border-teal-500 bg-teal-50/50 dark:bg-teal-900/10" : "border-slate-100 dark:border-slate-800"
                                            )}
                                        >
                                            <User className={cn("w-6 h-6", scope === 'single' ? "text-teal-500" : "text-slate-400")} />
                                            <span className="text-sm font-medium">موظف محدد</span>
                                        </button>
                                    </div>
                                </div>

                                {/* File Upload */}
                                <div className="space-y-4">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">ملف Excel</label>
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="h-[108px] border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-teal-500 cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-800/30"
                                    >
                                        <Upload className="w-6 h-6 text-slate-400" />
                                        <span className="text-xs text-slate-500">{excelData.length > 0 ? `تم اختيار ${excelData.length} سجل` : "اضغط لرفع الملف"}</span>
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            onChange={handleFileUpload} 
                                            accept=".xlsx, .xls" 
                                            className="hidden" 
                                        />
                                    </div>
                                </div>
                            </div>

                            {scope === 'single' && (
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="relative">
                                        {isSearching ? (
                                            <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 text-teal-500 w-4 h-4 animate-spin" />
                                        ) : (
                                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                        )}
                                        <Input
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="ابحث عن الموظف بالاسم أو الرقم الوظيفي..."
                                            className="pr-10"
                                        />
                                    </div>

                                    {results.length > 0 && !selectedEmployee && (
                                        <div className="max-h-40 overflow-y-auto rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800">
                                            {results.map((emp) => (
                                                <button
                                                    key={emp.id}
                                                    onClick={() => {
                                                        setSelectedEmployee(emp);
                                                        setSearchQuery('');
                                                    }}
                                                    className="w-full p-3 text-right hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between border-b last:border-0 dark:border-slate-700"
                                                >
                                                    <span className="text-sm font-medium">{emp.full_name}</span>
                                                    <span className="text-xs text-slate-500">{emp.job_number}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {selectedEmployee && (
                                        <div className="flex items-center justify-between p-3 bg-teal-500/10 border border-teal-500/20 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white">
                                                    <Check className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-teal-700 dark:text-teal-400">{selectedEmployee.full_name}</p>
                                                    <p className="text-xs text-teal-600/70">{selectedEmployee.job_number}</p>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => setSelectedEmployee(null)} className="text-teal-600 hover:text-teal-700">تغيير</Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {excelData.length > 0 && (
                                <div className="flex justify-end pt-4 border-t dark:border-slate-800">
                                    <Button 
                                        onClick={() => setStep(2)} 
                                        className="gap-2 bg-teal-600 hover:bg-teal-700 text-white"
                                    >
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
                                    <p className="font-bold">تنبيه المطابقة:</p>
                                    <p>المطابقة تتم حصراً عبر حقل <strong>الرقم الوظيفي</strong>. تأكد من ربطه بشكل صحيح لضمان تحديث سجل الموظف المقصود.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
                                    <label className="text-xs font-bold text-slate-500 mb-3 block">حقل المطابقة (إجباري)</label>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 text-sm font-bold p-2 bg-white dark:bg-slate-800 rounded border dark:border-slate-700">الرقم الوظيفي</div>
                                        <ArrowRightLeft className="w-4 h-4 text-slate-300" />
                                        <select
                                            value={mapping['job_number'] || ''}
                                            onChange={(e) => setMapping({ ...mapping, job_number: e.target.value })}
                                            className="rtl-select flex-1 p-2 text-sm rounded bg-white dark:bg-slate-800 border dark:border-slate-700 focus:ring-2 ring-teal-500 outline-none"
                                        >
                                            <option value="">اختر من Excel...</option>
                                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
                                    <label className="text-xs font-bold text-slate-500 mb-3 block">البيانات المراد تحديثها</label>
                                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                                        {TARGET_FIELDS.map((field) => (
                                            <div key={field.key} className="flex items-center gap-3">
                                                <div className="flex-1 text-xs p-2 bg-white dark:bg-slate-800 rounded border dark:border-slate-700">{field.label}</div>
                                                <ArrowRightLeft className="w-3 h-3 text-slate-300" />
                                                <select
                                                    value={mapping[field.key] || ''}
                                                    onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                                                    className="rtl-select flex-1 p-2 text-xs rounded bg-white dark:bg-slate-800 border dark:border-slate-700 outline-none"
                                                >
                                                    <option value="">تجاهل</option>
                                                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between pt-4 border-t dark:border-slate-800">
                                <Button variant="ghost" onClick={() => setStep(1)} className="gap-2">
                                    <ChevronRight className="w-4 h-4" />
                                    رجوع
                                </Button>
                                <Button 
                                    onClick={handleStartPreview} 
                                    disabled={isProcessing}
                                    className="gap-2 bg-teal-600 hover:bg-teal-700 text-white"
                                >
                                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                    بدء المعاينة
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 animate-in zoom-in-95 fade-in duration-500">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">سجلات التعديل المقترحة ({previewData.length})</h3>
                                <div className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                    يتم عرض السجلات التي تحتوي على تغييرات فقط
                                </div>
                            </div>

                            <div className="border rounded-xl overflow-hidden dark:border-slate-800">
                                <div className="max-h-[400px] overflow-auto">
                                    <table className="w-full text-right text-xs">
                                        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700">
                                            <tr>
                                                <th className="p-3">الموظف</th>
                                                <th className="p-3">التغييرات</th>
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
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-red-500 line-through opacity-50">{row[field.key].from || 'فارغ'}</span>
                                                                        <ChevronLeft className="w-3 h-3 text-slate-300" />
                                                                        <span className="text-green-600 font-bold">{row[field.key].to}</span>
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
                                <Button variant="ghost" onClick={() => setStep(2)} disabled={isProcessing} className="gap-2">
                                    <ChevronRight className="w-4 h-4" />
                                    تعديل الربط
                                </Button>
                                <Button 
                                    onClick={handleInjectData} 
                                    disabled={isProcessing || previewData.length === 0}
                                    className="gap-2 bg-teal-600 hover:bg-teal-700 text-white"
                                >
                                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    تأكيد الحقن النهائي
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
