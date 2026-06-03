import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import ExcelJS from 'exceljs';
import type { CourseType, MCQQuestion, PromotionSettings, PromotionResult } from '../types';

/**
 * Hook مركزي لبيانات دورات الترفيع
 * يتعامل مع Supabase Storage و DB
 */
export function usePromotionData() {
    const [settings, setSettings] = useState<PromotionSettings | null>(null);
    const [settingsLoading, setSettingsLoading] = useState(true);

    // ── جلب إعدادات الاختبار ──
    const fetchSettings = useCallback(async () => {
        setSettingsLoading(true);
        try {
            const { data, error } = await supabase
                .from('promotion_settings')
                .select('*')
                .limit(1)
                .single();
            if (error) throw error;
            setSettings(data);
        } catch (err) {
            console.error('فشل جلب إعدادات الاختبار:', err);
        } finally {
            setSettingsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    // ── تحديث إعدادات الاختبار ──
    const updateSettings = useCallback(async (updates: Partial<PromotionSettings>) => {
        if (!settings) return false;
        try {
            const { error } = await supabase
                .from('promotion_settings')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', settings.id);
            if (error) throw error;
            setSettings(prev => prev ? { ...prev, ...updates } : prev);
            return true;
        } catch (err) {
            console.error('فشل تحديث الإعدادات:', err);
            return false;
        }
    }, [settings]);

    // ── جلب روابط ملفات المناهج متعددة ──
    const getCurriculumFileUrl = useCallback((courseType: CourseType, subject: string, filename: string): string => {
        const path = `curricula/${courseType}/${subject}/${filename}`;
        const { data } = supabase.storage.from('Lectures').getPublicUrl(path);
        return data.publicUrl;
    }, []);

    // ── جلب قائمة الملفات لمادة معينة ──
    const listCurriculaFiles = useCallback(async (courseType: CourseType, subject: string) => {
        const path = `curricula/${courseType}/${subject}`;
        const { data, error } = await supabase.storage.from('Lectures').list(path);
        if (error) {
            console.error('فشل جلب قائمة الملفات:', error);
            return [];
        }
        // استبعاد المجلدات (إن وجدت) والملفات المخفية
        return (data || []).filter(f => f.name !== '.emptyFolderPlaceholder' && f.id);
    }, []);

    // ── فحص وجود ملف في Storage ──
    const checkFileExists = useCallback(async (folder: string, courseType: CourseType, subject: string, ext: string): Promise<boolean> => {
        const path = `${folder}/${courseType}/${subject}.${ext}`;
        try {
            const { data } = supabase.storage.from('Lectures').getPublicUrl(path);
            if (!data?.publicUrl) return false;
            
            // Try HEAD first (fastest and standard)
            const res = await fetch(data.publicUrl, { method: 'HEAD' });
            if (res.status === 200) return true;
            
            // If HEAD returns non-200, try GET with Range header (fallback in case of custom configurations)
            const getRes = await fetch(data.publicUrl, {
                method: 'GET',
                headers: { 'Range': 'bytes=0-0' }
            });
            return getRes.status === 200 || getRes.status === 206;
        } catch (err) {
            console.error('فشل فحص وجود الملف عبر الشبكة:', err);
            // Last fallback: if fetch fails (e.g. CORS preflight issue), try downloading using Supabase client (guaranteed CORS bypass)
            try {
                const { data, error } = await supabase.storage.from('Lectures').download(path);
                if (error) return false;
                return !!data;
            } catch (fallbackErr) {
                console.error("فشل فحص وجود الملف بالكامل:", fallbackErr);
                return false;
            }
        }
    }, []);

    // ── رفع ملف إلى Storage ──
    const uploadFile = useCallback(async (
        folder: 'curricula' | 'exams',
        courseType: CourseType,
        subject: string,
        file: File,
        ext: string
    ): Promise<{ success: boolean; error?: string }> => {
        const path = folder === 'curricula' 
            ? `curricula/${courseType}/${subject}/${file.name}`
            : `${folder}/${courseType}/${subject}.${ext}`;
        try {
            const contentType = ext === 'pdf'
                ? 'application/pdf'
                : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

            console.log('[Promotion Upload] Uploading to:', path, 'Size:', file.size, 'Type:', contentType);

            const { data, error } = await supabase.storage
                .from('Lectures')
                .upload(path, file, {
                    cacheControl: '0',
                    upsert: true,
                    contentType,
                });

            if (error) {
                console.error('[Promotion Upload] Error details:', error);
                return { success: false, error: error.message };
            }

            if (!data) {
                console.error('[Promotion Upload] No data returned');
                return { success: false, error: 'لم يتم استلام تأكيد من الخادم' };
            }

            console.log('[Promotion Upload] Success:', data);
            return { success: true };
        } catch (err: any) {
            const msg = err?.message || 'خطأ غير معروف';
            console.error('[Promotion Upload] Failed:', msg);
            return { success: false, error: msg };
        }
    }, []);

    // ── حذف ملف من Storage ──
    const deleteFile = useCallback(async (
        folder: 'curricula' | 'exams',
        courseType: CourseType,
        subject: string,
        filename?: string,
        ext?: string
    ): Promise<boolean> => {
        const path = folder === 'curricula' && filename
            ? `curricula/${courseType}/${subject}/${filename}`
            : `${folder}/${courseType}/${subject}.${ext}`;
        try {
            const { error } = await supabase.storage.from('Lectures').remove([path]);
            if (error) throw error;
            return true;
        } catch (err) {
            console.error('فشل حذف الملف:', err);
            return false;
        }
    }, []);

    // ── تحميل أسئلة Excel وتحويلها إلى MCQ ──
    const loadExamQuestions = useCallback(async (
        courseType: CourseType,
        subject: string
    ): Promise<MCQQuestion[]> => {
        const path = `exams/${courseType}/${subject}.xlsx`;
        try {
            const { data, error } = await supabase.storage.from('Lectures').download(path);
            if (error) throw error;

            const arrayBuffer = await data.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(arrayBuffer);
            const worksheet = workbook.worksheets[0];
            if (!worksheet) return [];
            
            const rows: string[][] = [];
            worksheet.eachRow((row) => {
                const rowData: string[] = [];
                row.eachCell((cell) => {
                    rowData.push(String(cell.value || ''));
                });
                rows.push(rowData);
            });

            // Filter out empty rows and header if exists
            const validRows = rows.filter(row =>
                row.length >= 5 &&
                row[0] && String(row[0]).trim() !== '' &&
                String(row[0]).trim() !== 'السؤال'
            );

            if (validRows.length === 0) return [];

            const selected = validRows;

            return selected.map(row => {
                const question = String(row[0]).trim();
                const correctAnswer = String(row[1]).trim();
                const options = [
                    String(row[1]).trim(),
                    String(row[2]).trim(),
                    String(row[3]).trim(),
                    String(row[4]).trim(),
                ];

                // Shuffle options randomly
                const shuffledOptions = [...options];
                for (let i = shuffledOptions.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
                }

                return {
                    question,
                    options: shuffledOptions,
                    correctIndex: shuffledOptions.indexOf(correctAnswer),
                };
            });
        } catch (err) {
            console.error('فشل تحميل ملف الأسئلة:', err);
            return [];
        }
    }, []);

    // ── حفظ نتيجة الاختبار ──
    const saveResult = useCallback(async (result: Omit<PromotionResult, 'id' | 'created_at' | 'completed_at'>): Promise<boolean> => {
        try {
            const { error } = await supabase.from('promotion_results').insert({
                ...result,
                completed_at: new Date().toISOString(),
            });
            if (error) {
                console.error('Supabase error:', error);
                alert(`فشل الحفظ في قاعدة البيانات: ${error.message || JSON.stringify(error)}`);
                return false;
            }
            return true;
        } catch (err: any) {
            console.error('فشل حفظ النتيجة:', err);
            alert(`خطأ غير متوقع أثناء الحفظ: ${err.message || 'Unknown error'}`);
            return false;
        }
    }, []);

    // ── جلب نتائج الاختبارات ──
    const fetchResults = useCallback(async (limit: number = 50): Promise<PromotionResult[]> => {
        try {
            const { data, error } = await supabase
                .from('promotion_results')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('فشل جلب النتائج:', err);
            return [];
        }
    }, []);

    // ── فحص ما إذا كان المستخدم قد أجرى الاختبار ──
    const checkUserHasResult = useCallback(async (userId: string, courseType: CourseType, subjectName: string): Promise<boolean> => {
        try {
            const { data, error } = await supabase
                .from('promotion_results')
                .select('id')
                .eq('user_id', userId)
                .eq('course_type', courseType)
                .eq('subject_name', subjectName)
                .limit(1);
            if (error) throw error;
            return data && data.length > 0;
        } catch (err) {
            console.error('فشل فحص وجود نتيجة:', err);
            return false;
        }
    }, []);

    return {
        settings,
        settingsLoading,
        fetchSettings,
        updateSettings,
        getCurriculumFileUrl,
        listCurriculaFiles,
        checkFileExists,
        uploadFile,
        deleteFile,
        loadExamQuestions,
        saveResult,
        fetchResults,
        checkUserHasResult,
    };
}
