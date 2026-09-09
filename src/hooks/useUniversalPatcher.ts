/**
 * هوك المحدث العام للبيانات
 * Universal Patcher Hook
 * 
 * يدير تدفق: رفع Excel → اختيار جدول → ربط أعمدة → معاينة → تنفيذ
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import type ExcelJS from 'exceljs';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { governorateName } from '../constants/governorates';
import { suggestSnapshotName, syncActiveSnapshot, commitMonthlySnapshot } from '../utils/snapshots';
import {
    TABLE_DEFINITIONS,
    normalizeArabicText,
    cleanFieldValue,
} from '../utils/universalPatcherConfig';

// ─── Types ──────────────────────────────────────

export type PatcherStep = 'upload' | 'config' | 'preview' | 'executing' | 'done';

export interface MatchResult {
    status: 'match' | 'new_record' | 'missing';
    /** ID السجل الموجود (للتحديث) */
    recordId?: string;
    /** ID المستخدم */
    profileId?: string;
    /** الاسم في DB */
    currentName?: string;
    /** الاسم في Excel */
    excelName: string;
    /** الرقم الوظيفي المستخرج من Excel (لإنشاء الحسابات) */
    jobNumber?: string;
    /** الاسم المعروض من Excel */
    displayName?: string;
    /** القيم الجديدة */
    newValues: Record<string, any>;
    /** القيم القديمة */
    oldValues?: Record<string, any>;
    /** الفروقات المكتشفة */
    diffs: Record<string, { old: any; new: any }>;
}

// ─── Hook ───────────────────────────────────────

