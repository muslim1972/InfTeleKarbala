import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import ExcelJS from 'exceljs';
import type { MCQQuestion, TrainingSettings, TrainingStudent, TrainingResult } from '../types';
import { calculateGrade } from '../types';

/**
 * Hook مركزي لبيانات التدريب الصيفي
 * يتعامل مع Supabase Storage و DB
 */
export function useTrainingData() {
    const [settings, setSettings] = useState<TrainingSettings | null>(null);
    const [settingsLoading, setSettingsLoading] = useState(true);

    // ── جلب إعدادات الاختبار ──
    const fetchSettings = useCallback(async () => {
        setSettingsLoading(true);
        try {
            const { data, error } = await supabase
                .from('summer_training_settings')
                .select('*')
                .limit(1)
                .single();
            if (error) throw error;
            setSettings(data);
        } catch (err) {
            console.error('فشل جلب إعدادات اختبار التدريب:', err);
        } finally {
            setSettingsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    // ── تحديث إعدادات الاختبار ──
    const updateSettings = useCallback(async (updates: Partial<TrainingSettings>) => {
        if (!settings) return false;
        try {
            const { error } = await supabase
                .from('summer_training_settings')
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

    // ── فحص وجود ملف Excel في Storage ──
    const checkFileExists = useCallback(async (folder: string, subject: string, ext: string): Promise<boolean> => {
        const path = `${folder}/training/${subject}.${ext}`;
        try {
            const { data } = supabase.storage.from('Lectures').getPublicUrl(path);
            if (!data?.publicUrl) return false;
            const res = await fetch(data.publicUrl, { method: 'HEAD' });
            if (res.status === 200) return true;
            const getRes = await fetch(data.publicUrl, {
                method: 'GET',
                headers: { 'Range': 'bytes=0-0' }
            });
            return getRes.status === 200 || getRes.status === 206;
        } catch {
            try {
                const { data, error } = await supabase.storage.from('Lectures').download(path);
                if (error) return false;
                return !!data;
            } catch {
                return false;
            }
        }
    }, []);

    // ── رفع ملف إلى Storage ──
    const uploadFile = useCallback(async (
        folder: 'exams',
        subject: string,
        file: File,
        ext: string
    ): Promise<{ success: boolean; error?: string }> => {
        const path = `${folder}/training/${subject}.${ext}`;
        try {
            const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            const { data, error } = await supabase.storage
                .from('Lectures')
                .upload(path, file, {
                    cacheControl: '0',
                    upsert: true,
                    contentType,
                });
            if (error) return { success: false, error: error.message };
            if (!data) return { success: false, error: 'لم يتم استلام تأكيد من الخادم' };
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err?.message || 'خطأ غير معروف' };
        }
    }, []);

    // ── حذف ملف من Storage ──
    const deleteFile = useCallback(async (
        folder: 'exams',
        subject: string,
        ext: string
    ): Promise<boolean> => {
        const path = `${folder}/training/${subject}.${ext}`;
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
    const loadExamQuestions = useCallback(async (subject: string): Promise<MCQQuestion[]> => {
        const path = `exams/training/${subject}.xlsx`;
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

            const validRows = rows.filter(row =>
                row.length >= 5 &&
                row[0] && String(row[0]).trim() !== '' &&
                String(row[0]).trim() !== 'السؤال'
            );

            if (validRows.length === 0) return [];

            return validRows.map(row => {
                const question = String(row[0]).trim();
                const correctAnswer = String(row[1]).trim();
                const options = [
                    String(row[1]).trim(),
                    String(row[2]).trim(),
                    String(row[3]).trim(),
                    String(row[4]).trim(),
                ];

                // Fisher-Yates shuffle
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

    // ── جلب قائمة المتدربين ──
    const fetchStudents = useCallback(async (): Promise<TrainingStudent[]> => {
        try {
            const { data, error } = await supabase
                .from('summer_training_students')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('فشل جلب المتدربين:', err);
            return [];
        }
    }, []);

    // ── إنشاء متدرب جديد ──
    const createStudent = useCallback(async (student: {
        full_name: string;
        username: string;
        password: string;
        institution_type: string;
        institution_name: string;
        department: string;
        start_date: string | null;
        end_date: string | null;
        supervisor_id: string;
    }): Promise<{ success: boolean; error?: string }> => {
        try {
            const { error } = await supabase.rpc('create_training_student', {
                p_full_name: student.full_name,
                p_username: student.username,
                p_password: student.password,
                p_institution_type: student.institution_type,
                p_institution_name: student.institution_name,
                p_department: student.department,
                p_start_date: student.start_date,
                p_end_date: student.end_date,
                p_supervisor_id: student.supervisor_id,
            });
            if (error) throw error;
            return { success: true };
        } catch (err: any) {
            console.error('فشل إنشاء متدرب:', err);
            return { success: false, error: err?.message || 'خطأ غير معروف' };
        }
    }, []);

    // ── حذف متدرب ──
    const deleteStudent = useCallback(async (studentId: string): Promise<boolean> => {
        try {
            const { error } = await supabase
                .from('summer_training_students')
                .delete()
                .eq('id', studentId);
            if (error) throw error;
            return true;
        } catch (err) {
            console.error('فشل حذف المتدرب:', err);
            return false;
        }
    }, []);

    // ── حفظ نتيجة الاختبار (مع حذف النتيجة السابقة) ──
    const saveTrainingResult = useCallback(async (result: Omit<TrainingResult, 'id' | 'created_at' | 'completed_at'>): Promise<boolean> => {
        try {
            // حذف النتيجة السابقة إن وجدت
            await supabase
                .from('summer_training_results')
                .delete()
                .eq('student_id', result.student_id);

            // حفظ النتيجة الجديدة
            const { error } = await supabase.from('summer_training_results').insert({
                ...result,
                completed_at: new Date().toISOString(),
            });
            if (error) throw error;

            // تحديث التقدير في جدول المتدربين
            const percentage = Math.round((result.score / result.total_questions) * 100);
            const grade = calculateGrade(percentage);
            await supabase
                .from('summer_training_students')
                .update({ exam_grade: grade })
                .eq('id', result.student_id);

            return true;
        } catch (err: any) {
            console.error('فشل حفظ النتيجة:', err);
            return false;
        }
    }, []);

    // ── جلب نتائج الاختبارات ──
    const fetchResults = useCallback(async (): Promise<TrainingResult[]> => {
        try {
            const { data, error } = await supabase
                .from('summer_training_results')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('فشل جلب النتائج:', err);
            return [];
        }
    }, []);

    // ── جلب عدد محاولات الطالب ──
    const getStudentAttemptCount = useCallback(async (studentId: string): Promise<number> => {
        try {
            const { data, error } = await supabase
                .from('summer_training_results')
                .select('attempt_number')
                .eq('student_id', studentId)
                .order('attempt_number', { ascending: false })
                .limit(1);
            if (error) throw error;
            return data && data.length > 0 ? data[0].attempt_number : 0;
        } catch {
            return 0;
        }
    }, []);

    // ── جلب القيم الفريدة للاقتراحات (Autocomplete) ──
    const getAutocompleteSuggestions = useCallback(async (fieldName: 'institution_name' | 'department'): Promise<string[]> => {
        try {
            const { data, error } = await supabase
                .from('summer_training_students')
                .select(fieldName);
            if (error) throw error;
            const uniqueValues = new Set((data || []).map((d: any) => d[fieldName]).filter(Boolean));
            return Array.from(uniqueValues).sort();
        } catch {
            return [];
        }
    }, []);

    // ── مصادقة المتدرب ──
    const authenticateTrainee = useCallback(async (username: string, password: string): Promise<TrainingStudent | null> => {
        try {
            const { data, error } = await supabase.rpc('authenticate_training_student', {
                p_username: username,
                p_password: password,
            });
            if (error) throw error;
            if (data && data.length > 0) return data[0];
            return null;
        } catch (err) {
            console.error('فشل المصادقة:', err);
            return null;
        }
    }, []);

    return {
        settings,
        settingsLoading,
        fetchSettings,
        updateSettings,
        checkFileExists,
        uploadFile,
        deleteFile,
        loadExamQuestions,
        fetchStudents,
        createStudent,
        deleteStudent,
        saveTrainingResult,
        fetchResults,
        getStudentAttemptCount,
        getAutocompleteSuggestions,
        authenticateTrainee,
    };
}
