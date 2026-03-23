import { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import {
    normalizeText,
    cleanValue,
    dbFields
} from '../utils/dataPatcherUtils';
import type { PatcherStep, PatcherMode, MatchResult } from '../utils/dataPatcherUtils';

export function useDataPatcher() {
    const [step, setStep] = useState<PatcherStep>('upload');
    const [mode, setMode] = useState<PatcherMode>('patch');
    const [headers, setHeaders] = useState<string[]>([]);
    const [rows, setRows] = useState<any[][]>([]);
    const [fileName, setFileName] = useState('');

    const [keyCol, setKeyCol] = useState<string>('');
    const [valCol, setValCol] = useState<string>('');
    const [targetDbField, setTargetDbField] = useState<string>('');

    const [syncMapping, setSyncMapping] = useState<Record<string, string>>({});
    const [matchBy, setMatchBy] = useState<'full_name' | 'username'>('full_name');

    const [showMissingModal, setShowMissingModal] = useState(false);
    const [allowMissingSkip, setAllowMissingSkip] = useState(false);
    const [matches, setMatches] = useState<MatchResult[]>([]);

    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<string>('');
    const [headerRowIndex, setHeaderRowIndex] = useState<number>(0);

    const [manualSearchQuery, setManualSearchQuery] = useState('');
    const [manualSearchResults, setManualSearchResults] = useState<any[]>([]);
    const [selectedManualProfile, setSelectedManualProfile] = useState<any>(null);
    const [manualFormData, setManualFormData] = useState<any>({});
    const [isSearching, setIsSearching] = useState(false);

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
                setSelectedSheet(wb.SheetNames[0]);
                setHeaderRowIndex(0);

            } catch (error) {
                console.error('Error parsing Excel:', error);
                toast.error('حدث خطأ أثناء قراءة الملف');
            }
        };
        reader.readAsArrayBuffer(selectedFile);
    };

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

            const safeIndex = Math.max(0, Math.min(headerRowIndex, data.length - 1));
            const foundHeaders = data[safeIndex] || [];

            setHeaders(foundHeaders.map(h => String(h || '').trim()));
            setRows(data.slice(safeIndex + 1));

            setKeyCol('');
            setValCol('');

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

    const analyzeData = async () => {
        if (mode === 'patch' && (!keyCol || !valCol || !targetDbField)) {
            toast.error('يرجى إكمال جميع خيارات الربط');
            return;
        }

        if (mode === 'sync') {
            if (!syncMapping['full_name']) {
                toast.error('يرجى ربط عمود الاسم الكامل (Full Name) على الأقل');
                return;
            }
        }

        try {
            setStep('executing');
            setAllowMissingSkip(false);

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
            const profileMap = new Map();
            
            profiles.forEach((p: any) => {
                const finRecord = Array.isArray(p.financial_records) ? p.financial_records[0] : p.financial_records;

                const entry = {
                    profileId: p.id,
                    username: p.username,
                    full_name: p.full_name,
                    job_number: p.job_number,
                    financialRecordId: finRecord?.id,
                    currentFinancialData: finRecord || {}
                };

                if (p.full_name) profileMap.set(normalizeText(p.full_name), entry);
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
                    const rawVal = row[valIdx];
                    newValue = cleanValue(rawVal, targetDbField);
                } else {
                    const nameIdx = parseInt(syncMapping['full_name']);
                    excelValueRaw = String(row[nameIdx] || '').trim();

                    const updateObj: any = {};
                    Object.entries(syncMapping).forEach(([dbField, colIdx]) => {
                        if (dbField === 'full_name' || dbField === 'username' || dbField === 'job_number') return;
                        const idx = parseInt(colIdx);
                        if (!isNaN(idx)) {
                            const rawVal = row[idx];
                            updateObj[dbField] = cleanValue(rawVal, dbField);
                        }
                    });
                    newValue = updateObj;
                }

                const excelValueNorm = normalizeText(excelValueRaw);
                if (!excelValueNorm) return;

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

            const tasks = matches.filter(m => m.status === 'match' || m.status === 'new_record');
            const CHUNK_SIZE = 50;

            for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
                const chunk = tasks.slice(i, i + CHUNK_SIZE);

                const promises = chunk.map(async (item) => {
                    let payload: any = { updated_at: new Date().toISOString() };

                    if (mode === 'patch') {
                        payload[targetDbField] = item.newValue;
                    } else {
                        payload = { ...payload, ...item.newValue };
                    }

                    let error: any = null;

                    if (item.status === 'match' && item.recordId) {
                        const res = await supabase
                            .from('financial_records')
                            .update(payload)
                            .eq('id', item.recordId);
                        error = res.error;
                    } else if (item.status === 'new_record' && item.profileId) {
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

            const payload: any = { updated_at: new Date().toISOString() };
            dbFields.forEach(field => {
                const val = manualFormData[field.value];
                payload[field.value] = cleanValue(val, field.value);
            });

            const finRecord = Array.isArray(selectedManualProfile.financial_records) ? selectedManualProfile.financial_records[0] : selectedManualProfile.financial_records;

            if (finRecord?.id) {
                const { error } = await supabase
                    .from('financial_records')
                    .update(payload)
                    .eq('id', finRecord.id);
                if (error) throw error;
            } else {
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
        } catch (error) {
            console.error(error);
            toast.error('حدث خطأ أثناء الحفظ');
            setStep('manual_edit');
        }
    };

    return {
        step, setStep,
        mode, setMode,
        headers, setHeaders,
        rows, setRows,
        fileName, setFileName,
        keyCol, setKeyCol,
        valCol, setValCol,
        targetDbField, setTargetDbField,
        syncMapping, setSyncMapping,
        matchBy, setMatchBy,
        showMissingModal, setShowMissingModal,
        allowMissingSkip, setAllowMissingSkip,
        matches, setMatches,
        workbook, setWorkbook,
        sheetNames, setSheetNames,
        selectedSheet, setSelectedSheet,
        headerRowIndex, setHeaderRowIndex,
        manualSearchQuery, setManualSearchQuery,
        manualSearchResults, setManualSearchResults,
        selectedManualProfile, setSelectedManualProfile,
        manualFormData, setManualFormData,
        isSearching, setIsSearching,
        
        handleFileSelect,
        analyzeData,
        executeUpdate,
        handleManualSearch,
        handleSelectProfile,
        handleManualSave,
        stats
    };
}

export type UseDataPatcherReturn = ReturnType<typeof useDataPatcher>;
