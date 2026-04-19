import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import * as XLSX from 'xlsx';
import type { CourseType, SubjectKey, MCQQuestion, PromotionSettings, PromotionResult } from '../types';

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

    // ── جلب رابط ملف PDF من Storage ──
    const getCurriculumUrl = useCallback((courseType: CourseType, subject: SubjectKey): string => {
        const path = `curricula/${courseType}/${subject}.pdf`;
        const { data } = supabase.storage.from('Lectures').getPublicUrl(path);
        return data.publicUrl;
    }, []);

    // ── فحص وجود ملف في Storage ──
    const checkFileExists = useCallback(async (folder: string, courseType: CourseType, subject: SubjectKey, ext: string): Promise<boolean> => {
        const path = `${folder}/${courseType}`;
        try {
            const { data, error } = await supabase.storage.from('Lectures').list(path);
            if (error) return false;
            return (data || []).some(f => f.name === `${subject}.${ext}`);
        } catch {
            return false;
        }
    }, []);

    // ── رفع ملف إلى Storage ──
    const uploadFile = useCallback(async (
        folder: 'curricula' | 'exams',
        courseType: CourseType,
        subject: SubjectKey,
        file: File,
        ext: string
    ): Promise<boolean> => {
        const path = `${folder}/${courseType}/${subject}.${ext}`;
        try {
            // Delete existing file first (upsert)
            await supabase.storage.from('Lectures').remove([path]);
            const { error } = await supabase.storage.from('Lectures').upload(path, file, {
                cacheControl: '0',
                upsert: true,
            });
            if (error) throw error;
            return true;
        } catch (err) {
            console.error('فشل رفع الملف:', err);
            return false;
        }
    }, []);

    // ── تحميل أسئلة Excel وتحويلها إلى MCQ ──
    const loadExamQuestions = useCallback(async (
        courseType: CourseType,
        subject: SubjectKey,
        count: number = 10
    ): Promise<MCQQuestion[]> => {
        const path = `exams/${courseType}/${subject}.xlsx`;
        try {
            const { data, error } = await supabase.storage.from('Lectures').download(path);
            if (error) throw error;

            const arrayBuffer = await data.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            // Filter out empty rows and header if exists
            const validRows = rows.filter(row =>
                row.length >= 5 &&
                row[0] && String(row[0]).trim() !== '' &&
                String(row[0]).trim() !== 'السؤال'
            );

            if (validRows.length === 0) return [];

            // Fisher-Yates shuffle for selecting random questions
            const shuffled = [...validRows];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }

            const selected = shuffled.slice(0, Math.min(count, shuffled.length));

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
            if (error) throw error;
            return true;
        } catch (err) {
            console.error('فشل حفظ النتيجة:', err);
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

    return {
        settings,
        settingsLoading,
        fetchSettings,
        updateSettings,
        getCurriculumUrl,
        checkFileExists,
        uploadFile,
        loadExamQuestions,
        saveResult,
        fetchResults,
    };
}
