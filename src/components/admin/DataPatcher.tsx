import { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { ArrowRight, CheckCircle2, AlertTriangle, Loader2, Upload, Database, FileSpreadsheet, X, Save, PlusCircle, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

interface DataPatcherProps {
    onClose: () => void;
}

type Step = 'upload' | 'map' | 'preview' | 'executing' | 'done' | 'manual_search' | 'manual_edit';

interface MatchResult {
    status: 'match' | 'missing' | 'new_record';
    recordId?: string; // For updates
    profileId?: string; // For inserts (new_record)
    currentName?: string;
    excelName: string;
    oldValue?: any;
    newValue: any;
    rawRow?: any[];
}

export function DataPatcher({ onClose }: DataPatcherProps) {
    const [step, setStep] = useState<Step>('upload');
    const [mode, setMode] = useState<'patch' | 'sync' | 'manual'>('patch'); // 'patch' = single field, 'sync' = full record
    const [headers, setHeaders] = useState<string[]>([]);
    const [rows, setRows] = useState<any[][]>([]); // Array of arrays
    const [fileName, setFileName] = useState('');

    // Mapping State (storing Column INDEX as string)
    const [keyCol, setKeyCol] = useState<string>('');
    const [valCol, setValCol] = useState<string>('');
    const [targetDbField, setTargetDbField] = useState<string>('');

    // Sync Mode State
    const [syncMapping, setSyncMapping] = useState<Record<string, string>>({}); // { dbField: excelColIndex }

    // Manual Mode State
    const [manualSearchQuery, setManualSearchQuery] = useState('');
    const [manualSearchResults, setManualSearchResults] = useState<any[]>([]);
    const [selectedManualProfile, setSelectedManualProfile] = useState<any>(null);
    const [manualFormData, setManualFormData] = useState<any>({});
    const [isSearching, setIsSearching] = useState(false);

    // Matching Configuration
    const [matchBy, setMatchBy] = useState<'full_name' | 'username'>('full_name');

    // Missing Logic States
    const [showMissingModal, setShowMissingModal] = useState(false);
    const [allowMissingSkip, setAllowMissingSkip] = useState(false);

    // Normalization helper for Arabic names
    const normalizeText = (text: string) => {
        if (!text) return '';
        return String(text)
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove hidden characters (ZWSP, etc)
            .trim()
            .toLowerCase()
            .replace(/[أإآ]/g, 'ا') // Normalize Alef
            .replace(/ة/g, 'ه') // Normalize Ta Marbuta to Ha
            .replace(/ى/g, 'ي') // Normalize Ya
            .replace(/عبد\s+ال/g, 'عبدال') // Normalize "Abd Al" to "Abdal" (no space)
            .replace(/عبدال/g, 'عبد ال') // Standardize to "Abd Al" (with space) for consistency
            .replace(/\s+/g, ' '); // Normalize multiple spaces to single
    };

    // Preview Analysis
    const [matches, setMatches] = useState<MatchResult[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Database Fields Configuration
    // Label: Display Name, Value: DB Column Name
    const dbFields = [
        { label: 'الراتب الاسمي (Nominal Salary)', value: 'nominal_salary' },
        { label: 'الراتب الكلي (Gross Salary)', value: 'gross_salary' },
        { label: 'الراتب الصافي (Net Salary)', value: 'net_salary' },
        { label: 'مخصصات الشهادة', value: 'certificate_allowance' },
        { label: 'مخصصات هندسية', value: 'engineering_allowance' },
        { label: 'مخصصات الخطورة', value: 'risk_allowance' },
        { label: 'مخصصات الزوجية', value: 'marital_allowance' },
        { label: 'مخصصات الأطفال', value: 'children_allowance' },
        { label: 'استقطاع الضمان', value: 'social_security_deduction' },
        { label: 'استقطاع الضريبة', value: 'tax_deduction_amount' },
        { label: 'رصيد الاجازات المتبقي (أيام)', value: 'remaining_leaves_balance' },
        { label: 'تاريخ نفاذ الرصيد', value: 'leaves_balance_expiry_date' },
        { label: 'رقم الايبان (IBAN)', value: 'iban' },
    ];

    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<string>('');
    const [headerRowIndex, setHeaderRowIndex] = useState<number>(0);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFileName(selectedFile.name);
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const buffer = evt.target?.result;
                const wb = XLSX.read(buffer, { type: 'array' });

                setWorkbook(wb);
                setSheetNames(wb.SheetNames);
                setSelectedSheet(wb.SheetNames[0]); // Default to first sheet
                setHeaderRowIndex(0); // Default to first row

            } catch (error) {
                console.error('Error parsing Excel:', error);
                toast.error('حدث خطأ أثناء قراءة الملف');
            }
        };
        reader.readAsArrayBuffer(selectedFile);
    };

    // Parse data when workbook, sheet, or header row changes
    useMemo(() => {
        if (!workbook || !selectedSheet) return;

        try {
            const ws = workbook.Sheets[selectedSheet];
            // Get all data as arrays (Row 0 is header)
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

            if (!data || data.length === 0) {
                setHeaders([]);
                setRows([]);
                return;
            }

            // Extract headers based on selected row index
            // Validate index
            const safeIndex = Math.max(0, Math.min(headerRowIndex, data.length - 1));
            const foundHeaders = data[safeIndex] || [];

            setHeaders(foundHeaders.map(h => String(h || '').trim()));

            // Store data rows (excluding header)
            setRows(data.slice(safeIndex + 1));

            // Reset mapping when file/sheet changes
            setKeyCol('');
            setValCol('');

            // Auto-suggest mapping if possible (by searching headers)
            const nameColIndex = foundHeaders.findIndex((c: any) =>
                String(c).includes('اسم') || String(c).toLowerCase().includes('name')
            );

            if (nameColIndex !== -1) setKeyCol(String(nameColIndex));

            setStep('map');
        } catch (error) {
            console.error('Error parsing sheet:', error);
            toast.error('حدث خطأ أثناء معالجة الورقة');
        }
    }, [workbook, selectedSheet, headerRowIndex]);

    const cleanValue = (val: any, field: string) => {
        // List of fields that MUST be numeric
        const numericFields = [
            'nominal_salary', 'salary_grade', 'salary_stage',
            'children_count', 'gross_salary', 'net_salary',
            'base_rate', 'transport_allowance', 'risk_allowance',
            'food_allowance', 'children_allowance',
            'social_security_deduction', 'tax_deduction_amount',
            'remaining_leaves_balance'
        ];

        if (numericFields.includes(field)) {
            if (typeof val === 'number') return val;
            if (val === null || val === undefined || val === '') return 0;
            const strVal = String(val).trim().replace(/,/g, '');
            if (strVal === '') return 0;
            const num = parseFloat(strVal);
            return isNaN(num) ? 0 : num;
        }

        if (val === null || val === undefined || val === '') return null;
        return String(val).trim();
    };

    const analyzeData = async () => {
        if (mode === 'patch' && (!keyCol || !valCol || !targetDbField)) {
            toast.error('يرجى إكمال جميع خيارات الربط');
            return;
        }

        // Validate sync mapping
        if (mode === 'sync') {
            if (!syncMapping['full_name']) {
                toast.error('يرجى ربط عمود الاسم الكامل (Full Name) على الأقل');
                return;
            }
        }

        try {
            setStep('executing');
            setAllowMissingSkip(false);

            // 1. Fetch ALL "profiles" with their "financial_records"
            const { data: profilesRaw, error } = await supabase
                .from('profiles')
                .select(`
                    id,
                    username,
                    full_name,
                    job_number,
                    financial_records (*)
                `) as any;

            if (error) throw error;

            const profiles = profilesRaw || [];

            // 2. Build Map for fast lookup
            const profileMap = new Map();
            profiles.forEach((p: any) => {
                const finRecord = Array.isArray(p.financial_records) ? p.financial_records[0] : p.financial_records;

                const entry = {
                    profileId: p.id,
                    username: p.username,
                    full_name: p.full_name,
                    job_number: p.job_number,
                    financialRecordId: finRecord?.id, // Exists if they have a record
                    currentFinancialData: finRecord || {}
                };

                // Index by Normalized Name
                if (p.full_name) profileMap.set(normalizeText(p.full_name), entry);
                // Index by Username
                if (p.username) profileMap.set(normalizeText(p.username), entry);
            });

            const results: MatchResult[] = [];

            rows.forEach(row => {
                let excelValueRaw = '';
                let newValue: any = null;

                if (mode === 'patch') {
                    const keyIdx = parseInt(keyCol);
                    const valIdx = parseInt(valCol);
                    excelValueRaw = String(row[keyIdx] || '').trim();
                    // CLEAN THE VALUE HERE
                    const rawVal = row[valIdx];
                    newValue = cleanValue(rawVal, targetDbField);
                } else {
                    // Sync mode
                    const nameIdx = parseInt(syncMapping['full_name']);
                    excelValueRaw = String(row[nameIdx] || '').trim();

                    const updateObj: any = {};
                    Object.entries(syncMapping).forEach(([dbField, colIdx]) => {
                        if (dbField === 'full_name' || dbField === 'username' || dbField === 'job_number') return; // keys and profile fields
                        const idx = parseInt(colIdx);
                        if (!isNaN(idx)) {
                            const rawVal = row[idx];
                            // CLEAN THE VALUE HERE
                            updateObj[dbField] = cleanValue(rawVal, dbField);
                        }
                    });
                    newValue = updateObj;
                }

                const excelValueNorm = normalizeText(excelValueRaw);
                if (!excelValueNorm) return; // Skip empty rows

                const matchedProfile = profileMap.get(excelValueNorm);

                if (matchedProfile) {
                    if (matchedProfile.financialRecordId) {
                        results.push({
                            status: 'match',
                            recordId: matchedProfile.financialRecordId,
                            currentName: matchedProfile.full_name,
                            excelName: excelValueRaw,
                            oldValue: mode === 'patch' ? matchedProfile.currentFinancialData[targetDbField] : '(موجود)',
                            newValue: newValue
                        });
                    } else {
                        results.push({
                            status: 'new_record',
                            profileId: matchedProfile.profileId,
                            currentName: matchedProfile.full_name,
                            excelName: excelValueRaw,
                            oldValue: '(جديد)',
                            newValue: newValue
                        });
                    }
                } else {
                    results.push({
                        status: 'missing',
                        excelName: excelValueRaw,
                        newValue: newValue,
                        rawRow: row
                    });
                }
            });

            setMatches(results);
            setStep('preview');

        } catch (error) {
            console.error('Error analyzing data:', error);
            toast.error('حدث خطأ أثناء فحص البيانات');
            setStep('map');
        }
    };

    const executeUpdate = async () => {
        try {
            setStep('executing');
            let successCount = 0;
            let lastError: any = null;

            // Process matches (Updates) AND new records (Inserts)
            const tasks = matches.filter(m => m.status === 'match' || m.status === 'new_record');
            const CHUNK_SIZE = 50;

            for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
                const chunk = tasks.slice(i, i + CHUNK_SIZE);

                const promises = chunk.map(async (item) => {
                    let payload: any = { updated_at: new Date().toISOString() };

                    // Prepare Payload
                    if (mode === 'patch') {
                        payload[targetDbField] = item.newValue;
                    } else {
                        payload = { ...payload, ...item.newValue };
                    }

                    let error: any = null;

                    if (item.status === 'match' && item.recordId) {
                        // UPDATE
                        const res = await supabase
                            .from('financial_records')
                            .update(payload)
                            .eq('id', item.recordId);
                        error = res.error;
                    } else if (item.status === 'new_record' && item.profileId) {
                        // INSERT
                        payload.user_id = item.profileId;
                        const res = await supabase
                            .from('financial_records')
                            .insert([payload]);
                        error = res.error;
                    }

                    if (error) {
                        console.error("Operation failed for item:", item, error);
                        lastError = error;
                        return false;
                    }
                    return true;
                });

                const results = await Promise.all(promises);
                successCount += results.filter(Boolean).length;
            }

            if (successCount > 0) {
                toast.success(`تم معالجة ${successCount} سجل بنجاح`);
                setStep('done');
            } else {
                if (lastError) {
                    toast.error(`فشلت العملية: ${lastError.message || lastError.details || 'خطأ غير معروف'}`);
                } else {
                    toast.error('فشلت العملية');
                }
                setStep('preview');
            }
        } catch (e) {
            console.error(e);
            toast.error('حدث خطأ غير متوقع');
            setStep('preview');
        }
    };

    const stats = useMemo(() => {
        return {
            total: matches.length,
            found: matches.filter(m => m.status === 'match').length,
            new: matches.filter(m => m.status === 'new_record').length,
            missing: matches.filter(m => m.status === 'missing').length
        };
    }, [matches]);

    // --- Manual Mode Handlers ---

    const handleManualSearch = async () => {
        if (!manualSearchQuery.trim()) return;
        setIsSearching(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*, financial_records(*)')
                .or(`full_name.ilike.%${manualSearchQuery}%,username.ilike.%${manualSearchQuery}%,job_number.ilike.%${manualSearchQuery}%`)
                .limit(10);

            if (error) throw error;
            setManualSearchResults(data || []);
        } catch (error) {
            console.error(error);
            toast.error('حدث خطأ في البحث');
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectProfile = (profile: any) => {
        setSelectedManualProfile(profile);
        const finRecord = Array.isArray(profile.financial_records) ? profile.financial_records[0] : profile.financial_records;
        setManualFormData(finRecord || {});
        setStep('manual_edit');
    };

    const handleManualSave = async () => {
        if (!selectedManualProfile) return;

        try {
            setStep('executing');

            // Clean Data
            const payload: any = { updated_at: new Date().toISOString() };
            dbFields.forEach(field => {
                const val = manualFormData[field.value];
                payload[field.value] = cleanValue(val, field.value);
            });

            // Check if update or insert
            const finRecord = Array.isArray(selectedManualProfile.financial_records) ? selectedManualProfile.financial_records[0] : selectedManualProfile.financial_records;

            if (finRecord?.id) {
                // Update
                const { error } = await supabase
                    .from('financial_records')
                    .update(payload)
                    .eq('id', finRecord.id);
                if (error) throw error;
            } else {
                // Insert
                payload.user_id = selectedManualProfile.id;
                const { error } = await supabase
                    .from('financial_records')
                    .insert([payload]);
                if (error) throw error;
            }

            toast.success('تم حفظ البيانات بنجاح');
            setStep('manual_search');
            setSelectedManualProfile(null);
            setManualFormData({});
            // Refresh search results if needed? No need really.
        } catch (error) {
            console.error(error);
            toast.error('حدث خطأ أثناء الحفظ');
            setStep('manual_edit');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[85vh]">

                {/* Header */}
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-start bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
                            <Database className="w-5 h-5 text-blue-600" />
                            حقن البيانات (Smart Injector)
                        </h2>
                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={() => { setMode('patch'); setStep('upload'); }}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all border ${mode === 'patch'
                                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                                    : 'bg-transparent text-zinc-500 border-transparent hover:bg-zinc-100'
                                    }`}
                            >
                                تحديث حقل واحد
                            </button>
                            <button
                                onClick={() => { setMode('sync'); setStep('upload'); }}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all border ${mode === 'sync'
                                    ? 'bg-purple-100 text-purple-700 border-purple-200'
                                    : 'bg-transparent text-zinc-500 border-transparent hover:bg-zinc-100'
                                    }`}
                            >
                                مزامنة شاملة
                            </button>
                            <button
                                onClick={() => { setMode('manual'); setStep('manual_search'); }}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all border ${mode === 'manual'
                                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                                    : 'bg-transparent text-zinc-500 border-transparent hover:bg-zinc-100'
                                    }`}
                            >
                                حقن يدوي
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-zinc-500" />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-0.5 bg-zinc-100 dark:bg-zinc-800">
                    <div
                        className="h-full bg-blue-600 transition-all duration-500 ease-out"
                        style={{
                            width: step === 'upload' ? '25%' :
                                step === 'map' ? '50%' :
                                    step === 'preview' ? '75%' : '100%'
                        }}
                    />
                </div>

                {/* Content Area */}
                <div className="flex-1 min-h-0 overflow-y-auto relative bg-zinc-50/50 dark:bg-black/20 overscroll-contain scroll-smooth">

                    {/* Manual Mode: Search */}
                    {step === 'manual_search' && (
                        <div className="p-6 h-full flex flex-col items-center animate-in slide-in-from-bottom-5 duration-300">
                            <div className="w-full max-w-xl space-y-4">
                                <div className="relative">
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        placeholder="بحث عن موظف (الاسم، اسم المستخدم، الرقم الوظيفي)..."
                                        className="w-full p-4 pr-10 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                                        value={manualSearchQuery}
                                        onChange={(e) => setManualSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                                    />
                                    <button
                                        onClick={handleManualSearch}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold transition-colors"
                                        disabled={isSearching}
                                    >
                                        {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'بحث'}
                                    </button>
                                </div>

                                <div className="space-y-2 mt-4 max-h-[60vh] overflow-y-auto">
                                    {manualSearchResults.map((profile) => {
                                        const hasRecord = profile.financial_records && (Array.isArray(profile.financial_records) ? profile.financial_records.length > 0 : true);
                                        return (
                                            <div
                                                key={profile.id}
                                                onClick={() => handleSelectProfile(profile)}
                                                className="p-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:border-amber-500 cursor-pointer transition-colors group flex justify-between items-center"
                                            >
                                                <div>
                                                    <p className="font-bold text-zinc-900 dark:text-white">{profile.full_name || 'بدون اسم'}</p>
                                                    <p className="text-sm text-zinc-500">@{profile.username} | {profile.job_number || 'No Job #'}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {hasRecord ? (
                                                        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">لديه سجل</span>
                                                    ) : (
                                                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">جديد</span>
                                                    )}
                                                    <ArrowRight className="w-5 h-5 text-zinc-300 group-hover:text-amber-500 transition-colors rotate-180" />
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {manualSearchResults.length === 0 && manualSearchQuery && !isSearching && (
                                        <div className="text-center text-zinc-500 py-8">لا يوجد نتائج</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Manual Mode: Edit */}
                    {step === 'manual_edit' && selectedManualProfile && (
                        <div className="p-6 animate-in slide-in-from-right-10 duration-300 pb-24">
                            <div className="max-w-2xl mx-auto space-y-6">
                                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-zinc-200 dark:border-zinc-800">
                                    <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center text-amber-600 font-bold text-xl">
                                        {selectedManualProfile.full_name?.[0] || '?'}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold">{selectedManualProfile.full_name}</h3>
                                        <p className="text-zinc-500">@{selectedManualProfile.username}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {dbFields.map((field) => (
                                        <div key={field.value} className="space-y-1">
                                            <label className="text-xs font-bold text-zinc-500">{field.label}</label>
                                            <input
                                                type={field.value.includes('date') ? 'date' : 'text'}
                                                className="w-full p-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                                                value={manualFormData[field.value] || ''}
                                                onChange={(e) => setManualFormData({ ...manualFormData, [field.value]: e.target.value })}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3 z-50">
                                    <button
                                        onClick={() => setStep('manual_search')}
                                        className="px-6 py-2 rounded-lg font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                    >
                                        إلغاء
                                    </button>
                                    <button
                                        onClick={handleManualSave}
                                        className="px-6 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold transition-colors flex items-center gap-2"
                                    >
                                        <Save className="w-4 h-4" />
                                        حفظ التغييرات
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 1: Upload */}
                    {step === 'upload' && (
                        <div className="h-full flex flex-col items-center justify-center p-6 animate-in slide-in-from-bottom-5 duration-300">
                            <div
                                className="w-full max-w-sm border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-8 flex flex-col items-center text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all group"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                                </div>
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">
                                    اضغط لرفع ملف Excel
                                </h3>
                                <p className="text-zinc-500 dark:text-zinc-400 text-xs max-w-xs">
                                    يجب أن يحتوي الملف على عمود لاسم الموظف وعمود للقيمة المراد تحديثها (.xlsx, .xls)
                                </p>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept=".xlsx,.xls"
                                onChange={handleFileSelect}
                            />
                        </div>
                    )}

                    {/* Step 2: Mapping */}
                    {step === 'map' && (
                        <div className="p-4 md:p-8 animate-in slide-in-from-right-10 duration-300">
                            <div className="max-w-2xl mx-auto space-y-8">
                                <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-xl border border-blue-100 dark:border-blue-900/50">
                                    <FileSpreadsheet className="w-5 h-5 flex-shrink-0" />
                                    <div>
                                        <p className="font-bold text-sm">الملف المحدد: {fileName}</p>
                                        <p className="text-xs opacity-80 mt-0.5">يرجى ربط الأعمدة أدناه لبدء عملية المطابقة</p>
                                    </div>
                                </div>

                                {/* Configuration: Sheet & Header Row */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {sheetNames.length > 1 && (
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                                ورقة العمل (Sheet)
                                            </label>
                                            <select
                                                value={selectedSheet}
                                                onChange={e => setSelectedSheet(e.target.value)}
                                                className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                {sheetNames.map(sheet => (
                                                    <option key={sheet} value={sheet}>{sheet}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                            رقم صف العناوين (Header Row)
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={headerRowIndex + 1}
                                            onChange={e => setHeaderRowIndex(Math.max(0, parseInt(e.target.value) - 1))}
                                            className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <p className="text-xs text-zinc-500">حدد رقم الصف الذي يحتوي على أسماء الأعمدة</p>
                                    </div>
                                </div>

                                <div className="grid gap-6">
                                    {mode === 'patch' ? (
                                        <>
                                            {/* Match Configuration */}
                                            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-4">
                                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                                    معيار المطابقة (Matching Field)
                                                </label>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <button
                                                        onClick={() => setMatchBy('full_name')}
                                                        className={`px-4 py-3 rounded-lg border text-sm font-bold transition-all ${matchBy === 'full_name'
                                                            ? 'bg-blue-600 text-white border-blue-600'
                                                            : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-blue-400'
                                                            }`}
                                                    >
                                                        الاسم الكامل (Full Name)
                                                    </button>
                                                    <button
                                                        onClick={() => setMatchBy('username')}
                                                        className={`px-4 py-3 rounded-lg border text-sm font-bold transition-all ${matchBy === 'username'
                                                            ? 'bg-blue-600 text-white border-blue-600'
                                                            : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-blue-400'
                                                            }`}
                                                    >
                                                        اسم المستخدم (Username)
                                                    </button>
                                                </div>
                                                <p className="text-xs text-zinc-500">
                                                    {matchBy === 'full_name'
                                                        ? 'سيتم مطابقة الاسم العربي مع معالجة الاختلافات (الهمزات، المسافات).'
                                                        : 'سيتم المطابقة بدقة مع حقل اسم المستخدم (Username) في النظام.'}
                                                </p>
                                            </div>

                                            {/* Source Key */}
                                            <div className="space-y-3">
                                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                                    1. عمود المطابقة من الإكسل
                                                </label>
                                                <div className="relative">
                                                    <select
                                                        value={keyCol}
                                                        onChange={(e) => setKeyCol(e.target.value)}
                                                        className="w-full p-4 pl-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl appearance-none focus:ring-2 focus:ring-blue-500 outline-none text-right"
                                                    >
                                                        <option value="">اختر العمود...</option>
                                                        {headers.map((h, i) => (
                                                            <option key={i} value={i.toString()}>
                                                                {h || `عمود ${i + 1}`}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="flex justify-center">
                                                <div className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded-full">
                                                    <ArrowRight className="w-5 h-5 text-zinc-400 rotate-90" />
                                                </div>
                                            </div>

                                            {/* Source Value */}
                                            <div className="space-y-3">
                                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                                    2. عمود القيمة الجديدة من الإكسل
                                                </label>
                                                <select
                                                    value={valCol}
                                                    onChange={(e) => setValCol(e.target.value)}
                                                    className="w-full p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl appearance-none focus:ring-2 focus:ring-blue-500 outline-none text-right"
                                                >
                                                    <option value="">اختر العمود...</option>
                                                    {headers.map((h, i) => (
                                                        <option key={i} value={i.toString()}>
                                                            {h || `عمود ${i + 1}`}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Target DB Field */}
                                            <div className="space-y-3">
                                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                                    3. الحقل المستهدف في النظام
                                                </label>
                                                <select
                                                    value={targetDbField}
                                                    onChange={(e) => setTargetDbField(e.target.value)}
                                                    className="w-full p-4 bg-white dark:bg-zinc-900 border-2 border-green-500/20 dark:border-green-500/20 rounded-xl appearance-none focus:ring-2 focus:ring-green-500 outline-none text-right font-bold text-green-700 dark:text-green-400"
                                                >
                                                    <option value="">اختر الحقل...</option>
                                                    {dbFields.map((field) => (
                                                        <option key={field.value} value={field.value}>
                                                            {field.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </>
                                    ) : (
                                        /* SYNC MODE MAPPING */
                                        <div className="space-y-6">
                                            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-900/50 flex gap-3">
                                                <div className="p-2 bg-purple-100 dark:bg-purple-800 rounded-lg h-fit">
                                                    <FileSpreadsheet className="w-5 h-5 text-purple-600 dark:text-purple-300" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-purple-900 dark:text-purple-100">المزامنة الشاملة (Smart Sync)</h3>
                                                    <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                                                        سيتم تحديث سجلات الموظفين بناءً على <strong>الاسم الكامل (Full Name)</strong> أو <strong>اسم المستخدم</strong>.
                                                        يرجى ربط الأعمدة الأساسية أدناه.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                                                    <h4 className="font-bold text-sm mb-3 text-zinc-700 dark:text-zinc-300">1. الحقول التعريفية (إجبارية)</h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {[
                                                            { label: 'الرقم الوظيفي (Key)', key: 'job_number', required: false },
                                                            { label: 'الاسم الكامل', key: 'full_name', required: true },
                                                            { label: 'اسم المستخدم', key: 'username', required: false },
                                                        ].map((f) => (
                                                            <div key={f.key}>
                                                                <label className="block text-xs font-bold text-zinc-500 mb-1">
                                                                    {f.label} {f.required && <span className="text-red-500">*</span>}
                                                                </label>
                                                                <select
                                                                    className="w-full p-2.5 bg-white dark:bg-zinc-900 border rounded-lg text-sm"
                                                                    value={syncMapping[f.key] || ''}
                                                                    onChange={(e) => setSyncMapping(prev => ({ ...prev, [f.key]: e.target.value }))}
                                                                >
                                                                    <option value="">(غير محدد)</option>
                                                                    {headers.map((h, i) => (
                                                                        <option key={i} value={i.toString()}>{h || `Column ${i + 1}`}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                                                    <h4 className="font-bold text-sm mb-3 text-zinc-700 dark:text-zinc-300">2. البيانات المالية</h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {dbFields.map((f) => (
                                                            <div key={f.value}>
                                                                <label className="block text-xs font-medium text-zinc-500 mb-1 truncate">
                                                                    {f.label}
                                                                </label>
                                                                <select
                                                                    className="w-full p-2.5 bg-white dark:bg-zinc-900 border rounded-lg text-sm"
                                                                    value={syncMapping[f.value] || ''}
                                                                    onChange={(e) => setSyncMapping(prev => ({ ...prev, [f.value]: e.target.value }))}
                                                                >
                                                                    <option value="">(تجاهل)</option>
                                                                    {headers.map((h, i) => (
                                                                        <option key={i} value={i.toString()}>{h || `Column ${i + 1}`}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Preview */}
                    {
                        step === 'preview' && (
                            <div className="h-full flex flex-col p-6 animate-in slide-in-from-right-10 duration-300">
                                {/* Missing Records Warning Zone */}
                                {stats.missing > 0 && (
                                    <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div>
                                            <h4 className="font-bold text-amber-800 dark:text-amber-400 flex items-center gap-2">
                                                <AlertTriangle className="w-5 h-5" />
                                                تنبيه مهم: {stats.missing} سجل إضافي في الإكسل
                                            </h4>
                                            <p className="text-sm text-amber-700/80 dark:text-amber-400/80 mt-1">
                                                تم إيجاد أسماء وأرقام في هذا الملف لا تمتلك أي قيود أساسية لدينا في قاعدة البيانات لتتم المطابقة المعيارية عليها.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setShowMissingModal(true)}
                                            className="whitespace-nowrap px-4 py-2 bg-amber-100 hover:bg-amber-200 dark:bg-amber-800/50 dark:hover:bg-amber-800 text-amber-700 dark:text-amber-300 font-bold rounded-lg transition-colors border border-amber-300 dark:border-amber-700 shadow-sm"
                                        >
                                            استعراض الأسماء الإضافية
                                        </button>
                                    </div>
                                )}

                                {/* Stats Bar */}
                                <div className="grid grid-cols-4 gap-2 mb-4">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-100 dark:border-blue-900/50 flex flex-col items-center justify-center">
                                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase">العدد الكلي</p>
                                        <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{stats.total}</p>
                                    </div>
                                    <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-lg border border-green-100 dark:border-green-900/50 flex flex-col items-center justify-center">
                                        <p className="text-[10px] text-green-600 dark:text-green-400 font-bold uppercase">تحديث</p>
                                        <p className="text-xl font-bold text-green-700 dark:text-green-300">{stats.found}</p>
                                    </div>
                                    <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded-lg border border-purple-100 dark:border-purple-900/50 flex flex-col items-center justify-center">
                                        <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase">سجلات جديدة</p>
                                        <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{stats.new}</p>
                                    </div>
                                    <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg border border-amber-100 dark:border-amber-900/50 flex flex-col items-center justify-center">
                                        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase">غير موجود</p>
                                        <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{stats.missing}</p>
                                    </div>
                                </div>

                                {/* Table */}
                                <div className="flex-1 overflow-hidden border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900">
                                    <div className="overflow-y-auto h-full">
                                        <table className="w-full text-right bg-white dark:bg-zinc-900">
                                            <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold text-zinc-500 uppercase tracking-wider z-10 shadow-sm">
                                                <tr>
                                                    <th className="p-3 w-16 text-center">الحالة</th>
                                                    <th className="p-3">الاسم (النظام/الملف)</th>
                                                    <th className="p-3 text-left">القيمة الجديدة</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                                {matches.map((m, idx) => (
                                                    <tr key={idx} className={`group transition-colors ${m.status === 'match' ? 'hover:bg-green-50/50 dark:hover:bg-green-900/10' :
                                                        m.status === 'new_record' ? 'bg-purple-50/30 hover:bg-purple-50/50 dark:bg-purple-900/10 dark:hover:bg-purple-900/20' :
                                                            'bg-red-50/30 dark:bg-red-900/10'
                                                        }`}>
                                                        <td className="p-3 text-center">
                                                            {m.status === 'match' ? (
                                                                <div className="flex justify-center" title="تحديث سجل موجود">
                                                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                                                </div>
                                                            ) : m.status === 'new_record' ? (
                                                                <div className="flex justify-center" title="إنشاء سجل جديد">
                                                                    <PlusCircle className="w-5 h-5 text-purple-500" />
                                                                </div>
                                                            ) : (
                                                                <div className="flex justify-center" title="غير موجود في النظام">
                                                                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="flex flex-col">
                                                                <span className={`font-bold ${m.status === 'match' ? 'text-zinc-900 dark:text-zinc-100' :
                                                                    m.status === 'new_record' ? 'text-purple-700 dark:text-purple-300' :
                                                                        'text-zinc-400'
                                                                    }`}>
                                                                    {m.currentName || '—'}
                                                                </span>
                                                                <span className="text-xs text-zinc-500 font-mono mt-0.5">
                                                                    {m.excelName}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-left font-mono font-bold text-blue-600 dark:text-blue-400 dir-ltr">
                                                            {mode === 'patch' ? (
                                                                m.newValue
                                                            ) : (
                                                                <div className="text-xs">
                                                                    {m.newValue && typeof m.newValue === 'object' ? (
                                                                        Object.keys(m.newValue).length + ' حقول'
                                                                    ) : (
                                                                        '—'
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Missing Records Modal */}
                                {showMissingModal && (
                                    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                                        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200">
                                            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50 rounded-t-xl">
                                                <h3 className="font-bold text-lg flex items-center gap-2 text-zinc-900 dark:text-white">
                                                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                                                    الأسماء الإضافية غير المتطابقة مع النظام ({stats.missing})
                                                </h3>
                                                <button
                                                    onClick={() => setShowMissingModal(false)}
                                                    className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                                                >
                                                    <X className="w-5 h-5 text-zinc-500" />
                                                </button>
                                            </div>
                                            <div className="p-4 flex-1 overflow-auto bg-zinc-50/30 dark:bg-black/10">
                                                <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
                                                    <table className="w-full text-right text-sm">
                                                        <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold border-b border-zinc-200 dark:border-zinc-700">
                                                            <tr>
                                                                <th className="p-3 w-12 text-center">#</th>
                                                                <th className="p-3">الاسم في الإكسل</th>
                                                                <th className="p-3">القيمة الجديدة</th>
                                                                <th className="p-3 w-1/2">بيانات الصف بالكامل (مقتطف مع العناوين)</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                                            {matches.filter(m => m.status === 'missing').map((m, idx) => (
                                                                <tr key={idx} className="hover:bg-amber-50/30 dark:hover:bg-amber-900/10 transition-colors">
                                                                    <td className="p-3 text-center font-mono text-zinc-400">{idx + 1}</td>
                                                                    <td className="p-3 font-bold text-amber-700 dark:text-amber-500">
                                                                        {m.excelName || 'بدون اسم'}
                                                                    </td>
                                                                    <td className="p-3 text-blue-600 dark:text-blue-400 font-mono" dir="ltr">
                                                                        {typeof m.newValue === 'object' ? JSON.stringify(m.newValue) : String(m.newValue)}
                                                                    </td>
                                                                    <td className="p-3 text-xs text-zinc-500 font-mono leading-relaxed" dir="ltr">
                                                                        {m.rawRow ?
                                                                            m.rawRow.map((cell: any, i: number) =>
                                                                                cell && headers[i] ? `[${headers[i]}]: ${cell}` : null
                                                                            ).filter(Boolean).join(' | ').substring(0, 150) + (m.rawRow.length > 5 ? '...' : '')
                                                                            : '—'}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    }

                    {/* Step: Done */}
                    {
                        step === 'done' && (
                            <div className="h-full flex flex-col items-center justify-center p-10 animate-in zoom-in duration-300">
                                <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
                                    <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
                                </div>
                                <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">تمت العملية بنجاح!</h2>
                                <p className="text-zinc-500 mb-8">تم تحديث بيانات الموظفين في النظام وفقاً للملف المرفق.</p>
                                <button
                                    onClick={onClose}
                                    className="px-8 py-3 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl font-bold hover:scale-105 transition-transform"
                                >
                                    إغلاق النافذة
                                </button>
                            </div>
                        )
                    }

                    {/* Step: Executing (Loading Overlay) */}
                    {
                        step === 'executing' && (
                            <div className="absolute inset-0 bg-white/80 dark:bg-zinc-900/90 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                                <Loader2 className="w-16 h-16 text-blue-600 animate-spin mb-6" />
                                <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-200">جاري معالجة البيانات...</h3>
                                <p className="text-zinc-500 mt-2">يرجى الانتظار حتى اكتمال العملية</p>
                            </div>
                        )
                    }
                </div >

                {/* Footer Controls */}
                {
                    step !== 'done' && step !== 'executing' && (
                        <div className="flex-none w-full p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex justify-between items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
                            <button
                                onClick={() => {
                                    if (step === 'map') setStep('upload');
                                    if (step === 'preview') setStep('map');
                                }}
                                disabled={step === 'upload'}
                                className="px-6 py-2.5 rounded-lg text-zinc-600 dark:text-zinc-400 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                رجوع
                            </button>

                            {step === 'map' && (
                                <button
                                    onClick={analyzeData}
                                    disabled={mode === 'patch' ? (!keyCol || !valCol || !targetDbField) : (!syncMapping['job_number'] || !syncMapping['full_name'])}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20"
                                >
                                    التالي: معاينة المطابقة <ArrowRight className="w-4 h-4" />
                                </button>
                            )}

                            {step === 'preview' && (
                                <div className="flex items-center gap-4">
                                    {stats.missing > 0 && (
                                        <label className="flex items-center gap-2 cursor-pointer bg-amber-50 dark:bg-amber-900/20 px-4 py-2 rounded-lg border border-amber-200 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={allowMissingSkip}
                                                onChange={(e) => setAllowMissingSkip(e.target.checked)}
                                                className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 focus:ring-offset-0 disabled:opacity-50 cursor-pointer"
                                            />
                                            <span className="text-sm font-bold text-amber-900 dark:text-amber-300">
                                                أؤكد تجاوز الأسماء المفقودة ({stats.missing}) وحقن المُطابَق فقط
                                            </span>
                                        </label>
                                    )}
                                    <button
                                        onClick={executeUpdate}
                                        disabled={(stats.found + stats.new) === 0 || (stats.missing > 0 && !allowMissingSkip)}
                                        className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-500/20"
                                    >
                                        <Save className="w-4 h-4" />
                                        تنفيذ التحديث ({stats.found + stats.new})
                                    </button>
                                </div>
                            )}
                        </div>
                    )
                }
            </div >
        </div >
    );
}