export function useUniversalPatcher() {
    // خطوة العمل
    const [step, setStep] = useState<PatcherStep>('upload');

    // Excel state
    const [workbook, setWorkbook] = useState<ExcelJS.Workbook | null>(null);
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState('');
    const [headerRowIndex, setHeaderRowIndex] = useState(0);
    const [headers, setHeaders] = useState<string[]>([]);
    const [rows, setRows] = useState<any[][]>([]);
    const [fileName, setFileName] = useState('');

    // الجدول المستهدف
    const [selectedTable, setSelectedTable] = useState<string>('');
    const tableDef = useMemo(
        () => TABLE_DEFINITIONS.find(t => t.tableName === selectedTable) ?? null,
        [selectedTable]
    );

    // سنة التشغيل (للجداول السنوية/التفصيلية)
    const [targetYear, setTargetYear] = useState(() => new Date().getFullYear());

    // ربط الأعمدة: { dbField: excelColumnIndex }
    const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

    // عمود المطابقة من Excel (الاسم/الرقم الوظيفي)
    const [matchColumn, setMatchColumn] = useState('');
    const [matchBy, setMatchBy] = useState<'full_name' | 'job_number'>('full_name');

    // المطابقات والنتائج
    const [matches, setMatches] = useState<MatchResult[]>([]);
    const [allowMissingSkip, setAllowMissingSkip] = useState(false);
    const [previewFilter, setPreviewFilter] = useState<'all' | 'match' | 'new_record' | 'missing'>('all');

    // 🗺️ المحافظة المستهدفة — تُحدد تبعية كل المطابقات والحقن
    const [gov, setGovState] = useState(() => sessionStorage.getItem('selectedGovernorate') || 'karbala');
    const setGov = useCallback((g: string) => {
        setGovState(g);
        sessionStorage.setItem('selectedGovernorate', g);
    }, []);
    const [noProfilesGov, setNoProfilesGov] = useState<string | null>(null);
    const [creatingAccounts, setCreatingAccounts] = useState(false);

    // ─── File Upload Handler ────────────────────

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const ExcelJS = (await import('exceljs')).default;
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.load(arrayBuffer);
            
            setWorkbook(wb);
            const names = wb.worksheets.map(ws => ws.name);
            setSheetNames(names);
            setSelectedSheet(names[0] || '');
            setHeaderRowIndex(0);
        } catch {
            toast.error('حدث خطأ أثناء قراءة الملف');
        }
    }, []);

    // ─── Parse sheet when selection changes ─────

    useEffect(() => {
        if (!workbook || !selectedSheet) return;

        try {
            const worksheet = workbook.getWorksheet(selectedSheet);
            if (!worksheet) {
                setHeaders([]);
                setRows([]);
                return;
            }

            const allRows: any[][] = [];
            worksheet.eachRow((row) => {
                const rowData: any[] = [];
                row.eachCell((cell) => {
                    rowData.push(cell.value);
                });
                allRows.push(rowData);
            });

            if (!allRows || allRows.length === 0) {
                setHeaders([]);
                setRows([]);
                return;
            }

            const safeIdx = Math.max(0, Math.min(headerRowIndex, allRows.length - 1));
            const hdrs = (allRows[safeIdx] || []).map((h: any) => String(h || '').trim());

            setHeaders(hdrs);
            setRows(allRows.slice(safeIdx + 1).filter(r => r.length > 0 && r.some(cell => cell)));

            // محاولة اكتشاف عمود الاسم تلقائياً
            const nameIdx = hdrs.findIndex((c: string) =>
                c.includes('اسم') || c.toLowerCase().includes('name')
            );
            if (nameIdx !== -1) setMatchColumn(String(nameIdx));

        } catch {
            toast.error('حدث خطأ أثناء معالجة الورقة');
        }
    }, [workbook, selectedSheet, headerRowIndex]);

    // ─── Proceed to Config ──────────────────────

    const goToConfig = useCallback(() => {
        if (!selectedTable) {
            toast.error('يرجى اختيار الجدول المستهدف');
            return;
        }
        if (headers.length === 0) {
            toast.error('لم يتم العثور على أعمدة في الملف');
            return;
        }
        setColumnMapping({});
        setStep('config');
    }, [selectedTable, headers]);

    // ─── Analyze & Match Data ───────────────────

    const analyzeData = useCallback(async () => {
        if (!matchColumn || !tableDef) {
            toast.error('يرجى إكمال إعدادات الربط');
            return;
        }

        // التحقق من وجود عمود واحد مربوط على الأقل
        const mappedFields = Object.entries(columnMapping).filter(([, v]) => v !== '');
        if (mappedFields.length === 0) {
            toast.error('يرجى ربط عمود واحد على الأقل');
            return;
        }

        try {
            setStep('executing');
            setAllowMissingSkip(false);

            // 1. جلب ملفات محافظة الهدف فقط
            const { data: profilesRaw, error } = await supabase
                .from('profiles')
                .select('id, username, full_name, job_number')
                .eq('governorate', gov);
            if (error) throw error;

            const profiles = profilesRaw || [];

            // 🧠 ذكاء التجاوز: محافظة بلا مستخدمين لا تُوقف المعالجة
            if (profiles.length === 0) {
                setNoProfilesGov(governorateName(gov));
                toast(`لم نجد أي مستخدمين لـ ${governorateName(gov)} — أنشئ الحسابات من الشريط البرتقالي`, { icon: '⚠️', duration: 5000 });
            } else {
                setNoProfilesGov(null);
            }

            // 2. بناء خرائط المطابقة
            const nameMap = new Map<string, { profileId: string; full_name: string; job_number: string }>();
            const jobMap = new Map<string, { profileId: string; full_name: string; job_number: string }>();

            for (const p of profiles) {
                const entry = { profileId: p.id, full_name: p.full_name || '', job_number: p.job_number || '' };
                if (p.full_name) nameMap.set(normalizeArabicText(p.full_name), entry);
                if (p.job_number) jobMap.set(String(p.job_number).trim(), entry);
            }

            // 3. جلب السجلات الحالية (إن وجدت)
            let existingRecords: any[] = [];

            const govProfileIds = profiles.map((p: any) => p.id);

            if (tableDef.tableName === 'profiles') {
                existingRecords = profiles.map((p: any) => ({ ...p, _userId: p.id }));
            } else if (govProfileIds.length === 0) {
                existingRecords = [];
            } else if (tableDef.type === 'single') {
                // financial_records: سجل واحد لكل موظف
                const { data } = await supabase.from(tableDef.tableName).select('*').in('user_id', govProfileIds);
                existingRecords = (data || []).map((r: any) => ({ ...r, _userId: r.user_id }));
            } else {
                // yearly / detail: نحتاج السنة
                const { data } = await supabase
                    .from(tableDef.tableName)
                    .select('*')
                    .eq('year', targetYear)
                    .in('user_id', govProfileIds);
                existingRecords = (data || []).map((r: any) => ({ ...r, _userId: r.user_id }));
            }

            // بناء خريطة السجلات الحالية (user_id → record(s))
            const recordsByUserId = new Map<string, any[]>();
            for (const rec of existingRecords) {
                const uid = rec._userId || rec.id;
                if (!recordsByUserId.has(uid)) recordsByUserId.set(uid, []);
                recordsByUserId.get(uid)!.push(rec);
            }

            // 4. معالجة صفوف Excel
            const results: MatchResult[] = [];
            const matchColIdx = parseInt(matchColumn);

            for (const row of rows) {
                const matchValue = String(row[matchColIdx] || '').trim();
                if (!matchValue) continue;

                // المطابقة
                let matched: { profileId: string; full_name: string; job_number: string } | undefined;
                if (matchBy === 'full_name') {
                    matched = nameMap.get(normalizeArabicText(matchValue));
                } else {
                    matched = jobMap.get(matchValue);
                }

                // بناء القيم الجديدة
                const newValues: Record<string, any> = {};
                for (const [dbField, colIdxStr] of Object.entries(columnMapping)) {
                    if (!colIdxStr) continue;
                    const colIdx = parseInt(colIdxStr);
                    const rawVal = row[colIdx];
                    newValues[dbField] = cleanFieldValue(rawVal, tableDef.tableName, dbField);
                }

                const jobNumber = String(newValues.job_number ?? (matchBy === 'job_number' ? matchValue : '')).trim();
                const displayName = String(newValues.full_name ?? (matchBy === 'full_name' ? matchValue : '')).trim();

                if (!matched) {
                    results.push({
                        status: 'missing',
                        excelName: matchValue,
                        jobNumber: jobNumber || undefined,
                        displayName: displayName || undefined,
                        newValues,
                        diffs: {},
                    });
                    continue;
                }

                const userRecords = recordsByUserId.get(matched.profileId) || [];

                if (tableDef.tableName === 'profiles') {
                    // تحديث الملف الشخصي مباشرة
                    const existing = userRecords[0] || {};
                    const diffs = buildDiffs(newValues, existing);

                    results.push({
                        status: 'match',
                        recordId: matched.profileId,
                        profileId: matched.profileId,
                        currentName: matched.full_name,
                        excelName: matchValue,
                        newValues,
                        oldValues: existing,
                        diffs,
                    });
                } else if (tableDef.type === 'single') {
                    // financial_records
                    if (userRecords.length > 0) {
                        const existing = userRecords[0];
                        const diffs = buildDiffs(newValues, existing);
                        results.push({
                            status: 'match',
                            recordId: existing.id,
                            profileId: matched.profileId,
                            currentName: matched.full_name,
                            excelName: matchValue,
                            newValues,
                            oldValues: existing,
                            diffs,
                        });
                    } else {
                        results.push({
                            status: 'new_record',
                            profileId: matched.profileId,
                            currentName: matched.full_name,
                            excelName: matchValue,
                            newValues,
                            diffs: {},
                        });
                    }
                } else if (tableDef.type === 'yearly') {
                    // yearly_records: سجل واحد لكل سنة
                    if (userRecords.length > 0) {
                        const existing = userRecords[0];
                        const diffs = buildDiffs(newValues, existing);
                        results.push({
                            status: 'match',
                            recordId: existing.id,
                            profileId: matched.profileId,
                            currentName: matched.full_name,
                            excelName: matchValue,
                            newValues,
                            oldValues: existing,
                            diffs,
                        });
                    } else {
                        results.push({
                            status: 'new_record',
                            profileId: matched.profileId,
                            currentName: matched.full_name,
                            excelName: matchValue,
                            newValues,
                            diffs: {},
                        });
                    }
                } else {
                    // detail tables: دائماً إضافة (insert)
                    results.push({
                        status: 'new_record',
                        profileId: matched.profileId,
                        currentName: matched.full_name,
                        excelName: matchValue,
                        newValues,
                        diffs: {},
                    });
                }
            }

            setMatches(results);
            setStep('preview');

        } catch (err) {
            console.error('Error analyzing data:', err);
            toast.error('حدث خطأ أثناء فحص البيانات');
            setStep('config');
        }
    }, [matchColumn, matchBy, tableDef, columnMapping, rows, targetYear, gov]);

    // ─── Execute Update ─────────────────────────

    // 📅 اسم النسخة الشهرية (إلزامي للجداول المُدارة: financial_records / profiles)
    const [snapshotName, setSnapshotName] = useState(() => suggestSnapshotName());

    const executeUpdate = useCallback(async () => {
        if (!tableDef) return;

        const isSnapshotManaged = tableDef.tableName === 'financial_records' || tableDef.tableName === 'profiles';
        const trimmedSnapshotName = snapshotName.trim();
        if (isSnapshotManaged && trimmedSnapshotName.length < 2) {
            toast.error('يرجى إدخال اسم للنسخة الشهرية قبل التنفيذ');
            return;
        }

        try {
            setStep('executing');
            let successCount = 0;

            // 📅 حماية التعديلات اليدوية: مزامنة النسخة المعروضة قبل الحقن
            if (isSnapshotManaged) {
                await syncActiveSnapshot();
            }

            const tasks = matches.filter(m => m.status === 'match' || m.status === 'new_record');
            const CHUNK_SIZE = 50;

            for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
                const chunk = tasks.slice(i, i + CHUNK_SIZE);

                const promises = chunk.map(async (item) => {
                    try {
                        const payload: any = { ...item.newValues };

                        if (tableDef.tableName === 'profiles') {
                            // تحديث profiles مباشرة
                            if (item.recordId) {
                                const { error } = await supabase
                                    .from('profiles')
                                    .update({ ...payload, updated_at: new Date().toISOString() })
                                    .eq('id', item.recordId);
                                if (error) throw error;
                            }
                        } else if (item.status === 'match' && item.recordId) {
                            // تحديث سجل موجود
                            const { error } = await supabase
                                .from(tableDef.tableName)
                                .update({ ...payload, updated_at: new Date().toISOString() })
                                .eq('id', item.recordId);
                            if (error) throw error;
                        } else if (item.status === 'new_record' && item.profileId) {
                            // إضافة سجل جديد
                            const insertPayload: any = {
                                ...payload,
                                user_id: item.profileId,
                            };
                            // إضافة السنة للجداول السنوية/التفصيلية
                            if (tableDef.type === 'yearly' || tableDef.type === 'detail') {
                                insertPayload.year = targetYear;
                            }
                            const { error } = await supabase
                                .from(tableDef.tableName)
                                .insert([insertPayload]);
                            if (error) throw error;
                        }
                        return true;
                    } catch (err) {
                        console.error('Failed to process:', item.excelName, err);
                        return false;
                    }
                });

                const results = await Promise.all(promises);
                successCount += results.filter(Boolean).length;
            }

            if (successCount > 0) {
                // 📅 التزام النسخة الجديدة المسماة للجداول المُدارة
                if (isSnapshotManaged) {
                    try {
                        await commitMonthlySnapshot(trimmedSnapshotName, 'excel', null);
                        toast.success(`تم إنشاء نسخة «${trimmedSnapshotName}» واعتمادها`, { duration: 6000 });
                    } catch (commitErr: any) {
                        console.error(commitErr);
                        toast.error('تم تحديث البيانات لكن فشل اعتماد النسخة: ' + (commitErr.message || ''), { duration: 8000 });
                    }
                }
                toast.success(`تم معالجة ${successCount} سجل بنجاح في ${tableDef.label}`);
                setStep('done');
            } else {
                toast.error('لم يتم معالجة أي سجل');
                setStep('preview');
            }
        } catch (err) {
            console.error(err);
            toast.error('حدث خطأ غير متوقع');
            setStep('preview');
        }
    }, [tableDef, matches, targetYear, snapshotName]);

    // ─── Stats ──────────────────────────────────

    const stats = useMemo(() => ({
        total: matches.length,
        found: matches.filter(m => m.status === 'match').length,
        newRecords: matches.filter(m => m.status === 'new_record').length,
        missing: matches.filter(m => m.status === 'missing').length,
    }), [matches]);

    // 👥 الصفوف بلا حسابات في المحافظة — مرشحة للإنشاء التلقائي
    const rowsNeedingAccounts = useMemo(() => {
        const seen = new Set<string>();
        const list: { job_number: string; full_name: string }[] = [];
        matches.forEach(m => {
            if (m.status !== 'missing' || !m.jobNumber || seen.has(m.jobNumber)) return;
            seen.add(m.jobNumber);
            list.push({ job_number: m.jobNumber, full_name: m.displayName || m.excelName });
        });
        return list;
    }, [matches]);

    const handleCreateAccounts = useCallback(async () => {
        if (rowsNeedingAccounts.length === 0) return;
        setCreatingAccounts(true);
        try {
            let created = 0, skipped = 0;
            const failed: any[] = [];
            const CHUNK = 100; // مهلة الدالة الجانبية دقيقة واحدة
            for (let i = 0; i < rowsNeedingAccounts.length; i += CHUNK) {
                const chunk = rowsNeedingAccounts.slice(i, i + CHUNK);
                const { data, error } = await supabase.functions.invoke('bulk-create-users', {
                    body: { users: chunk, governorate: gov, password: '123456' },
                });
                if (error) throw new Error(error.message);
                if (data?.error) throw new Error(data.error);
                created += data.created || 0;
                skipped += data.skipped || 0;
                if (Array.isArray(data.failed)) failed.push(...data.failed);
            }
            toast.success(`تم إنشاء ${created} حساباً بكلمة مرور 123456${skipped ? ` (تجاوز ${skipped} موجودين)` : ''}${failed.length ? ` وفشل ${failed.length}` : ''}`, { duration: 6000 });
            await analyzeData(); // إعادة التحليل لربط الصفوف بالحسابات الجديدة
        } catch (e: any) {
            toast.error('فشل إنشاء الحسابات: ' + (e.message || ''), { duration: 8000 });
        } finally {
            setCreatingAccounts(false);
        }
    }, [rowsNeedingAccounts, gov, analyzeData]);

    const filteredMatches = useMemo(() => {
        if (previewFilter === 'all') return matches;
        return matches.filter(m => m.status === previewFilter);
    }, [matches, previewFilter]);

    // ─── Reset ──────────────────────────────────

    const reset = useCallback(() => {
        setStep('upload');
        setWorkbook(null);
        setSheetNames([]);
        setSelectedSheet('');
        setHeaders([]);
        setRows([]);
        setFileName('');
        setSelectedTable('');
        setColumnMapping({});
        setMatchColumn('');
        setMatches([]);
    }, []);

    return {
        // State
        step, setStep,
        workbook, fileName, sheetNames, selectedSheet, setSelectedSheet,
        headerRowIndex, setHeaderRowIndex,
        headers, rows,
        selectedTable, setSelectedTable, tableDef,
        targetYear, setTargetYear,
        snapshotName, setSnapshotName,
        columnMapping, setColumnMapping,
        matchColumn, setMatchColumn,
        matchBy, setMatchBy,
        matches, filteredMatches,
        allowMissingSkip, setAllowMissingSkip,
        previewFilter, setPreviewFilter,
        stats,
        gov, setGov,
        noProfilesGov, creatingAccounts, rowsNeedingAccounts,

        // Actions
        handleFileSelect,
        goToConfig,
        analyzeData,
        executeUpdate,
        handleCreateAccounts,
        reset,
    };
}

export type UseUniversalPatcherReturn = ReturnType<typeof useUniversalPatcher>;

// ─── Utilities ──────────────────────────────────

function buildDiffs(
    newValues: Record<string, any>,
    existing: Record<string, any>
): Record<string, { old: any; new: any }> {
    const diffs: Record<string, { old: any; new: any }> = {};
    for (const [key, newVal] of Object.entries(newValues)) {
        const oldVal = existing[key];
        if (String(newVal ?? '') !== String(oldVal ?? '')) {
            diffs[key] = { old: oldVal, new: newVal };
        }
    }
    return diffs;
}