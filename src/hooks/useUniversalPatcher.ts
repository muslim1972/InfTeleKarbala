/**
 * هوك المحدث العام للبيانات
 * Universal Patcher Hook
 * 
 * يدير تدفق: رفع Excel → اختيار جدول → ربط أعمدة → معاينة → تنفيذ
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
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
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
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
    const [targetYear, setTargetYear] = useState(new Date().getFullYear());

    // ربط الأعمدة: { dbField: excelColumnIndex }
    const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

    // عمود المطابقة من Excel (الاسم/الرقم الوظيفي)
    const [matchColumn, setMatchColumn] = useState('');
    const [matchBy, setMatchBy] = useState<'full_name' | 'job_number'>('full_name');

    // المطابقات والنتائج
    const [matches, setMatches] = useState<MatchResult[]>([]);
    const [allowMissingSkip, setAllowMissingSkip] = useState(false);
    const [previewFilter, setPreviewFilter] = useState<'all' | 'match' | 'new_record' | 'missing'>('all');

    // ─── File Upload Handler ────────────────────

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const buffer = evt.target?.result;
                const wb = XLSX.read(buffer, { type: 'array' });
                setWorkbook(wb);
                setSheetNames(wb.SheetNames);
                setSelectedSheet(wb.SheetNames[0]);
                setHeaderRowIndex(0);
            } catch {
                toast.error('حدث خطأ أثناء قراءة الملف');
            }
        };
        reader.readAsArrayBuffer(file);
    }, []);

    // ─── Parse sheet when selection changes ─────

    useEffect(() => {
        if (!workbook || !selectedSheet) return;

        try {
            const ws = workbook.Sheets[selectedSheet];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

            if (!data || data.length === 0) {
                setHeaders([]);
                setRows([]);
                return;
            }

            const safeIdx = Math.max(0, Math.min(headerRowIndex, data.length - 1));
            const hdrs = (data[safeIdx] || []).map((h: any) => String(h || '').trim());

            setHeaders(hdrs);
            setRows(data.slice(safeIdx + 1).filter(r => r.length > 0 && r.some(cell => cell)));

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

            // 1. جلب الملفات الشخصية
            const { data: profilesRaw, error } = await supabase
                .from('profiles')
                .select('id, username, full_name, job_number');
            if (error) throw error;

            const profiles = profilesRaw || [];

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

            if (tableDef.tableName === 'profiles') {
                existingRecords = profiles.map((p: any) => ({ ...p, _userId: p.id }));
            } else if (tableDef.type === 'single') {
                // financial_records: سجل واحد لكل موظف
                const { data } = await supabase.from(tableDef.tableName).select('*');
                existingRecords = (data || []).map((r: any) => ({ ...r, _userId: r.user_id }));
            } else {
                // yearly / detail: نحتاج السنة
                const { data } = await supabase
                    .from(tableDef.tableName)
                    .select('*')
                    .eq('year', targetYear);
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

                if (!matched) {
                    results.push({
                        status: 'missing',
                        excelName: matchValue,
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
    }, [matchColumn, matchBy, tableDef, columnMapping, rows, targetYear]);

    // ─── Execute Update ─────────────────────────

    const executeUpdate = useCallback(async () => {
        if (!tableDef) return;

        try {
            setStep('executing');
            let successCount = 0;

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
    }, [tableDef, matches, targetYear]);

    // ─── Stats ──────────────────────────────────

    const stats = useMemo(() => ({
        total: matches.length,
        found: matches.filter(m => m.status === 'match').length,
        newRecords: matches.filter(m => m.status === 'new_record').length,
        missing: matches.filter(m => m.status === 'missing').length,
    }), [matches]);

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
        columnMapping, setColumnMapping,
        matchColumn, setMatchColumn,
        matchBy, setMatchBy,
        matches, filteredMatches,
        allowMissingSkip, setAllowMissingSkip,
        previewFilter, setPreviewFilter,
        stats,

        // Actions
        handleFileSelect,
        goToConfig,
        analyzeData,
        executeUpdate,
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
