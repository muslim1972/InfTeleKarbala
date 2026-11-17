import React, { useState, useEffect } from 'react';
import { 
    UploadCloud, 
    FileSpreadsheet, 
    CheckCircle2, 
    Loader2, 
    Trash2, 
    Users, 
    FileText, 
    RefreshCw,
    XCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Button } from '../ui/Button';

interface IncentivesCommitteesUploaderProps {
    year: number;
    month: number;
    theme: 'light' | 'dark';
    onCommitteesUpdated?: () => void;
}

interface ParsedCommitteeRow {
    jobNumber: string;
    employeeName: string;
    profileId?: string;
    matched: boolean;
    committees: {
        order: number;
        name: string;
        orderNumber: string;
        orderDate: string;
    }[];
}

interface ExistingCommitteeRecord {
    id: string;
    user_id: string;
    job_number: string;
    committee_order: number;
    committee_name: string;
    order_number: string;
    order_date: string;
    profile?: {
        full_name: string;
        job_number: string;
    };
}

export const IncentivesCommitteesUploader: React.FC<IncentivesCommitteesUploaderProps> = ({
    year,
    month,
    theme,
    onCommitteesUpdated
}) => {
    const [fileName, setFileName] = useState<string>('');
    const [parsing, setParsing] = useState<boolean>(false);
    const [parsedRows, setParsedRows] = useState<ParsedCommitteeRow[]>([]);
    const [existingRecords, setExistingRecords] = useState<ExistingCommitteeRecord[]>([]);
    const [loadingExisting, setLoadingExisting] = useState<boolean>(false);
    const [uploading, setUploading] = useState<boolean>(false);
    const [deleting, setDeleting] = useState<boolean>(false);

    // جلب اللجان المسجلة حالياً للشهر والسنة المحددين
    const fetchExistingRecords = async () => {
        setLoadingExisting(true);
        try {
            const { data, error } = await supabase
                .from('monthly_incentive_committees')
                .select(`
                    id,
                    user_id,
                    job_number,
                    committee_order,
                    committee_name,
                    order_number,
                    order_date,
                    profiles:user_id (
                        full_name,
                        job_number
                    )
                `)
                .eq('year', year)
                .eq('month', month)
                .order('job_number', { ascending: true })
                .order('committee_order', { ascending: true });

            if (error) {
                console.error('Error fetching monthly committees:', error);
                setExistingRecords([]);
            } else if (data) {
                // Formatting data
                const formatted = data.map((item: any) => ({
                    id: item.id,
                    user_id: item.user_id,
                    job_number: item.job_number,
                    committee_order: item.committee_order,
                    committee_name: item.committee_name,
                    order_number: item.order_number,
                    order_date: item.order_date,
                    profile: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
                }));
                setExistingRecords(formatted);
            }
        } catch (err) {
            console.error('Error fetching existing records:', err);
            setExistingRecords([]);
        } finally {
            setLoadingExisting(false);
        }
    };

    useEffect(() => {
        fetchExistingRecords();
        setParsedRows([]);
        setFileName('');
    }, [year, month]);

    // قراءة ملف Excel وتحليله بمرونة عالية
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setParsing(true);

        try {
            const buffer = await file.arrayBuffer();
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);

            const worksheet = workbook.worksheets[0];
            if (!worksheet) {
                toast.error('لم يتم العثور على أوراق عمل داخل الملف');
                setParsing(false);
                return;
            }

            // قراءة الرؤوس والصفوف
            const rawRows: any[][] = [];
            worksheet.eachRow((row) => {
                const rowValues: any[] = [];
                row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    let val = cell.value;
                    if (val && typeof val === 'object') {
                        if ('result' in val) val = (val as any).result;
                        else if ('text' in val) val = (val as any).text;
                    }
                    rowValues[colNumber - 1] = val !== undefined && val !== null ? String(val).trim() : '';
                });
                rawRows.push(rowValues);
            });

            if (rawRows.length < 2) {
                toast.error('الملف فارغ أو لا يحتوي على صفوف بيانات كافية');
                setParsing(false);
                return;
            }

            // فحص صف العناوين (Headers)
            const headers = rawRows[0].map(h => String(h || '').trim());
            
            // تحديد فهارس الأعمدة بذكاء
            const findCol = (terms: string[]) => 
                headers.findIndex(h => terms.some(t => h.toLowerCase().includes(t.toLowerCase())));

            const jobCol = findCol(['رقم وظيفي', 'الرقم الوظيفي', 'الرقم', 'job_number', 'job number']);
            const nameCol = findCol(['اسم الموظف', 'الاسم الكامل', 'الاسم', 'الموظف', 'name', 'full_name']);

            if (jobCol === -1 && nameCol === -1) {
                toast.error('لم يتم العثور على عمود الرقم الوظيفي أو اسم الموظف في الملف');
                setParsing(false);
                return;
            }

            // جلب ملفات الموظفين لمطابقة user_id
            const { data: profiles, error: profError } = await supabase
                .from('profiles')
                .select('id, full_name, job_number');

            if (profError || !profiles) {
                toast.error('فشل جلب سجلات الموظفين للمطابقة');
                setParsing(false);
                return;
            }

            const profileByJob = new Map<string, any>();
            const profileByName = new Map<string, any>();

            profiles.forEach(p => {
                if (p.job_number) profileByJob.set(String(p.job_number).trim(), p);
                if (p.full_name) profileByName.set(String(p.full_name).trim().replace(/\s+/g, ' '), p);
            });

            // فحص هل الملف أفقي (اللجنة 1، اللجنة 2، اللجنة 3) أو عمودي
            const comm1Name = findCol(['اسم اللجنة 1', 'اللجنة 1', 'اللجنة الاولى', 'اللجنة الأولى']);
            const comm2Name = findCol(['اسم اللجنة 2', 'اللجنة 2', 'اللجنة الثانية']);
            const comm3Name = findCol(['اسم اللجنة 3', 'اللجنة 3', 'اللجنة الثالثة']);

            const isHorizontal = comm1Name !== -1 || comm2Name !== -1 || comm3Name !== -1;

            const parsedData: ParsedCommitteeRow[] = [];

            if (isHorizontal) {
                // معالجة النمط الأفقي
                const comm1Order = findCol(['رقم الامر 1', 'رقم الأمر 1', 'امر 1', 'أمر 1']);
                const comm1Date = findCol(['تاريخ الامر 1', 'تاريخ الأمر 1', 'تاريخ 1']);

                const comm2Order = findCol(['رقم الامر 2', 'رقم الأمر 2', 'امر 2', 'أمر 2']);
                const comm2Date = findCol(['تاريخ الامر 2', 'تاريخ الأمر 2', 'تاريخ 2']);

                const comm3Order = findCol(['رقم الامر 3', 'رقم الأمر 3', 'امر 3', 'أمر 3']);
                const comm3Date = findCol(['تاريخ الامر 3', 'تاريخ الأمر 3', 'تاريخ 3']);

                for (let i = 1; i < rawRows.length; i++) {
                    const r = rawRows[i];
                    const job = jobCol !== -1 ? String(r[jobCol] || '').trim() : '';
                    const name = nameCol !== -1 ? String(r[nameCol] || '').trim().replace(/\s+/g, ' ') : '';

                    if (!job && !name) continue;

                    const matchedProfile = (job && profileByJob.get(job)) || (name && profileByName.get(name));

                    const committees: ParsedCommitteeRow['committees'] = [];

                    // لجنة 1
                    const c1 = comm1Name !== -1 ? String(r[comm1Name] || '').trim() : '';
                    if (c1) {
                        committees.push({
                            order: 1,
                            name: c1,
                            orderNumber: comm1Order !== -1 ? String(r[comm1Order] || '').trim() : '',
                            orderDate: comm1Date !== -1 ? String(r[comm1Date] || '').trim() : ''
                        });
                    }

                    // لجنة 2
                    const c2 = comm2Name !== -1 ? String(r[comm2Name] || '').trim() : '';
                    if (c2 && committees.length < 3) {
                        committees.push({
                            order: committees.length + 1,
                            name: c2,
                            orderNumber: comm2Order !== -1 ? String(r[comm2Order] || '').trim() : '',
                            orderDate: comm2Date !== -1 ? String(r[comm2Date] || '').trim() : ''
                        });
                    }

                    // لجنة 3
                    const c3 = comm3Name !== -1 ? String(r[comm3Name] || '').trim() : '';
                    if (c3 && committees.length < 3) {
                        committees.push({
                            order: committees.length + 1,
                            name: c3,
                            orderNumber: comm3Order !== -1 ? String(r[comm3Order] || '').trim() : '',
                            orderDate: comm3Date !== -1 ? String(r[comm3Date] || '').trim() : ''
                        });
                    }

                    if (committees.length > 0) {
                        parsedData.push({
                            jobNumber: job || matchedProfile?.job_number || '',
                            employeeName: name || matchedProfile?.full_name || '',
                            profileId: matchedProfile?.id,
                            matched: !!matchedProfile,
                            committees
                        });
                    }
                }
            } else {
                // معالجة النمط العمودي التراكمي (سطر لكل لجنة)
                const singleCommName = findCol(['اسم اللجنة', 'اللجنة', 'عنوان اللجنة', 'committee_name']);
                const singleCommOrder = findCol(['رقم الامر', 'رقم الأمر', 'الأمر', 'الامر', 'order_number']);
                const singleCommDate = findCol(['تاريخ الامر', 'تاريخ الأمر', 'تاريخ', 'order_date']);

                const employeeMap = new Map<string, ParsedCommitteeRow>();

                for (let i = 1; i < rawRows.length; i++) {
                    const r = rawRows[i];
                    const job = jobCol !== -1 ? String(r[jobCol] || '').trim() : '';
                    const name = nameCol !== -1 ? String(r[nameCol] || '').trim().replace(/\s+/g, ' ') : '';
                    const cName = singleCommName !== -1 ? String(r[singleCommName] || '').trim() : '';

                    if ((!job && !name) || !cName) continue;

                    const key = job || name;
                    let existing = employeeMap.get(key);

                    if (!existing) {
                        const matchedProfile = (job && profileByJob.get(job)) || (name && profileByName.get(name));
                        existing = {
                            jobNumber: job || matchedProfile?.job_number || '',
                            employeeName: name || matchedProfile?.full_name || '',
                            profileId: matchedProfile?.id,
                            matched: !!matchedProfile,
                            committees: []
                        };
                        employeeMap.set(key, existing);
                    }

                    if (existing.committees.length < 3) {
                        existing.committees.push({
                            order: existing.committees.length + 1,
                            name: cName,
                            orderNumber: singleCommOrder !== -1 ? String(r[singleCommOrder] || '').trim() : '',
                            orderDate: singleCommDate !== -1 ? String(r[singleCommDate] || '').trim() : ''
                        });
                    }
                }

                parsedData.push(...Array.from(employeeMap.values()));
            }

            setParsedRows(parsedData);
            toast.success(`تمت قراءة الملف بنجاح: ${parsedData.length} موظفاً مستوفياً للشروط`);
        } catch (err: any) {
            console.error('Error parsing excel:', err);
            toast.error('حدث خطأ أثناء معالجة ملف الإكسل: ' + err.message);
        } finally {
            setParsing(false);
        }
    };

    // حقن اللجان في قاعدة البيانات
    const handleCommitToDatabase = async () => {
        if (parsedRows.length === 0) {
            toast.error('لا توجد بيانات جاهزة للحقن');
            return;
        }

        const matchedRows = parsedRows.filter(r => r.matched && r.profileId);
        if (matchedRows.length === 0) {
            toast.error('لا يوجد أي موظف مطابق في النظام للحقن');
            return;
        }

        const confirmInject = window.confirm(
            `هل أنت متأكد من حقن لجان الحوافز لشهر (${month} / ${year})؟\nسيتم تسجيل لجان ${matchedRows.length} موظفاً واستبدال السجلات السابقة لنفس هذا الشهر.`
        );
        if (!confirmInject) return;

        setUploading(true);

        try {
            // 1. حذف لجان الشهر المحدد للموظفين المطابقين
            const userIds = matchedRows.map(r => r.profileId!);
            
            await supabase
                .from('monthly_incentive_committees')
                .delete()
                .eq('year', year)
                .eq('month', month)
                .in('user_id', userIds);

            // 2. إعداد مصفوفة السجلات للحقن
            const recordsToInsert: any[] = [];
            for (const row of matchedRows) {
                row.committees.slice(0, 3).forEach((comm, idx) => {
                    recordsToInsert.push({
                        user_id: row.profileId,
                        job_number: row.jobNumber,
                        year,
                        month,
                        committee_order: idx + 1,
                        committee_name: comm.name,
                        order_number: comm.orderNumber || null,
                        order_date: comm.orderDate || null
                    });
                });
            }

            if (recordsToInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from('monthly_incentive_committees')
                    .insert(recordsToInsert);

                if (insertError) throw insertError;
            }

            // 3. تحديث عدد اللجان ونقاطها تلقائياً في سجلات الحوافز (incentive_records) إن وجدت
            for (const row of matchedRows) {
                const count = Math.min(3, row.committees.length);
                const points = count * 5; // 5 نقاط لكل لجنة

                // محاولة تحديث السجل إن كان موجوداً
                await supabase
                    .from('incentive_records')
                    .update({
                        committees_count: count,
                        committees_points: points,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', row.profileId)
                    .eq('year', year)
                    .eq('month', month);
            }

            toast.success(`تم حقن ${recordsToInsert.length} لجنة بنجاح لشهر ${month} / ${year}`);
            setParsedRows([]);
            setFileName('');
            await fetchExistingRecords();
            if (onCommitteesUpdated) onCommitteesUpdated();
        } catch (err: any) {
            console.error('Error injecting committees:', err);
            toast.error('فشل حقن البيانات: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    // حذف كافة لجان الشهر المحدد
    const handleClearMonthCommittees = async () => {
        if (existingRecords.length === 0) return;

        const confirmDelete = window.confirm(
            `تحذير: هل أنت متأكد من حذف كافة اللجان المعتمدة المسجلة لشهر (${month} / ${year})؟ (${existingRecords.length} سجل)`
        );
        if (!confirmDelete) return;

        setDeleting(true);
        try {
            const { error } = await supabase
                .from('monthly_incentive_committees')
                .delete()
                .eq('year', year)
                .eq('month', month);

            if (error) throw error;

            toast.success(`تم حذف لجان شهر ${month} / ${year} بنجاح`);
            await fetchExistingRecords();
            if (onCommitteesUpdated) onCommitteesUpdated();
        } catch (err: any) {
            console.error('Error clearing month committees:', err);
            toast.error('فشل الحذف: ' + err.message);
        } finally {
            setDeleting(false);
        }
    };

    const matchedCount = parsedRows.filter(r => r.matched).length;
    const unmatchedCount = parsedRows.filter(r => !r.matched).length;
    const totalCommittees = parsedRows.reduce((acc, r) => acc + (r.matched ? r.committees.length : 0), 0);

    return (
        <div className="space-y-1.5 sm:space-y-2">
            {/* بطاقة رفع ملف Excel */}
            <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border backdrop-blur-md shadow-sm transition-all ${
                theme === 'light' ? 'bg-white/80 border-slate-200' : 'bg-slate-900/60 border-slate-800'
            }`}>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            <UploadCloud className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">
                                رفع ملف اللجان المعتمدة للحوافز (شهر {month} / {year})
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                حقن اللجان المؤثرة في الحافز المالي (بحد أقصى 3 لجان لكل موظف)
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchExistingRecords}
                            disabled={loadingExisting}
                            className="gap-1.5 text-xs font-bold"
                            title="تحديث القائمة"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loadingExisting ? 'animate-spin' : ''}`} />
                            تحديث
                        </Button>
                    </div>
                </div>

                {/* منطقة اختيار الملف بالسحب والإفلات */}
                <div className="relative border-2 border-dashed rounded-2xl p-6 text-center transition-colors border-slate-200 dark:border-slate-700 hover:border-blue-500/50 bg-slate-50/50 dark:bg-slate-950/20">
                    <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={handleFileUpload}
                        disabled={parsing || uploading}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                        <FileSpreadsheet className="w-10 h-10 text-blue-500/70" />
                        <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            {fileName ? (
                                <span className="text-blue-600 dark:text-blue-400 font-mono">{fileName}</span>
                            ) : (
                                'انقر لاختيار ملف Excel أو اسحب الملف وأفلته هنا'
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            يدعم صيغ .xlsx و .xls — يمكن رفع نفس اللجنة لأكثر من شهر للموظف
                        </p>
                    </div>
                </div>

                {/* مؤشر جاري القراءة */}
                {parsing && (
                    <div className="mt-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 flex items-center justify-center gap-2 text-xs font-bold animate-pulse">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري قراءة وتحليل ملف الإكسل ومطابقة الموظفين...</span>
                    </div>
                )}

                {/* ملخص المعاينة عند اكتمال قراءة الملف */}
                {parsedRows.length > 0 && (
                    <div className="mt-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* بطاقات الإحصاء السريع */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between">
                                <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                    موظفون مطابقون
                                </div>
                                <span className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-200">
                                    {matchedCount}
                                </span>
                            </div>

                            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex items-center justify-between">
                                <div className="text-xs font-bold text-blue-800 dark:text-blue-300">
                                    إجمالي اللجان الجاهزة
                                </div>
                                <span className="font-mono font-black text-sm text-blue-700 dark:text-blue-200">
                                    {totalCommittees}
                                </span>
                            </div>

                            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center justify-between">
                                <div className="text-xs font-bold text-rose-800 dark:text-rose-300">
                                    غير مطابق (مستبعد)
                                </div>
                                <span className="font-mono font-black text-sm text-rose-700 dark:text-rose-200">
                                    {unmatchedCount}
                                </span>
                            </div>
                        </div>

                        {/* جدول معاينة عينة من السجلات */}
                        <div className="border rounded-xl overflow-hidden text-xs max-h-56 overflow-y-auto">
                            <table className="w-full text-right border-collapse">
                                <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 font-bold">
                                    <tr>
                                        <th className="py-2 px-3">الموظف</th>
                                        <th className="py-2 px-3">الرقم الوظيفي</th>
                                        <th className="py-2 px-3">اللجان المستخرجة (الحد الأقصى 3)</th>
                                        <th className="py-2 px-3 text-center">المطابقة</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {parsedRows.slice(0, 15).map((row, idx) => (
                                        <tr key={idx} className={row.matched ? '' : 'bg-rose-50/40 dark:bg-rose-950/20'}>
                                            <td className="py-2 px-3 font-semibold">{row.employeeName || '—'}</td>
                                            <td className="py-2 px-3 font-mono">{row.jobNumber || '—'}</td>
                                            <td className="py-2 px-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {row.committees.map((c, ci) => (
                                                        <span key={ci} className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200/60 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded text-[10px]">
                                                            {c.order}. {c.name} {c.orderNumber ? `(${c.orderNumber})` : ''}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                                {row.matched ? (
                                                    <span className="text-emerald-600 font-bold flex items-center justify-center gap-1">
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        مطابق
                                                    </span>
                                                ) : (
                                                    <span className="text-rose-500 font-bold flex items-center justify-center gap-1">
                                                        <XCircle className="w-3.5 h-3.5" />
                                                        غير مسجل
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* زر الحقن والاعتماد */}
                        <div className="flex justify-end pt-2">
                            <Button
                                onClick={handleCommitToDatabase}
                                disabled={uploading || matchedCount === 0}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-emerald-500/20 gap-2 text-sm"
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>جاري الحقن وتحديث الحوافز...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>اعتماد وحقن لجان الحوافز ({totalCommittees} لجنة)</span>
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* بطاقة عرض اللجان المحقونة حالياً في قاعدة البيانات لهذا الشهر */}
            <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border backdrop-blur-md shadow-sm ${
                theme === 'light' ? 'bg-white/80 border-slate-200' : 'bg-slate-900/60 border-slate-800'
            }`}>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-500" />
                        <h4 className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100">
                            اللجان المعتمدة المسجلة في النظام لشهر ({month} / {year})
                        </h4>
                        <span className="text-xs bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold px-2 py-0.5 rounded-full font-mono">
                            {existingRecords.length} لجنة
                        </span>
                    </div>

                    {existingRecords.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleClearMonthCommittees}
                            disabled={deleting}
                            className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1.5 text-xs font-bold"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            {deleting ? 'جاري الحذف...' : 'تفريغ لجان هذا الشهر'}
                        </Button>
                    )}
                </div>

                {loadingExisting ? (
                    <div className="py-12 flex justify-center items-center gap-2 text-muted-foreground text-sm">
                        <Loader2 className="w-5 h-5 animate-spin text-brand-green" />
                        <span>جاري جلب اللجان المسجلة...</span>
                    </div>
                ) : existingRecords.length > 0 ? (
                    <div className="border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                        <table className="w-full text-right border-collapse text-xs">
                            <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 font-bold">
                                <tr>
                                    <th className="py-2.5 px-3">#</th>
                                    <th className="py-2.5 px-3">الموظف</th>
                                    <th className="py-2.5 px-3">الرقم الوظيفي</th>
                                    <th className="py-2.5 px-3">اسم اللجنة</th>
                                    <th className="py-2.5 px-3 text-center">رقم الأمر</th>
                                    <th className="py-2.5 px-3 text-center">تاريخ الأمر</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {existingRecords.map((item, index) => (
                                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="py-2.5 px-3 font-mono font-bold text-slate-400">
                                            {index + 1}
                                        </td>
                                        <td className="py-2.5 px-3 font-semibold">
                                            {item.profile?.full_name || '—'}
                                        </td>
                                        <td className="py-2.5 px-3 font-mono">
                                            {item.job_number || item.profile?.job_number || '—'}
                                        </td>
                                        <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                                            <span className="inline-block bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] ml-1 font-mono font-bold text-slate-500">
                                                لجنة {item.committee_order}
                                            </span>
                                            {item.committee_name}
                                        </td>
                                        <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                                            {item.order_number || '—'}
                                        </td>
                                        <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                                            {item.order_date || '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="py-12 text-center text-muted-foreground text-xs space-y-1">
                        <FileText className="w-8 h-8 mx-auto opacity-30 mb-2" />
                        <p className="font-semibold">لا توجد لجان معتمدة مسجلة لشهر {month} / {year}</p>
                        <p className="text-[11px] text-muted-foreground/70">
                            يمكنك رفع ملف Excel في الأعلى لحقن لجان هذا الشهر مباشرة.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
