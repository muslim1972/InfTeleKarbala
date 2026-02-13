import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, ArrowRight, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

interface DataPatcherProps {
    onClose: () => void;
}

export function DataPatcher({ onClose }: DataPatcherProps) {
    const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'executing' | 'done'>('upload');
    const [headers, setHeaders] = useState<string[]>([]);
    const [rows, setRows] = useState<any[]>([]);

    // Mapping State
    const [keyCol, setKeyCol] = useState<string>(''); // Column in Excel to match (e.g., Name)
    const [valCol, setValCol] = useState<string>(''); // Column in Excel to take value from (e.g., Total Salary)
    const [targetDbField, setTargetDbField] = useState<string>('gross_salary'); // Field in DB to update

    // Preview State
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [stats, setStats] = useState({ found: 0, missing: 0 });

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

            if (data && data.length > 0) {
                setHeaders(data[0] as string[]);
                // Convert to object array for easier handling
                const jsonData = XLSX.utils.sheet_to_json(ws);
                setRows(jsonData);
                setStep('map');
            }
        };
        reader.readAsBinaryString(selectedFile);
    };

    const handlePreview = async () => {
        if (!keyCol || !valCol) {
            toast.error('يرجى اختيار أعمدة المطابقة والقيمة');
            return;
        }

        setStep('executing'); // Show loading state during matching

        // Fetch all profiles from DB
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, full_name, job_number');

        if (error || !profiles) {
            toast.error('فشل في جلب بيانات الموظفين');
            setStep('map');
            return;
        }

        // Match Logic
        let foundCount = 0;
        let missingCount = 0;
        const matches: any[] = [];

        rows.forEach(row => {
            const excelKey = String(row[keyCol]).trim();
            const excelVal = row[valCol];

            // Try to match by Full Name (Strict Match as requested)
            const profile = profiles.find(p => p.full_name === excelKey);

            if (profile) {
                foundCount++;
                matches.push({
                    profileId: profile.id,
                    name: profile.full_name,
                    oldVal: '—', // We don't fetch old val to save query time, or we could
                    newVal: excelVal
                });
            } else {
                missingCount++;
            }
        });

        setPreviewData(matches);
        setStats({ found: foundCount, missing: missingCount });
        setStep('preview');
    };

    const handleExecute = async () => {
        setStep('executing');
        let successCount = 0;
        let failCount = 0;

        // Process in batches
        const batchSize = 50;
        for (let i = 0; i < previewData.length; i += batchSize) {
            const batch = previewData.slice(i, i + batchSize);

            // We need to update 'financial_records' table.
            // We have profileId. We need to find the financial record ID for that profile?
            // Or simpler: Upsert based on user_id if unique? No, financial_records has 'user_id' FK.
            // Let's assume one financial record per user for now, or use update match user_id.

            // Using Supabase Upsert or Update is tricky with different IDs.
            // Safer to do Promise.all for updates.

            const promises = batch.map(async (item) => {
                // First get financial record ID for this user (if not known)
                // Actually we can update directly `financial_records` where `user_id` = profileId

                const { error } = await supabase
                    .from('financial_records')
                    .update({ [targetDbField]: item.newVal })
                    .eq('user_id', item.profileId);

                if (!error) return true;
                return false;
            });

            const results = await Promise.all(promises);
            successCount += results.filter(r => r).length;
            failCount += results.filter(r => !r).length;
        }

        toast.success(`تم تحديث ${successCount} سجل بنجاح`);
        setStep('done');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-green-600" />
                        تحديث البيانات (Smart Excel Patcher)
                    </h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-red-500">✕</button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">

                    {/* Step 1: Upload */}
                    {step === 'upload' && (
                        <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}>
                            <Upload className="w-12 h-12 text-zinc-400 mb-4" />
                            <p className="text-lg font-medium text-zinc-600 dark:text-zinc-300">اختر ملف Excel (.xlsx)</p>
                            <p className="text-sm text-zinc-400 mt-2">سيتم قراءة البيانات ومطابقتها</p>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept=".xlsx,.xls"
                                onChange={handleFileSelect}
                            />
                        </div>
                    )}

                    {/* Step 2: Map */}
                    {step === 'map' && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-700 dark:text-blue-300">
                                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                                <p className="text-sm">يرجى اختيار العمود الذي يحتوي على "اسم الموظف" والعمود الذي يحتوي على القيمة الجديدة.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">1. عمود الاسم (للمطابقة)</label>
                                    <select
                                        className="w-full p-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                                        value={keyCol}
                                        onChange={(e) => setKeyCol(e.target.value)}
                                    >
                                        <option value="">-- اختر العمود --</option>
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">2. عمود القيمة الجديدة</label>
                                    <select
                                        className="w-full p-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                                        value={valCol}
                                        onChange={(e) => setValCol(e.target.value)}
                                    >
                                        <option value="">-- اختر العمود --</option>
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-sm font-medium">3. الحقل المستهدف في قاعدة البيانات</label>
                                    <select
                                        className="w-full p-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                                        value={targetDbField}
                                        onChange={(e) => setTargetDbField(e.target.value)}
                                    >
                                        <option value="gross_salary">الراتب الكلي (gross_salary)</option>
                                        <option value="net_salary">الراتب الصافي (net_salary)</option>
                                        <option value="nominal_salary">الراتب الاسمي (nominal_salary)</option>
                                        <option value="certificate_allowance">مخصصات الشهادة</option>
                                        <option value="engineering_allowance">مخصصات هندسية</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={handlePreview}
                                disabled={!keyCol || !valCol}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                التالي: معاينة المطابقة <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* Step 3: Preview */}
                    {step === 'preview' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex gap-4">
                                    <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-bold">
                                        تمت المطابقة: {stats.found}
                                    </div>
                                    <div className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-sm font-bold">
                                        غير موجود: {stats.missing}
                                    </div>
                                </div>
                            </div>

                            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                                <table className="w-full text-sm text-right">
                                    <thead className="bg-zinc-50 dark:bg-zinc-800 sticky top-0">
                                        <tr>
                                            <th className="p-3">اسم الموظف</th>
                                            <th className="p-3 text-left ltr">القيمة الجديدة ({valCol})</th>
                                            <th className="p-3 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                        {previewData.slice(0, 50).map((row, idx) => (
                                            <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                                <td className="p-3 font-medium">{row.name}</td>
                                                <td className="p-3 text-left font-mono text-blue-600 dark:text-blue-400">{row.newVal}</td>
                                                <td className="p-3 text-center">
                                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                </td>
                                            </tr>
                                        ))}
                                        {previewData.length > 50 && (
                                            <tr>
                                                <td colSpan={3} className="p-3 text-center text-zinc-500">
                                                    ... و {previewData.length - 50} آخرين
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <button
                                onClick={handleExecute}
                                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center justify-center gap-2"
                            >
                                <Upload className="w-4 h-4" />
                                تنفيذ التحديث ({previewData.length} سجل)
                            </button>
                        </div>
                    )}

                    {/* Executing */}
                    {step === 'executing' && (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                            <p className="text-lg font-medium">جاري معالجة البيانات...</p>
                            <p className="text-sm text-zinc-500">يرجى عدم إغلاق النافذة</p>
                        </div>
                    )}

                    {/* Done */}
                    {step === 'done' && (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
                                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="text-2xl font-bold mb-2">تم التحديث بنجاح!</h3>
                            <p className="text-zinc-600 dark:text-zinc-400 max-w-sm mb-8">
                                تم تحديث البيانات في قاعدة البيانات بنجاح. يمكنك الآن مراجعة سجلات الموظفين للتأكد.
                            </p>
                            <button
                                onClick={onClose}
                                className="px-8 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-lg font-bold hover:opacity-90 transition-opacity"
                            >
                                إغلاق
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
