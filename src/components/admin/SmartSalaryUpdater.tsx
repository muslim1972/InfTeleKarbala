import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { ArrowRight, CheckCircle2, Upload, DatabaseZap, X, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
interface SmartSalaryUpdaterProps {
    onClose: () => void;
}

type Step = 'upload' | 'analyzing' | 'preview' | 'executing' | 'done';

interface MatchResult {
    status: 'match' | 'new_record';
    recordId?: string; // For updates (financial_records ID)
    profileId?: string; // For existing profiles that need a financial record
    currentName?: string;
    excelName: string;
    differences: Record<string, { old: any; new: any }>;
    payload: any; // The full update/insert object
    isContract?: boolean; // True if job_number is missing in Excel
}

// القاموس المدمج للمطابقة التلقائية
const FIELD_DICTIONARY: Record<string, string> = {
    'اسم المستخدم': 'username',
    'الرمز السري': 'password',
    'الرقم الوظيفي': 'job_number',
    'اسم الموظف': 'full_name',
    'العنوان الوظيفي': 'job_title',
    'الشهادة': 'certificate_text',
    'الدرجة': 'salary_grade',
    'المرحلة': 'salary_stage',
    'حالة الموظف في الاستقطاع الضريبي': 'tax_deduction_status',
    'الراتب الاسمي': 'nominal_salary',
    'مخصصات الشهادة': 'certificate_allowance',
    'مخصصات المنصب': 'position_allowance',
    'مخصصات هندسية': 'engineering_allowance',
    'مخصصات الخطورة': 'risk_allowance',
    'مخصصات القانونية': 'legal_allowance',
    'المخصصات الاضافية 50%': 'additional_50_percent_allowance',
    'مخصصات النقل': 'transport_allowance',
    'مخصصات الزوجية': 'marital_allowance',
    'مخصصات الاطفال': 'children_allowance',
    'الراتب الاجمالي ( الايرادات)': 'gross_salary', // Extra space in excel header sometimes
    'الراتب الاجمالي (الايرادات)': 'gross_salary',
    'استقطاع مبلغ القرض': 'loan_deduction',
    'طرح مبلغ': 'other_deductions', // بناءً على توجيه المستخدم
    'مبلغ التنفيذ': 'execution_deduction',
    ' الضريبة': 'tax_deduction_amount', // Space in excel
    'الضريبة': 'tax_deduction_amount',
    'التقاعد': 'retirement_deduction',
    'الحماية الاجتماعية': 'social_security_deduction',
    'طابع مدرسي': 'school_stamp_deduction',
    'الراتب الصافي': 'net_salary',
    'iban': 'iban',
    'IBAN': 'iban'
    // 'مجموع الاستقطاعات' -> Ignored based on user prompt
};

const NUMERIC_FIELDS = [
    'nominal_salary', 'salary_grade', 'salary_stage',
    'gross_salary', 'net_salary', 'transport_allowance',
    'risk_allowance', 'children_allowance', 'marital_allowance',
    'position_allowance', 'engineering_allowance', 'legal_allowance',
    'additional_50_percent_allowance', 'certificate_allowance',
    'social_security_deduction', 'tax_deduction_amount',
    'loan_deduction', 'execution_deduction', 'retirement_deduction',
    'school_stamp_deduction', 'other_deductions'
];

export function SmartSalaryUpdater({ onClose }: SmartSalaryUpdaterProps) {
    const [step, setStep] = useState<Step>('upload');
    const [fileName, setFileName] = useState('');
    const [matches, setMatches] = useState<MatchResult[]>([]);
    const [stats, setStats] = useState({ total: 0, updates: 0, new: 0, contract: 0 });
    const [filter, setFilter] = useState<'all' | 'updates' | 'new' | 'contract'>('all');

    // UI state
    const fileInputRef = useRef<HTMLInputElement>(null);

    const normalizeText = (text: string) => {
        if (!text) return '';
        return String(text)
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .trim()
            .toLowerCase()
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .replace(/عبد\s+ال/g, 'عبدال')
            .replace(/عبدال/g, 'عبد ال')
            .replace(/\s+/g, ' ');
    };

    const cleanValue = (val: any, field: string) => {
        if (NUMERIC_FIELDS.includes(field)) {
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

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFileName(selectedFile.name);
        setStep('analyzing');

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const buffer = evt.target?.result;
                const wb = XLSX.read(buffer, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]]; // Always assume first sheet
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                if (!data || data.length === 0) {
                    toast.error('الملف فارغ');
                    setStep('upload');
                    return;
                }

                // --- 1. Find Header Row ---
                // Search for a row that has 'اسم الموظف'
                let headerRowIndex = 0;
                let foundHeaders: string[] = [];
                for (let i = 0; i < Math.min(10, data.length); i++) {
                    const rowStr = data[i].join(' ').toLowerCase();
                    if (rowStr.includes('اسم الموظف') || rowStr.includes('الرقم الوظيفي')) {
                        headerRowIndex = i;
                        foundHeaders = data[i].map(h => String(h || '').trim());
                        break;
                    }
                }

                if (foundHeaders.length === 0) {
                    toast.error('لم يتم العثور على أعمدة صحيحة (يجب أن يحتوي على اسم الموظف)');
                    setStep('upload');
                    return;
                }

                // --- 2. Map Columns (Index -> DB Field) ---
                const mappedCols: { idx: number; dbField: string }[] = [];
                foundHeaders.forEach((headerValue, idx) => {
                    // Try exact match first
                    let dbField = FIELD_DICTIONARY[headerValue];

                    // Fallback to fuzzy match logic
                    if (!dbField) {
                        const normalizedHeader = headerValue.replace(/\s+/g, ' ').trim();
                        dbField = FIELD_DICTIONARY[normalizedHeader];
                    }

                    if (dbField) {
                        mappedCols.push({ idx, dbField });
                    }
                });

                if (mappedCols.length === 0) {
                    toast.error('لم نتمكن من مطابقة أي أعمدة مع النظام');
                    setStep('upload');
                    return;
                }

                // Extract data rows
                const rows = data.slice(headerRowIndex + 1).filter(r => r.length > 0 && r.some(cell => cell));

                await analyzeAndBuildDiffs(rows, mappedCols);

            } catch (error) {
                console.error('Error parsing:', error);
                toast.error('حدث خطأ أثناء فحص البيانات: ' + (error as Error).message);
                setStep('upload');
            }
        };
        reader.readAsArrayBuffer(selectedFile);
    };

    const analyzeAndBuildDiffs = async (rows: any[][], mappedCols: { idx: number; dbField: string }[]) => {
        try {
            // 1. Fetch DB Data
            const { data: profilesRaw, error } = await supabase
                .from('profiles')
                .select(`id, username, full_name, job_number, iban, role, admin_role, department_id, financial_records (*)`);

            if (error) throw error;
            const profiles = profilesRaw || [];

            // 2. Build Maps
            const nameToProfile = new Map();
            const jobNumToProfile = new Map();

            profiles.forEach((p: any) => {
                const finRecord = Array.isArray(p.financial_records) ? p.financial_records[0] : p.financial_records;
                const entry = {
                    profileId: p.id,
                    username: p.username,
                    full_name: p.full_name,
                    job_number: p.job_number,
                    financialRecordId: finRecord?.id,
                    currentFinancialData: finRecord || {},
                    profileData: p
                };
                if (p.full_name) nameToProfile.set(normalizeText(p.full_name), entry);
                if (p.job_number) jobNumToProfile.set(String(p.job_number).trim(), entry);
            });

            const results: MatchResult[] = [];

            // 3. Process Rows
            rows.forEach((row) => {
                const rowPayload: any = {};
                let excelName = '';
                let excelJobNumber = '';

                // Build Payload from row
                mappedCols.forEach(({ idx, dbField }) => {
                    const rawVal = row[idx];
                    if (dbField === 'full_name') excelName = String(rawVal || '').trim();
                    if (dbField === 'job_number') excelJobNumber = String(rawVal || '').trim();

                    rowPayload[dbField] = cleanValue(rawVal, dbField);
                });

                if (!excelName) return; // Skip rows without name

                // Default logic for contract (missing job_number)
                let isContract = false;
                if (!rowPayload.job_number || rowPayload.job_number === '0' || rowPayload.job_number === '') {
                    isContract = true;
                    // Auto-assign dummy unique value to prevent duplicate key constraint errors
                    rowPayload.job_number = 'C' + Math.floor(100000 + Math.random() * 900000).toString();
                }

                // Match by ID first, then Name
                let matchedProfile = null;
                if (excelJobNumber && jobNumToProfile.has(excelJobNumber)) {
                    matchedProfile = jobNumToProfile.get(excelJobNumber);
                } else {
                    const normName = normalizeText(excelName);
                    if (nameToProfile.has(normName)) {
                        matchedProfile = nameToProfile.get(normName);
                    }
                }

                if (matchedProfile) {
                    // It's an update. We need to build a diff dictionary.
                    const diffs: Record<string, { old: any; new: any }> = {};
                    let hasChanges = false;

                    // Compare financial fields
                    mappedCols.forEach(({ dbField }) => {
                        // Skip profile fields from financial diff
                        if (['username', 'password', 'full_name', 'job_number', 'iban'].includes(dbField)) return;

                        const newVal = rowPayload[dbField];
                        const oldVal = matchedProfile.currentFinancialData[dbField];

                        // Loose comparison because numbers vs strings
                        if (String(newVal || '') !== String(oldVal || '')) {
                            diffs[dbField] = { old: oldVal, new: newVal };
                            hasChanges = true;
                        }
                    });

                    // Add to results regardless of changes, so we can see what was processed
                    results.push({
                        status: 'match',
                        recordId: matchedProfile.financialRecordId,
                        profileId: matchedProfile.profileId,
                        currentName: matchedProfile.full_name,
                        excelName: excelName,
                        differences: hasChanges ? diffs : {},
                        payload: rowPayload,
                        isContract
                    });
                } else {
                    // It's a new record
                    results.push({
                        status: 'new_record',
                        excelName: excelName,
                        differences: { 'حالة_الموظف': { old: 'غير موجود', new: 'موظف جديد' } },
                        payload: rowPayload,
                        isContract
                    });
                }
            });

            setStats({
                total: results.length,
                updates: results.filter(r => r.status === 'match').length,
                new: results.filter(r => r.status === 'new_record').length,
                contract: results.filter(r => r.isContract).length
            });

            setMatches(results);
            setStep('preview');

        } catch (error) {
            console.error(error);
            toast.error('حدث خطأ أثناء المعالجة: ' + (error as Error).message);
            setStep('upload');
        }
    };

    const executeUpdate = async () => {
        try {
            setStep('executing');
            let successUpdates = 0;
            let successInserts = 0;

            // Limit chunk size because inserts might involve RPC auth requests
            const CHUNK_SIZE = 10;

            for (let i = 0; i < matches.length; i += CHUNK_SIZE) {
                const chunk = matches.slice(i, i + CHUNK_SIZE);

                const promises = chunk.map(async (item) => {
                    const { payload } = item;

                    try {
                        if (item.status === 'match' && item.profileId) {
                            // 1. Update Profile Fields (if provided)
                            const profileUpdates: any = {};
                            if (payload.username !== undefined) profileUpdates.username = payload.username;
                            if (payload.password !== undefined) profileUpdates.password = payload.password;
                            if (payload.iban !== undefined) profileUpdates.iban = payload.iban;
                            if (payload.job_number !== undefined) profileUpdates.job_number = payload.job_number;

                            if (Object.keys(profileUpdates).length > 0) {
                                await supabase.from('profiles').update(profileUpdates).eq('id', item.profileId);
                            }

                            // 2. Update Financial Fields
                            const financialUpdates: any = { updated_at: new Date().toISOString() };
                            Object.keys(payload).forEach(key => {
                                if (!['username', 'password', 'full_name', 'job_number', 'iban'].includes(key)) {
                                    financialUpdates[key] = payload[key];
                                }
                            });

                            if (item.recordId) {
                                await supabase.from('financial_records').update(financialUpdates).eq('id', item.recordId);
                            } else {
                                // Has profile but NO financial record? Insert it!
                                financialUpdates.user_id = item.profileId;
                                await supabase.from('financial_records').insert([financialUpdates]);
                            }

                            successUpdates++;
                            return true;

                        } else if (item.status === 'new_record') {
                            // --- NEW EMPLOYEE CREATION FLOW ---
                            const newUserId = crypto.randomUUID();
                            const jobNumStr = String(payload.job_number || '111111').trim();

                            // 1. Create Identity using Auth Client (requires email)
                            const tempEmail = `${jobNumStr}@inftele.com`;
                            const pass = payload.password || '123456';
                            const username = payload.username || `user_${jobNumStr}`;

                            // Use an RPC to create user directly in Auth DB bypassing limits
                            const { data: createdUserId, error: signUpError } = await supabase.rpc('rpc_create_new_employee', {
                                p_user_id: newUserId,
                                p_email: tempEmail,
                                p_password: pass,
                                p_full_name: payload.full_name || item.excelName,
                                p_job_number: jobNumStr
                            });

                            if (signUpError) {
                                console.warn("Failed to create user auth:", signUpError);
                                throw signUpError;
                            }

                            const finalUserId = createdUserId || newUserId;

                            // 2. Insert Profile
                            const newProfile = {
                                id: finalUserId,
                                username: username,
                                password: pass,
                                full_name: payload.full_name || item.excelName,
                                job_number: jobNumStr,
                                iban: payload.iban || null,
                                role: 'user',
                                admin_role: null // إرساء الصلاحيات العادية فقط
                            };

                            const { error: profError } = await supabase.from('profiles').insert([newProfile]);
                            if (profError) throw profError;

                            // 3. Insert Financial Records
                            const financialInserts: any = {
                                user_id: finalUserId,
                                ...payload
                            };

                            // Remove profile keys from financial row
                            ['username', 'password', 'full_name', 'job_number', 'iban'].forEach(k => delete financialInserts[k]);

                            await supabase.from('financial_records').insert([financialInserts]);

                            successInserts++;
                            return true;
                        }
                    } catch (e) {
                        console.error('Failed to process item:', item.excelName, e);
                        return false;
                    }
                    return false;
                });

                await Promise.all(promises);
            }

            toast.success(`اكتمل! تم تحديث ${successUpdates} وإضافة ${successInserts} سجل.`);
            setStep('done');

        } catch (e) {
            console.error(e);
            toast.error('حدثت مشكلة أثناء المعالجة!');
            setStep('preview');
        }
    };

    const filteredMatches = matches.filter(m => {
        if (filter === 'all') return true;
        if (filter === 'updates') return m.status === 'match';
        if (filter === 'new') return m.status === 'new_record';
        if (filter === 'contract') return m.isContract;
        return true;
    });

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-300 relative">

            {/* Main Modal */}
            <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-[0_20px_50px_rgba(8,_112,_184,_0.1)] w-[98vw] max-w-screen-2xl overflow-hidden border border-blue-100 dark:border-blue-900/30 flex flex-col h-[95vh]">

                {/* Header */}
                <div className="p-5 border-b border-blue-50 dark:border-white/5 bg-gradient-to-r from-blue-50/50 to-white dark:from-zinc-900 dark:to-zinc-950 flex justify-between items-center relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                            <DatabaseZap className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-zinc-900 dark:text-white">المحدث الشهري الذكي</h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">سحب بيانات الإكسل ومطابقتها وتحديث النظام بلمسة واحدة</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors group">
                        <X className="w-5 h-5 text-zinc-400 group-hover:text-red-500 transition-colors" />
                    </button>
                </div>

                {/* Progress Indicators */}
                <div className="flex w-full bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                    <div className={`flex-1 py-3 px-4 text-center text-xs font-bold transition-colors border-l dark:border-zinc-800 ${step === 'upload' ? 'bg-white dark:bg-zinc-950 text-blue-600' : 'text-zinc-400 opacity-50'}`}>1. رفع الملف</div>
                    <div className={`flex-1 py-3 px-4 text-center text-xs font-bold transition-colors border-l dark:border-zinc-800 ${step === 'analyzing' ? 'bg-white dark:bg-zinc-950 text-purple-600' : 'text-zinc-400 opacity-50'}`}>2. المعالجة بذكاء</div>
                    <div className={`flex-1 py-3 px-4 text-center text-xs font-bold transition-colors border-l dark:border-zinc-800 ${step === 'preview' ? 'bg-white dark:bg-zinc-950 text-amber-600' : 'text-zinc-400 opacity-50'}`}>3. مراجعة التغييرات</div>
                    <div className={`flex-1 py-3 px-4 text-center text-xs font-bold transition-colors ${step === 'executing' ? 'bg-white dark:bg-zinc-950 text-green-600' : 'text-zinc-400 opacity-50'}`}>4. التنفيذ والحفظ</div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto bg-zinc-50/30 dark:bg-black/20 p-4 md:p-6 relative">

                    {step === 'upload' && (
                        <div className="h-full flex flex-col items-center justify-center w-full max-w-lg mx-auto animate-in slide-in-from-bottom-4 zoom-in-95 duration-500">
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileSelect}
                            />

                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full aspect-video border-2 border-dashed border-blue-200 dark:border-blue-900/50 rounded-3xl bg-white dark:bg-zinc-900 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all cursor-pointer flex flex-col items-center justify-center group overflow-hidden relative shadow-sm"
                            >
                                <div className="absolute inset-0 bg-blue-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out rounded-3xl"></div>

                                <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-inner">
                                    <Upload className="w-8 h-8 text-blue-500 dark:text-blue-400" />
                                </div>

                                <h3 className="text-xl font-bold text-zinc-800 dark:text-white mb-2">اختر ملف الإكسل الشهري</h3>
                                <p className="text-sm text-zinc-500 font-medium text-center px-10">
                                    (.xlsx, .xls) سيتم قراءة الأعمدة بالعربية ومطابقتها تلقائياً
                                </p>
                            </div>
                        </div>
                    )}

                    {step === 'analyzing' && (
                        <div className="h-full flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in duration-500">
                            <div className="relative">
                                <div className="w-24 h-24 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                                <DatabaseZap className="w-8 h-8 text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">جاري قراءة الملف...</h3>
                                <p className="text-zinc-500">يتم الآن مطابقة {fileName} مع قاعدة البيانات</p>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="animate-in slide-in-from-right-8 duration-500 space-y-6">

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
                                <div
                                    onClick={() => setFilter('all')}
                                    className={`cursor-pointer transition-all bg-white dark:bg-zinc-900 p-4 rounded-2xl border flex items-center justify-between shadow-sm relative ${filter === 'all' ? 'border-zinc-500 ring-2 ring-zinc-500/20' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 hover:shadow-md'} `}>
                                    <div>
                                        <p className="text-xs font-bold text-zinc-500 mb-1">الكل (الكل في الملف)</p>
                                        <p className="text-3xl font-black text-zinc-900 dark:text-white">{stats.total}</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center"><DatabaseZap className="w-6 h-6 text-zinc-500" /></div>
                                </div>

                                <div
                                    onClick={() => setFilter('updates')}
                                    className={`cursor-pointer transition-all bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-2xl border flex items-center justify-between relative ${filter === 'updates' ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-blue-100 dark:border-blue-900/30 hover:border-blue-300 hover:shadow-md'} `}>
                                    <div>
                                        <p className="text-xs font-bold text-blue-600/70 dark:text-blue-400 mb-1">تحديث بيانات</p>
                                        <p className="text-3xl font-black text-blue-700 dark:text-blue-300">{stats.updates}</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center"><ArrowRight className="w-6 h-6 text-blue-600" /></div>
                                </div>

                                <div
                                    onClick={() => setFilter('new')}
                                    className={`cursor-pointer transition-all bg-amber-50/50 dark:bg-amber-950/20 p-4 rounded-2xl border flex items-center justify-center gap-4 relative overflow-hidden ${filter === 'new' ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-amber-100 dark:border-amber-900/30 hover:border-amber-300 hover:shadow-md'} `}>
                                    <div className={`absolute right-0 top-0 w-2 h-full ${filter === 'new' ? 'bg-amber-500' : 'bg-amber-400/50'}`}></div>
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-amber-700 mb-1">أسماء جديدة (إضافة)</p>
                                        <p className="text-3xl font-black text-amber-600">{stats.new}</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 flex items-center justify-center font-bold text-sm">جديد</div>
                                </div>

                                <div
                                    onClick={() => setFilter('contract')}
                                    className={`cursor-pointer transition-all bg-purple-50/50 dark:bg-purple-950/20 p-4 rounded-2xl border flex items-center justify-center gap-4 relative overflow-hidden ${filter === 'contract' ? 'border-purple-500 ring-2 ring-purple-500/30' : 'border-purple-100 dark:border-purple-900/30 hover:border-purple-300 hover:shadow-md'} `}>
                                    <div className={`absolute right-0 top-0 w-2 h-full ${filter === 'contract' ? 'bg-purple-500' : 'bg-purple-400/50'}`}></div>
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-purple-700 mb-1">عقود (بدون رقم)</p>
                                        <p className="text-3xl font-black text-purple-600">{stats.contract}</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 flex items-center justify-center font-bold text-sm">عقد</div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col shadow-sm min-h-[60vh]">
                                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 flex justify-between items-center shrink-0">
                                    <h3 className="font-bold text-sm text-zinc-700 dark:text-zinc-300">
                                        مراجعة التغييرات (تصفية:
                                        <span className="text-blue-600 mx-1">
                                            {filter === 'all' ? 'الكل' : filter === 'updates' ? 'التحديثات' : filter === 'new' ? 'الجدد' : 'العقود'}
                                        </span>)
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <span className="flex items-center gap-1 text-[10px] text-zinc-500 bg-white dark:bg-zinc-800 px-2 py-1 rounded border dark:border-zinc-700"><span className="w-2 h-2 rounded-full bg-amber-500"></span> جديد</span>
                                        <span className="flex items-center gap-1 text-[10px] text-zinc-500 bg-white dark:bg-zinc-800 px-2 py-1 rounded border dark:border-zinc-700"><span className="w-2 h-2 rounded-full bg-blue-500"></span> تحديث</span>
                                        <span className="flex items-center gap-1 text-[10px] text-zinc-500 bg-white dark:bg-zinc-800 px-2 py-1 rounded border dark:border-zinc-700"><span className="w-2 h-2 rounded-full bg-purple-500"></span> عقد (بدون رقم)</span>
                                    </div>
                                </div>
                                <div className="overflow-auto flex-1 p-0">
                                    <table className="w-full text-right text-sm">
                                        <thead className="bg-zinc-50 dark:bg-black/40 text-xs text-zinc-500 dark:text-zinc-400 sticky top-0 z-10 shadow-sm border-b dark:border-zinc-800">
                                            <tr>
                                                <th className="py-3 px-4 font-bold">الحالة</th>
                                                <th className="py-3 px-4 font-bold">الاسم (الإكسل)</th>
                                                <th className="py-3 px-4 font-bold">الرقم الوظيفي</th>
                                                <th className="py-3 px-4 font-bold">الراتب الاسمي</th>
                                                <th className="py-3 px-4 font-bold w-1/3">أبرز التغييرات المكتشفة</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                            {filteredMatches.slice(0, 500).map((m, i) => (
                                                <tr key={i} className={`hover:bg-zinc-50/50 dark:hover:bg-white/5 transition-colors ${m.status === 'new_record' ? 'bg-amber-50/20 dark:bg-amber-900/10' : ''}`}>
                                                    <td className="py-2.5 px-4 font-bold">
                                                        {m.status === 'new_record' ? (
                                                            <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full inline-block">جديد</span>
                                                        ) : (
                                                            <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full inline-block">تحديث</span>
                                                        )}
                                                        {m.isContract && (
                                                            <span className="ml-1 text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 rounded-full inline-block">عقد</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-4 font-bold whitespace-nowrap text-zinc-900 dark:text-white">{m.excelName}</td>
                                                    <td className="py-2.5 px-4 text-zinc-500 font-mono text-xs">{m.payload?.job_number || 'N/A'}</td>
                                                    <td className="py-2.5 px-4 text-zinc-500 font-mono text-xs">{Number(m.payload?.nominal_salary || 0).toLocaleString()}</td>
                                                    <td className="py-2.5 px-4">
                                                        <div className="flex flex-wrap gap-1.5 items-center">
                                                            {Object.keys(m.differences).length > 0 ? (
                                                                Object.keys(m.differences).slice(0, 2).map(key => (
                                                                    <span key={key} className="text-[10px] bg-zinc-100 dark:bg-zinc-800 border dark:border-zinc-700 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-300 flex items-center gap-1">
                                                                        {key}: <span className="text-red-500 line-through mx-1">{m.differences[key].old || 0}</span>
                                                                        <ArrowRight className="w-2 h-2 text-zinc-400 rotate-180" />
                                                                        <span className="text-green-600 dark:text-green-400 font-bold">{m.differences[key].new || 0}</span>
                                                                    </span>
                                                                ))
                                                            ) : (
                                                                <span className="text-[10px] text-zinc-400">لا يوجد تغيير جوهري مالي</span>
                                                            )}
                                                            {Object.keys(m.differences).length > 2 && (
                                                                <span className="text-[10px] text-zinc-400">+{Object.keys(m.differences).length - 2} تغييرات أخرى</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredMatches.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="py-10 text-center text-zinc-500 bg-zinc-50 dark:bg-zinc-900 font-bold border-t border-dashed dark:border-zinc-800">
                                                        لا يوجد نتائج تناسب هذه التصفية
                                                    </td>
                                                </tr>
                                            )}
                                            {filteredMatches.length > 500 && (
                                                <tr>
                                                    <td colSpan={5} className="py-4 text-center text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-900 font-bold border-t border-dashed dark:border-zinc-800">
                                                        + {filteredMatches.length - 500} قيد إضافي مخفي لمعاينة أسرع (سيتم إدراجهم جميعاً)
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'executing' && (
                        <div className="h-full flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in duration-500">
                            <div className="relative">
                                <div className="w-24 h-24 border-4 border-green-100 border-t-green-600 rounded-full animate-spin"></div>
                                <Save className="w-8 h-8 text-green-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">جاري حفظ البيانات...</h3>
                                <p className="text-zinc-500 text-sm">يتم الآن تحديث قاعدة البيانات، الرجاء عدم إغلاق النافذة</p>
                                <div className="mt-4 px-4 py-2 bg-green-50/50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-xs font-bold font-mono">
                                    {stats.total} TOTAL OPERATIONS
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'done' && (
                        <div className="h-full flex flex-col items-center justify-center space-y-6 animate-in slide-in-from-bottom-5 fade-in duration-500">
                            <div className="w-24 h-24 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center text-green-600 relative overflow-hidden">
                                <span className="absolute inset-0 bg-green-400/20 animate-ping rounded-full"></span>
                                <CheckCircle2 className="w-12 h-12 relative z-10" />
                            </div>
                            <div className="text-center max-w-sm">
                                <h3 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">نجاح باهر! 🎉</h3>
                                <p className="text-zinc-500 leading-relaxed mb-6">
                                    تم تحديث قاعدة البيانات بنجاح من إكسل شهر الرواتب وتم إنجاز المهمة بالشكل المطلوب.
                                </p>
                                <button
                                    onClick={onClose}
                                    className="w-full bg-zinc-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 dark:text-black text-white py-3 rounded-xl font-bold transition-all"
                                >
                                    إغلاق النافذة والمتابعة
                                </button>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer fixed */}
                {step === 'preview' && (
                    <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex justify-between items-center shrink-0">
                        <p className="text-xs text-zinc-500 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            المراجعة النهائية، انقر تأكيد المزامنة للتنفيذ على مسؤوليتك.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 rounded-xl font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={executeUpdate}
                                className="px-8 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 flex items-center gap-2 transition-all active:scale-95"
                            >
                                <DatabaseZap className="w-4 h-4" />
                                تأكيد المزامنة وحفظ في النظام
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
