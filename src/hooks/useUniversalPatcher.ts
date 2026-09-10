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
import { suggestSnapshotName, syncActiveSnapshot, commitMonthlySnapshot, enableGovernorateCard } from '../utils/snapshots';
import {
    TABLE_DEFINITIONS,
    normalizeArabicText,
    cleanFieldValue,
    stripAccountFields,
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
    // 🆕 وضع افتتاح محافظة جديدة: لا مستخدمين → إنشاء الحسابات من عمودي الملف ثم الحقن
    const [govOpening, setGovOpening] = useState(false);

    // 🛡️ مشرف IT (اختياري): يُرفع لصلاحياته بعد نجاح الحقن
    const [itSupervisorId, setItSupervisorId] = useState<string | null>(null);

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

    const autoMapColumns = useCallback((silent = false) => {
        if (!tableDef || headers.length === 0) return;
        const mapping: Record<string, string> = selectedTable === 'profiles' ? { governorate: '__target_gov__' } : {};
        
        // Custom aliases for better mapping accuracy (based on specific user feedback)
        const customAliases: Record<string, string[]> = {
            'certificate_text': ['الشهادة'],
            'tax_status': ['حالة الموظف في الاستقطاع الضريبي', 'حالة الاستقطاع الضريبي'],
            'certificate_percentage': ['ignore_this_field_completely'], // Ignore specifically requested by user
            'full_name': ['ignore_this_field_completely'], // 🛑 User asked to ignore this so it doesn't wrongly map to الراتب الاسمي
            'leaves_balance_expiry_date': ['ignore_this_field_completely'], // 🛑 User asked to ignore this so it doesn't wrongly map to تاريخ الاستحقاق
            'position_allowance': ['مخصصات المنصب'],
            'extra_allowance_50': ['المخصصات الإضافية 50', 'المخصصات الاضافية 50'],
            'children_allowance': ['مخصصات الأطفال', 'مخصصات الاطفال'],
            'gross_salary': ['الراتب الإجمالي (الايرادات)', 'الراتب الاجمالي الايرادات', 'الراتب الإجمالي'],
            'loan_deduction': ['استقطاع مبلغ القرض', 'استقطاع القرض'],
            'other_deductions': ['طرح مبلغ', 'استقطاعات أخرى', 'استقطاعات اخرى']
        };

        const cleanStr = (s: string) => String(s).replace(/[^\w\u0600-\u06FF]+/g, ' ').trim();

        tableDef.fields.forEach(field => {
            if (field.value === 'governorate') {
                mapping[field.value] = '__target_gov__';
                return;
            }
            if (customAliases[field.value]?.includes('ignore_this_field_completely')) {
                return; // Leave as ignore
            }

            const fieldLabel = cleanStr(field.label);
            const fieldLabelTokens = fieldLabel.split(' ').filter(Boolean);
            const aliases = (customAliases[field.value] || []).map(cleanStr);
            
            let bestIdx = -1;
            let maxScore = 0;
            
            headers.forEach((h, idx) => {
                const headerText = cleanStr(h);
                if (!headerText) return;
                
                // 1. Check Exact Alias Match
                if (aliases.includes(headerText)) {
                    if (maxScore < 200) { bestIdx = idx; maxScore = 200; }
                    return;
                }
                
                // 2. Check Exact Label Match
                if (headerText === fieldLabel) {
                    if (maxScore < 100) { bestIdx = idx; maxScore = 100; }
                    return;
                }
                
                // 3. Check Includes Match
                if (headerText.includes(fieldLabel) || fieldLabel.includes(headerText)) {
                    if (maxScore < 80) { bestIdx = idx; maxScore = 80; }
                    return;
                }
                
                // 4. Partial match of tokens
                let tokensMatched = 0;
                for (const token of fieldLabelTokens) {
                    if (token.length > 2 && headerText.includes(token)) tokensMatched++;
                }
                if (tokensMatched > 0 && fieldLabelTokens.length > 0) {
                    const score = (tokensMatched / fieldLabelTokens.length) * 50;
                    if (score > maxScore) {
                        bestIdx = idx;
                        maxScore = score;
                    }
                }
            });
            
            if (bestIdx !== -1) {
                mapping[field.value] = String(bestIdx);
            }
        });
        
        setColumnMapping(mapping);
        if (!silent) toast.success('تمت محاولة مطابقة الحقول تلقائياً بناءً على الأسماء', { icon: '🤖' });
    }, [tableDef, headers, selectedTable]);

    const goToConfig = useCallback(() => {
        if (!selectedTable) {
            toast.error('يرجى اختيار الجدول المستهدف');
            return;
        }
        if (headers.length === 0) {
            toast.error('لم يتم العثور على أعمدة في الملف');
            return;
        }
        
        // محاولة التطابق التلقائي الأولية بصمت
        autoMapColumns(true);
        setStep('config');
    }, [selectedTable, headers, autoMapColumns]);

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
                .eq('governorate', gov)
                .limit(10000);
            if (error) throw error;

            const profiles = profilesRaw || [];

            // 🧠 ذكاء الافتتاح: لا مستخدمين = افتتاح محافظة جديدة — لا مطابقة،
            // ستُنشأ الحسابات عند التنفيذ من عمودي «اسم المستخدم» و«كلمة المرور» في الملف
            const opening = profiles.length === 0;
            setGovOpening(opening);
            if (opening) {
                toast(`🆕 افتتاح محافظة جديدة (${governorateName(gov)}) — ستُنشأ الحسابات من الملف عند التنفيذ`, { icon: 'ℹ️', duration: 5000 });
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
            } else if (govProfileIds.length > 0) {
                // تقسيم الطلبات لتجنب مشكلة URL Too Long (414)
                const CHUNK_SIZE = 100;
                for (let i = 0; i < govProfileIds.length; i += CHUNK_SIZE) {
                    const chunk = govProfileIds.slice(i, i + CHUNK_SIZE);
                    
                    let query = supabase.from(tableDef.tableName).select('*').in('user_id', chunk);
                    
                    // إضافة تصفية السنة للجداول السنوية والتفصيلية
                    if (tableDef.type === 'yearly' || tableDef.type === 'detail') {
                        query = query.eq('year', targetYear);
                    }
                    
                    const { data, error } = await query;
                    if (error) {
                        console.error(`Error fetching chunk ${i} for ${tableDef.tableName}:`, error);
                    }
                    
                    if (data) {
                        existingRecords.push(...data.map((r: any) => ({ ...r, _userId: r.user_id })));
                    }
                }
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

                // المطابقة (في وضع الافتتاح لا توجد حسابات لمطابقتها)
                let matched: { profileId: string; full_name: string; job_number: string } | undefined;
                if (opening) {
                    matched = undefined;
                } else if (matchBy === 'full_name') {
                    matched = nameMap.get(normalizeArabicText(matchValue));
                } else {
                    matched = jobMap.get(matchValue);
                }

                // بناء القيم الجديدة
                const newValues: Record<string, any> = {};
                for (const [dbField, colIdxStr] of Object.entries(columnMapping)) {
                    if (!colIdxStr) continue;
                    if (colIdxStr === '__target_gov__') {
                        newValues[dbField] = gov;
                        continue;
                    }
                    const colIdx = parseInt(colIdxStr);
                    const rawVal = row[colIdx];
                    newValues[dbField] = cleanFieldValue(rawVal, tableDef.tableName, dbField);
                }

                // ضمان تثبيت المحافظة المستهدفة في الجداول التي تدعمها
                if ((tableDef.tableName === 'profiles' || tableDef.tableName === 'financial_records') && !newValues.governorate) {
                    newValues.governorate = gov;
                }

                const jobNumber = String(newValues.job_number ?? (matchBy === 'job_number' ? matchValue : '')).trim();
                const displayName = String(newValues.full_name ?? (matchBy === 'full_name' ? matchValue : '')).trim();

                if (!matched) {
                    // 🆕 في وضع الافتتاح: كل صف سجل جديد سيُربط بالحساب المنشأ عند التنفيذ
                    results.push({
                        status: opening ? 'new_record' : 'missing',
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
                await syncActiveSnapshot(gov);
            }

            let effectiveMatches = matches;

            // 🆕 افتتاح محافظة جديدة: إنشاء الحسابات من عمودي «اسم المستخدم» و«كلمة المرور» ثم الربط والحقن
            if (govOpening) {
                const seenUsernames = new Set<string>();
                const usersToCreate: { job_number?: string; full_name: string; username: string; password: string }[] = [];
                for (const m of matches) {
                    const username = String(m.newValues.username || '').trim();
                    if (!username || seenUsernames.has(username)) continue;
                    seenUsernames.add(username);
                    usersToCreate.push({
                        username,
                        password: String(m.newValues.password || '').trim() || '123456',
                        job_number: String(m.newValues.job_number ?? m.jobNumber ?? '').trim() || undefined,
                        full_name: m.displayName || m.excelName,
                    });
                }
                if (usersToCreate.length === 0) {
                    toast.error('اربط عمودي «اسم المستخدم» و«كلمة المرور» من الملف في خطوة الربط أولاً');
                    setStep('preview');
                    return;
                }

                let createdAcc = 0, skippedAcc = 0;
                const failedAcc: any[] = [];
                const CHUNK = 100; // مهلة الدالة الجانبية دقيقة واحدة
                for (let i = 0; i < usersToCreate.length; i += CHUNK) {
                    const chunk = usersToCreate.slice(i, i + CHUNK);
                    const { data, error } = await supabase.functions.invoke('bulk-create-users', {
                        body: { users: chunk, governorate: gov },
                    });
                    if (error) throw new Error(error.message);
                    if (data?.error) throw new Error(data.error);
                    createdAcc += data.created || 0;
                    skippedAcc += data.skipped || 0;
                    if (Array.isArray(data.failed)) failedAcc.push(...data.failed);
                }
                toast.success(`🆕 تم إنشاء ${createdAcc} حساباً${skippedAcc ? ` (تجاوز ${skippedAcc} موجودين)` : ''}${failedAcc.length ? ` وفشل ${failedAcc.length}` : ''}`, { duration: 6000 });

                // إعادة جلب ملفات المحافظة وربط الصفوف حسب عمود المطابقة الذي اختاره المطور
                const { data: freshProfiles, error: freshErr } = await supabase
                    .from('profiles')
                    .select('id, username, full_name, job_number')
                    .eq('governorate', gov);
                if (freshErr) throw freshErr;

                const fNameMap = new Map<string, string>();
                const fJobMap = new Map<string, string>();
                for (const p of freshProfiles || []) {
                    if (p.full_name) fNameMap.set(normalizeArabicText(p.full_name), p.id);
                    if (p.job_number) fJobMap.set(String(p.job_number).trim(), p.id);
                }

                effectiveMatches = [];
                let unresolved = 0;
                for (const m of matches) {
                    const key = matchBy === 'job_number'
                        ? String(m.newValues.job_number ?? m.jobNumber ?? '').trim()
                        : normalizeArabicText(m.displayName || m.excelName);
                    const pid = matchBy === 'job_number' ? fJobMap.get(key) : fNameMap.get(key);
                    if (!pid) { unresolved++; continue; }
                    effectiveMatches.push({
                        ...m,
                        profileId: pid,
                        ...(tableDef.tableName === 'profiles' ? { recordId: pid } : {}),
                    });
                }
                if (effectiveMatches.length === 0) {
                    toast.error(`لم يُربط أي صف بالحسابات الجديدة${unresolved ? ` (${unresolved} صفاً بلا مطابقة)` : ''}`, { duration: 8000 });
                    setStep('done');
                    return;
                }
            }

            const tasks = effectiveMatches.filter(m => m.status === 'match' || m.status === 'new_record');
            const CHUNK_SIZE = 50;

            for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
                const chunk = tasks.slice(i, i + CHUNK_SIZE);

                const promises = chunk.map(async (item) => {
                    try {
                        const payload: any = stripAccountFields({ ...item.newValues }, tableDef.tableName);

                        if (tableDef.tableName === 'profiles') {
                            // تحديث profiles مباشرة
                            if (item.recordId) {
                                payload.governorate = gov;
                                if (item.newValues.password) {
                                    const pwd = String(item.newValues.password).trim();
                                    if (pwd) {
                                        payload.password = pwd;
                                        const { data: newHash } = await supabase.rpc('hash_password', { password: pwd });
                                        if (newHash) payload.password_hash = newHash;

                                        const jn = item.newValues.job_number || item.jobNumber;
                                        if (jn) {
                                            await supabase.rpc('rpc_sync_user_auth', {
                                                p_user_id: item.recordId,
                                                p_email: `${String(jn).trim()}@inftele.com`,
                                                p_password: pwd
                                            });
                                        }
                                    }
                                }

                                const { error } = await supabase
                                    .from('profiles')
                                    .update({ ...payload, updated_at: new Date().toISOString() })
                                    .eq('id', item.recordId);
                                if (error) throw error;
                            }
                        } else if (item.status === 'match' && item.recordId) {
                            // تحديث سجل موجود
                            if (tableDef.tableName === 'financial_records') {
                                payload.governorate = gov;
                            }
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
                            if (tableDef.tableName === 'financial_records') {
                                insertPayload.governorate = gov;
                            }
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
                // 🛡️ تفعيل بطاقة المحافظة تلقائياً بعد أول حقن ناجح (يعمل لجميع المحافظات)
                try {
                    await enableGovernorateCard(gov);
                } catch (cardErr) {
                    console.warn('تعذر تفعيل بطاقة المحافظة عبر RPC:', cardErr);
                    try {
                        await supabase
                            .from('governorate_cards')
                            .upsert({ id: gov, is_active: true, activated_at: new Date().toISOString() });
                    } catch (directErr) {
                        console.error('فشل التحديث المباشر لبطاقة المحافظة:', directErr);
                    }
                }

                // 🛡️ رفع صلاحيات مشرف IT المحدد (اختياري — قبل إتمام العملية)
                if (itSupervisorId) {
                    try {
                        const { error: supErr } = await supabase
                            .from('profiles')
                            .update({ role: 'admin', admin_role: 'it_supervisor', governorate: gov })
                            .eq('id', itSupervisorId);
                        if (supErr) throw supErr;
                        toast.success('تم رفع صلاحيات مشرف IT المحدد بنجاح', { duration: 5000 });
                    } catch (supErr: any) {
                        console.error(supErr);
                        toast.error('تعذر رفع صلاحيات مشرف IT: ' + (supErr.message || ''), { duration: 8000 });
                    }
                }

                // 📅 التزام النسخة الجديدة المسماة للجداول المُدارة
                if (isSnapshotManaged) {
                    try {
                        await commitMonthlySnapshot(trimmedSnapshotName, 'excel', null, gov);
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
    }, [tableDef, matches, targetYear, snapshotName, govOpening, matchBy, gov, itSupervisorId]);

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
        setItSupervisorId(null);
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
        govOpening,
        itSupervisorId, setItSupervisorId,

        // Actions
        handleFileSelect,
        goToConfig,
        analyzeData,
        executeUpdate,
        reset,
        autoMapColumns,
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