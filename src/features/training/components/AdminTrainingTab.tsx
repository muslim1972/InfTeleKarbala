import { useState, useRef, useEffect, useCallback } from 'react';
import {
    FileSpreadsheet, Upload, Save, X, Loader2,
    ToggleLeft, ToggleRight, Clock, Trophy, Trash2,
    ChevronDown, CheckCircle2, GraduationCap, Shield, Edit2,
    CheckCircle, XCircle, Search, UserPlus, UserMinus, Calendar, Printer
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useTrainingData } from '../hooks/useTrainingData';
import { toast } from 'react-hot-toast';
import type { TrainingResult, TrainingStudent } from '../types';
import { calculateGrade, EXAM_GRADE_LABELS } from '../types';
import { supabase } from '../../../lib/supabase';
import { smoothScrollToId } from '../../../hooks/useSmoothScroll';
import ExcelJS from 'exceljs';
import { TrainingStudentsModal } from './TrainingStudentsModal';
import { EditStudentModal } from './EditStudentModal';
import { TraineePollSettings } from './TraineePollSettings';
interface AdminTrainingTabProps {
    isAdminView?: boolean;
}

interface SupervisorProfile {
    id: string;
    full_name: string;
    job_number: string | null;
}

/**
 * واجهة المشرف العام لإدارة التدريب الصيفي
 * قسم الطلبة + حالة الاختبار + رفع Excel + النتائج
 */
export const AdminTrainingTab = ({ isAdminView = false }: AdminTrainingTabProps) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { user } = useAuth();
    const {
        settings, settingsLoading, updateSettings,
        uploadFile, deleteFile, checkFileExists,
        fetchResults, fetchStudents,
    } = useTrainingData();

    // ── Students Modal ──
    const [showStudentsModal, setShowStudentsModal] = useState(false);
    const [editingStudent, setEditingStudent] = useState<TrainingStudent | null>(null);

    // ── Supervisor Search (Admin View) ──
    const [showSupervisorModal, setShowSupervisorModal] = useState(false);
    const [supervisorSearch, setSupervisorSearch] = useState('');
    const [supervisorSearchResults, setSupervisorSearchResults] = useState<SupervisorProfile[]>([]);
    const [currentSupervisors, setCurrentSupervisors] = useState<SupervisorProfile[]>([]);
    const [supervisorSearching, setSearching] = useState(false);
    const [supervisorsLoading, setSupervisorsLoading] = useState(false);
    const [togglingSupId, setTogglingSupId] = useState<string | null>(null);

    // ── Sections ──
    const [openSection, setOpenSection] = useState<'exams' | 'results' | 'course_settings' | 'student_management' | null>(null);

    // ── Exam State (A & B) ──
    const [examFileA, setExamFileA] = useState<File | null>(null);
    const [examFileB, setExamFileB] = useState<File | null>(null);
    const [examUploading, setExamUploading] = useState(false);
    const [examExistingFiles, setExamExistingFiles] = useState<{ a: boolean; b: boolean }>({ a: false, b: false });
    const [examChecking, setExamChecking] = useState(false);
    const [examDeleting, setExamDeleting] = useState(false);
    const examFileRefA = useRef<HTMLInputElement>(null);
    const examFileRefB = useRef<HTMLInputElement>(null);

    // ── Settings State ──
    const [toggling, setToggling] = useState(false);
    const [durationInput, setDurationInput] = useState('');
    const [trainingYear, setTrainingYear] = useState('');
    const [trainingStartDate, setTrainingStartDate] = useState('');
    const [trainingEndDate, setTrainingEndDate] = useState('');
    const [savingSettings, setSavingSettings] = useState(false);

    // ── Student Management State ──
    const [studentSearchTerm, setStudentSearchTerm] = useState('');

    // ── Results State ──
    const [results, setResults] = useState<TrainingResult[]>([]);
    const [students, setStudents] = useState<TrainingStudent[]>([]);
    const [resultsLoading, setResultsLoading] = useState(false);
    const [selectedStudentResults, setSelectedStudentResults] = useState<TrainingResult[] | null>(null);
    const [activeAttemptIndex, setActiveAttemptIndex] = useState(0);

    // ── Print Report State ──
    type PrintFilter = 'all' | 'tested' | 'passed' | 'failed' | 'never_tested';
    const [showPrintMenu, setShowPrintMenu] = useState(false);
    const printMenuRef = useRef<HTMLDivElement>(null);

    const PRINT_FILTER_LABELS: Record<PrintFilter, string> = {
        all: 'الكل',
        tested: 'الذين اجتازوا الاختبار',
        passed: 'الناجحين فقط',
        failed: 'من لم يوفق للنجاح',
        never_tested: 'لم يختبر أبداً',
    };

    // Close print menu on outside click
    useEffect(() => {
        if (!showPrintMenu) return;
        const handler = (e: MouseEvent) => {
            if (printMenuRef.current && !printMenuRef.current.contains(e.target as Node)) {
                setShowPrintMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showPrintMenu]);

    const handlePrintResults = useCallback((filter: PrintFilter) => {
        setShowPrintMenu(false);

        if (students.length === 0) {
            toast.error('لا يوجد طلبة لطباعة تقريرهم');
            return;
        }

        const filteredStudents = students.filter(student => {
            const studentResults = results.filter(r => r.student_id === student.id);
            const result = studentResults.length > 0 ? studentResults[0] : undefined;

            switch (filter) {
                case 'all':
                    return true;
                case 'tested':
                    return !!result;
                case 'passed':
                    return result && result.score >= 70;
                case 'failed':
                    return result && result.score < 70;
                case 'never_tested':
                    return !result;
            }
        });

        if (filteredStudents.length === 0) {
            toast.error(`لا يوجد طلبة ضمن فئة "${PRINT_FILTER_LABELS[filter]}"`);
            return;
        }

        // Sort: tested students by score desc, untested by name
        const sorted = [...filteredStudents].sort((a, b) => {
            const ra = results.find(r => r.student_id === a.id);
            const rb = results.find(r => r.student_id === b.id);
            if (ra && rb) return rb.score - ra.score;
            if (ra && !rb) return -1;
            if (!ra && rb) return 1;
            return a.full_name.localeCompare(b.full_name);
        });

        const now = new Date().toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' });

        const rows = sorted.map((student, idx) => {
            const studentResults = results.filter(r => r.student_id === student.id);
            const result = studentResults.length > 0 ? studentResults[0] : undefined;

            const score = result ? `%${result.score}` : '—';
            const statusHtml = result
                ? (result.score >= 70
                    ? '<span style="color:#059669;font-weight:700;">ناجح</span>'
                    : '<span style="color:#dc2626;font-size:18px;font-weight:900;">✕</span>')
                : '<span style="font-size:16px;" title="لم يختبر">⏳</span>';
            const attempts = result ? studentResults.length : '—';
            const duration = result?.duration_seconds
                ? `${Math.floor(result.duration_seconds / 60)}:${(result.duration_seconds % 60).toFixed(0).padStart(2, '0')}`
                : '—';

            return `
                <tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:8px 10px;text-align:center;font-weight:700;color:#64748b;">${idx + 1}</td>
                    <td style="padding:8px 10px;text-align:right;font-weight:700;white-space:nowrap;">${student.full_name}</td>
                    <td style="padding:8px 10px;text-align:right;font-size:11px;color:#64748b;">${student.institution_name || '—'}</td>
                    <td style="padding:8px 10px;text-align:right;font-size:11px;color:#64748b;">${(student as any).department || '—'}</td>
                    <td style="padding:8px 10px;text-align:center;font-weight:700;white-space:nowrap;direction:ltr;">${score}</td>
                    <td style="padding:8px 10px;text-align:center;">${attempts}</td>
                    <td style="padding:8px 10px;text-align:center;font-size:11px;white-space:nowrap;direction:ltr;">${duration}</td>
                    <td style="padding:8px 10px;text-align:center;">${statusHtml}</td>
                </tr>`;
        }).join('');

        const html = `
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="utf-8" />
            <title>تقرير نتائج الاختبارات</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
                * { margin: 0; padding: 0; box-sizing: border-box; }
                @page { size: A4; margin: 15mm 10mm; }
                body { font-family: 'Cairo', sans-serif; background: #fff; color: #1e293b; padding: 0; }
                .header { text-align: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 3px solid #059669; }
                .header h1 { font-size: 20px; font-weight: 900; color: #059669; margin-bottom: 2px; }
                .header p { font-size: 12px; color: #64748b; }
                .meta { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 11px; color: #64748b; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; }
                thead { display: table-header-group; }
                thead th { background: #059669; color: #fff; padding: 8px 10px; font-weight: 700; text-align: center; white-space: nowrap; }
                thead th:first-child { border-radius: 0 6px 0 0; }
                thead th:last-child { border-radius: 6px 0 0 0; }
                tbody tr:nth-child(even) { background: #f0fdf4; }
                .footer { margin-top: 16px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
                @media print {
                    body { padding: 0; }
                    thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }
                    tr { page-break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📋 تقرير نتائج اختبارات التدريب الصيفي</h1>
                <p>${PRINT_FILTER_LABELS[filter]} — العدد: ${sorted.length}</p>
            </div>
            <div class="meta">
                <span>تاريخ الطباعة: ${now}</span>
                <span>سنة التدريب: ${settings?.training_year || '—'}</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="width:35px;">#</th>
                        <th>اسم الطالب</th>
                        <th>المؤسسة التعليمية</th>
                        <th>القسم</th>
                        <th>الدرجة</th>
                        <th>المحاولات</th>
                        <th>الوقت</th>
                        <th>النتيجة</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
            <div class="footer">نظام الادارة الموحد — اتصالات ومعلوماتية كربلاء المقدسة</div>
        </body>
        </html>`;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            printWindow.onload = () => {
                printWindow.focus();
                printWindow.print();
            };
        }
    }, [students, results, settings]);

    const handleExportExcel = useCallback(async () => {
        if (students.length === 0) {
            toast.error('لا يوجد طلبة للتصدير');
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('نتائج المتدربين');

        // Set RTL
        worksheet.views = [
            { rightToLeft: true }
        ];

        // Columns
        worksheet.columns = [
            { header: 'ت', key: 'index', width: 5 },
            { header: 'اسم الطالب', key: 'name', width: 30 },
            { header: 'المؤسسة التعليمية', key: 'institution', width: 35 },
            { header: 'القسم', key: 'department', width: 25 },
            { header: 'الدرجة', key: 'score', width: 15 },
            { header: 'المحاولات', key: 'attempts', width: 15 },
            { header: 'الوقت', key: 'duration', width: 15 },
            { header: 'النتيجة', key: 'status', width: 15 },
        ];

        // Header style
        worksheet.getRow(1).eachCell((cell) => {
            cell.font = { name: 'Cairo', bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
            };
        });

        // Sort all students by name
        const sorted = [...students].sort((a, b) => a.full_name.localeCompare(b.full_name));

        sorted.forEach((student, idx) => {
            const studentResults = results.filter(r => r.student_id === student.id);
            const result = studentResults.length > 0 ? studentResults[0] : undefined;

            const score = result ? `${result.score}%` : '—';
            const status = result ? (result.score >= 70 ? 'ناجح' : 'غير موفق') : 'لم يختبر';
            const attempts = result ? studentResults.length : '—';
            const duration = result?.duration_seconds
                ? `${Math.floor(result.duration_seconds / 60)}:${(result.duration_seconds % 60).toFixed(0).padStart(2, '0')}`
                : '—';

            const row = worksheet.addRow({
                index: idx + 1,
                name: student.full_name,
                institution: student.institution_name || '—',
                department: (student as any).department || '—',
                score: score,
                attempts: attempts,
                duration: duration,
                status: status
            });

            row.eachCell((cell, colNumber) => {
                cell.font = { name: 'Cairo', size: 11 };
                cell.alignment = { vertical: 'middle', horizontal: colNumber === 2 ? 'right' : 'center' };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };

                // Add colors for status
                if (colNumber === 8) {
                    if (status === 'ناجح') {
                        cell.font = { name: 'Cairo', size: 11, bold: true, color: { argb: 'FF059669' } };
                    } else if (status === 'غير موفق') {
                        cell.font = { name: 'Cairo', size: 11, bold: true, color: { argb: 'FFDC2626' } };
                    } else {
                        cell.font = { name: 'Cairo', size: 11, color: { argb: 'FF94A3B8' } };
                    }
                }
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `نتائج_اختبارات_التدريب_الصيفي_${new Date().toISOString().split('T')[0]}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
    }, [students, results]);

    const prevOpenSectionRef = useRef<string | null>(null);
    const isFirstRender = useRef(true);

    useEffect(() => {
        if (settings) {
            setDurationInput(String(settings.exam_duration_minutes));
            setTrainingYear(settings.training_year || '2026');
            setTrainingStartDate(settings.training_start_date || '2026-07-05');
            setTrainingEndDate(settings.training_end_date || '2026-08-05');
        }
    }, [settings]);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        if (openSection) {
            const id = `section-${openSection}`;
            // الانتظار إطارين حتى يقدم React عناصر التوسيع في الـ DOM ويتحدث ارتفاع الصفحة
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    smoothScrollToId(id, 15);
                });
            });
        } else {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    smoothScrollToTop();
                });
            });
        }
    }, [openSection]);

    useEffect(() => {
        if (!resultsLoading && openSection === 'results') {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    smoothScrollToId('section-results', 15);
                });
            });
        }
    }, [resultsLoading, openSection]);

    const toggleSection = (section: 'exams' | 'results' | 'course_settings' | 'student_management') => {
        setOpenSection(prev => prev === section ? null : section);
    };

    const handleSaveCourseSettings = async () => {
        setSavingSettings(true);
        const success = await updateSettings({
            training_year: trainingYear,
            training_start_date: trainingStartDate,
            training_end_date: trainingEndDate,
        });
        setSavingSettings(false);
        if (success) {
            toast.success('تم حفظ إعدادات الدورة الصيفية بنجاح');
            setOpenSection(null);
        } else {
            toast.error('فشل في حفظ الإعدادات');
        }
    };

    // ── Fixed subject key for summer training ──
    const TRAINING_SUBJECT = 'summer_training';

    // ── فحص الملفين الموجودين عند فتح قسم الاختبارات ──
    useEffect(() => {
        if (openSection !== 'exams') return;
        let cancelled = false;
        (async () => {
            setExamChecking(true);
            const [existsA, existsB] = await Promise.all([
                checkFileExists('exams', `${TRAINING_SUBJECT}_A`, 'xlsx'),
                checkFileExists('exams', `${TRAINING_SUBJECT}_B`, 'xlsx'),
            ]);
            if (!cancelled) {
                setExamExistingFiles({ a: existsA, b: existsB });
                setExamChecking(false);
            }
        })();
        return () => { cancelled = true; };
    }, [openSection, checkFileExists]);

    // ── مقارنة محتوى ملفين للتأكد من عدم التطابق ──
    const areFilesIdentical = async (fileA: File, fileB: File): Promise<boolean> => {
        if (fileA.size !== fileB.size) return false;
        const [bufA, bufB] = await Promise.all([fileA.arrayBuffer(), fileB.arrayBuffer()]);
        const viewA = new Uint8Array(bufA);
        const viewB = new Uint8Array(bufB);
        return viewA.every((val, i) => val === viewB[i]);
    };

    // ── Exam Handlers (A & B) ──
    const handleExamSave = async () => {
        if (!examFileA || !examFileB) {
            toast.error('يجب رفع ملفي الاختبار A و B معاً');
            return;
        }
        setExamUploading(true);
        const identical = await areFilesIdentical(examFileA, examFileB);
        if (identical) {
            setExamUploading(false);
            toast.error('ملفا الاختبار A و B متطابقان! يجب أن يكونا مختلفين لتمييز الطلبة المتجاورين.');
            return;
        }
        const resultA = await uploadFile('exams', `${TRAINING_SUBJECT}_A`, examFileA, 'xlsx');
        if (!resultA.success) {
            setExamUploading(false);
            toast.error(`فشل رفع اختبار A: ${resultA.error || 'خطأ غير معروف'}`);
            return;
        }
        const resultB = await uploadFile('exams', `${TRAINING_SUBJECT}_B`, examFileB, 'xlsx');
        setExamUploading(false);
        if (!resultB.success) {
            toast.error(`تم رفع A بنجاح لكن فشل رفع اختبار B: ${resultB.error || 'خطأ غير معروف'}`);
            return;
        }
        toast.success('تم رفع اختباري A و B بنجاح');
        setExamFileA(null);
        setExamFileB(null);
        setExamExistingFiles({ a: true, b: true });
        if (examFileRefA.current) examFileRefA.current.value = '';
        if (examFileRefB.current) examFileRefB.current.value = '';
    };

    const handleExamDeleteExisting = async () => {
        setExamDeleting(true);
        const [successA, successB] = await Promise.all([
            deleteFile('exams', `${TRAINING_SUBJECT}_A`, 'xlsx'),
            deleteFile('exams', `${TRAINING_SUBJECT}_B`, 'xlsx'),
        ]);
        setExamDeleting(false);
        if (successA || successB) {
            toast.success('تم حذف ملفات الاختبار');
            setExamExistingFiles({ a: false, b: false });
        } else {
            toast.error('فشل حذف الملفات');
        }
    };

    // ── Toggle Exam Active ──
    const handleToggleExam = async () => {
        if (!settings) return;
        setToggling(true);
        const success = await updateSettings({
            exam_active: !settings.exam_active,
            updated_by: user?.id || null,
        });
        setToggling(false);
        if (success) {
            toast.success(settings.exam_active ? 'تم إيقاف الاختبار' : 'تم تفعيل الاختبار');
        }
    };

    // ── Update Duration ──
    const handleSaveDuration = async () => {
        const val = parseInt(durationInput);
        if (isNaN(val) || val < 1 || val > 120) {
            toast.error('يرجى إدخال مدة صحيحة (1 - 120 دقيقة)');
            return;
        }
        const success = await updateSettings({ exam_duration_minutes: val });
        if (success) toast.success('تم تحديث مدة الاختبار');
    };

    // ── Load Results ──
    const loadResults = useCallback(async () => {
        setResultsLoading(true);
        try {
            const [resultsData, studentsData] = await Promise.all([
                fetchResults(),
                fetchStudents(),
            ]);
            setResults(resultsData);
            setStudents(studentsData);
        } catch (err) {
            console.error('Failed to load results:', err);
        }
        setResultsLoading(false);
    }, [fetchResults, fetchStudents]);

    useEffect(() => {
        if (openSection === 'results') loadResults();
    }, [openSection, loadResults]);

    // ── Delete Result ──
    const handleDeleteResult = async (studentId: string) => {
        if (!confirm('هل تريد حذف جميع نتائج ومحاولات هذا الطالب لإعادة الاختبار؟')) return;
        try {
            const { error } = await supabase.from('summer_training_results').delete().eq('student_id', studentId);
            if (error) throw error;
            setResults(prev => prev.filter(r => r.student_id !== studentId));
            
            // Also reset their exam grade in students table just in case
            await supabase.from('summer_training_students').update({ exam_grade: null }).eq('id', studentId);
            
            toast.success('تم حذف نتائج الطالب بنجاح');
        } catch {
            toast.error('فشل حذف نتائج الطالب');
        }
    };

    // ── Supervisor management (Admin View) ──
    const loadCurrentSupervisors = useCallback(async () => {
        setSupervisorsLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_training_supervisors');
            if (error) throw error;
            setCurrentSupervisors(data || []);
        } catch (err) {
            console.error('فشل جلب المشرفين:', err);
        }
        setSupervisorsLoading(false);
    }, []);

    const handleSearchSupervisors = useCallback(async (query: string) => {
        if (!query.trim() || query.trim().length < 2) {
            setSupervisorSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const term = query.trim();
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, job_number')
                .or(`full_name.ilike.${term}%,job_number.ilike.${term}%`)
                .limit(20);
            if (error) throw error;
            setSupervisorSearchResults(data || []);
        } catch (err) {
            console.error('فشل البحث:', err);
        }
        setSearching(false);
    }, []);

    const handleToggleSupervisor = async (profileId: string, shouldBeSuper: boolean) => {
        setTogglingSupId(profileId);
        try {
            const { error } = await supabase.rpc('set_training_supervisor', {
                target_user_id: profileId,
                make_supervisor: shouldBeSuper,
            });
            if (error) throw error;
            toast.success(shouldBeSuper ? 'تمت إضافة المشرف' : 'تمت إزالة المشرف');
            await loadCurrentSupervisors();
            // Re-search to update results badges
            if (supervisorSearch.trim().length >= 2) {
                await handleSearchSupervisors(supervisorSearch);
            }
        } catch (err) {
            console.error('فشل تعيين المشرف:', err);
            toast.error('فشل تحديث صلاحية الإشراف');
        }
        setTogglingSupId(null);
    };

    useEffect(() => {
        if (showSupervisorModal) loadCurrentSupervisors();
    }, [showSupervisorModal, loadCurrentSupervisors]);

    // Debounced search
    useEffect(() => {
        if (!showSupervisorModal) return;
        const timer = window.setTimeout(() => {
            handleSearchSupervisors(supervisorSearch);
        }, 300);
        return () => window.clearTimeout(timer);
    }, [supervisorSearch, showSupervisorModal, handleSearchSupervisors]);

    // Section header button
    const SectionHeader = ({ id, title, icon: Icon, isOpen, onClick, color }: {
        id?: string;
        title: string;
        icon: any;
        isOpen: boolean;
        onClick: () => void;
        color: string;
    }) => (
        <button
            id={id}
            onClick={onClick}
            className={cn(
                "w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-300 scroll-mt-20",
                isOpen
                    ? cn("shadow-md", isDark ? `bg-${color}-500/10 border-${color}-500/30` : `bg-${color}-50 border-${color}-200`)
                    : isDark ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-slate-200 hover:bg-slate-50"
            )}
        >
            <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", `bg-${color}-500/20 text-${color}-500`)}>
                    <Icon className="w-5 h-5" />
                </div>
                <span className={cn("font-bold text-sm", isDark ? "text-white" : "text-slate-800")}>{title}</span>
            </div>
            <ChevronDown className={cn("w-5 h-5 transition-transform duration-300", isOpen ? "rotate-180" : "", isDark ? "text-white/50" : "text-slate-400")} />
        </button>
    );
    return (
        <div className="max-w-4xl mx-auto px-4 pb-40 mt-2 space-y-4 animate-in fade-in slide-in-from-right-5 duration-300">
            {isAdminView && (
                <div className={cn(
                    "rounded-2xl p-4 border flex flex-col sm:flex-row items-center justify-between gap-4 transition-all duration-300",
                    isDark
                        ? "bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950 border-white/10"
                        : "bg-white border-slate-200 shadow-xl shadow-slate-100"
                )}>
                    <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-xl bg-emerald-500/10 text-emerald-500")}>
                            <Shield className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className={cn("text-sm font-bold", isDark ? "text-white" : "text-slate-800")}>تحديد المشرفين على التدريب الصيفي</h3>
                            <p className={cn("text-xs", isDark ? "text-white/50" : "text-slate-500")}>تحديد الموظفين كمشرفين على التدريب الصيفي</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowSupervisorModal(true)}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95 whitespace-nowrap"
                    >
                        تحديد المشرفين على التدريب الصيفي
                    </button>
                </div>
            )}

            {/* إعدادات استطلاع المتدربين */}
            {isAdminView && (
                <TraineePollSettings />
            )}

            {/* زر تحديد أسماء الطلبة */}
            <div className={cn(
                "rounded-2xl p-4 border flex flex-col sm:flex-row items-center justify-between gap-4 transition-all duration-300",
                isDark
                    ? "bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950 border-white/10"
                    : "bg-white border-slate-200 shadow-xl shadow-slate-100"
            )}>
                <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-xl bg-emerald-500/10 text-emerald-500")}>
                        <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className={cn("text-sm font-bold", isDark ? "text-white" : "text-slate-800")}>تحديد الطلبة المشاركين</h3>
                        <p className={cn("text-xs", isDark ? "text-white/50" : "text-slate-500")}>إضافة وإدارة الطلبة المتدربين في التدريب الصيفي</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowStudentsModal(true)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95 whitespace-nowrap"
                >
                    تحديد الطلبة المشاركين
                </button>
            </div>

            {/* ── إعدادات الدورة الصيفية والاختبار ── */}
            <SectionHeader id="section-course_settings" title="إعدادات الدورة الصيفية والاختبار" icon={Calendar} isOpen={openSection === 'course_settings'} onClick={() => toggleSection('course_settings')} color="emerald" />
            {openSection === 'course_settings' && (
                <div className={cn(
                    "rounded-xl border p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300",
                    isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200"
                )}>
                    {/* ── تحكم الاختبار ── */}
                    <div className={cn(
                        "rounded-2xl p-4 border space-y-4",
                        isDark ? "bg-gradient-to-br from-emerald-950/20 to-teal-950/10 border-emerald-500/15" : "bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200/60"
                    )}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={cn("p-2 rounded-xl", isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-600")}>
                                    {settings?.exam_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                                </div>
                                <div>
                                    <h3 className={cn("text-sm font-bold", isDark ? "text-emerald-300" : "text-emerald-900")}>حالة الاختبار</h3>
                                    <p className={cn("text-xs", isDark ? "text-white/50" : "text-emerald-700/70")}>
                                        {settings?.exam_active ? 'الاختبار مفعّل ومتاح للمتدربين' : 'الاختبار متوقف حالياً'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleToggleExam}
                                disabled={toggling || settingsLoading}
                                className={cn(
                                    "px-4 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 disabled:opacity-50",
                                    settings?.exam_active
                                        ? "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20"
                                        : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600"
                                )}
                            >
                                {toggling ? <Loader2 className="w-4 h-4 animate-spin" /> : settings?.exam_active ? 'إيقاف' : 'تفعيل'}
                            </button>
                        </div>

                        {/* مدة الاختبار */}
                        <div className="flex items-center gap-3">
                            <Clock className={cn("w-4 h-4", isDark ? "text-white/40" : "text-slate-400")} />
                            <input
                                type="number"
                                min={1}
                                max={120}
                                value={durationInput}
                                onChange={e => setDurationInput(e.target.value)}
                                className={cn(
                                    "w-20 p-2 rounded-lg border text-sm text-center font-mono",
                                    isDark ? "bg-white/5 border-white/10 text-white" : "bg-white border-slate-200 text-slate-800"
                                )}
                            />
                            <span className={cn("text-xs", isDark ? "text-white/50" : "text-slate-500")}>دقيقة</span>
                            <button
                                onClick={handleSaveDuration}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                    isDark ? "bg-white/10 text-white/70 hover:bg-white/20" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                )}
                            >
                                تحديث
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-white/10">
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold block">سنة التدريب</label>
                            <input
                                type="text"
                                value={trainingYear}
                                onChange={e => setTrainingYear(e.target.value)}
                                className={cn("w-full px-3 py-2 rounded-lg border text-sm", isDark ? "bg-zinc-800 border-white/10 text-white" : "bg-white border-slate-200 text-slate-800")}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold block">تاريخ المباشرة</label>
                            <input
                                type="date"
                                value={trainingStartDate}
                                onChange={e => setTrainingStartDate(e.target.value)}
                                className={cn("w-full px-3 py-2 rounded-lg border text-sm text-right", isDark ? "bg-zinc-800 border-white/10 text-white" : "bg-white border-slate-200 text-slate-800")}
                                dir="ltr"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold block">تاريخ الانفكاك</label>
                            <input
                                type="date"
                                value={trainingEndDate}
                                onChange={e => setTrainingEndDate(e.target.value)}
                                className={cn("w-full px-3 py-2 rounded-lg border text-sm text-right", isDark ? "bg-zinc-800 border-white/10 text-white" : "bg-white border-slate-200 text-slate-800")}
                                dir="ltr"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button
                            onClick={handleSaveCourseSettings}
                            disabled={savingSettings}
                            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-xl transition-all flex items-center gap-2"
                        >
                            {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            حفظ الإعدادات
                        </button>
                    </div>
                </div>
            )}

            {/* ── إدارة الطلبة والبحث ── */}
            <SectionHeader id="section-student_management" title="إدارة الطلبة والبحث" icon={Search} isOpen={openSection === 'student_management'} onClick={() => {
                toggleSection('student_management');
                if (openSection !== 'student_management' && students.length === 0) {
                    loadResults(); // Load students if not loaded
                }
            }} color="emerald" />
            {openSection === 'student_management' && (
                <div className={cn(
                    "rounded-xl border p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300",
                    isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200"
                )}>
                    <div className="relative">
                        <Search className={cn("absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4", isDark ? "text-white/40" : "text-slate-400")} />
                        <input
                            type="text"
                            value={studentSearchTerm}
                            onChange={e => setStudentSearchTerm(e.target.value)}
                            placeholder="ابحث عن طالب بالاسم، الجامعة، أو المدرب..."
                            className={cn(
                                "w-full pr-10 pl-10 py-2.5 rounded-xl border text-sm font-bold transition-all outline-none",
                                isDark
                                    ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-emerald-500/50"
                                    : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-emerald-500"
                            )}
                            dir="rtl"
                        />
                        {studentSearchTerm && (
                            <button
                                onClick={() => setStudentSearchTerm('')}
                                className={cn(
                                    "absolute left-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-500/20 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all active:scale-95"
                                )}
                                title="تفريغ البحث"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {studentSearchTerm.trim() !== '' && (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                            {students.filter(s => 
                                s.full_name.includes(studentSearchTerm) || 
                                (s.institution_name && s.institution_name.includes(studentSearchTerm)) ||
                                (s.trainer_name && s.trainer_name.includes(studentSearchTerm))
                            ).length === 0 ? (
                                <div className="text-center py-6 opacity-60 text-xs font-bold">
                                    لا يوجد طلبة مطابقين لبحثك
                                </div>
                            ) : (
                                students.filter(s => 
                                    s.full_name.includes(studentSearchTerm) || 
                                    (s.institution_name && s.institution_name.includes(studentSearchTerm)) ||
                                    (s.trainer_name && s.trainer_name.includes(studentSearchTerm))
                                ).map(student => (
                                    <div key={student.id} className={cn(
                                        "flex flex-wrap sm:flex-nowrap items-center justify-between p-3 rounded-lg border gap-3",
                                        isDark ? "bg-zinc-800/50 border-white/10" : "bg-white border-gray-200"
                                    )}>
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="min-w-0 text-right">
                                                <p className="font-bold text-sm truncate">{student.full_name}</p>
                                                <p className="text-xs mt-1 opacity-70">
                                                    {student.institution_name} | المدرب: {student.trainer_name} | الموقع: {student.training_location}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                onClick={() => setEditingStudent(student)}
                                                className="p-2 rounded-lg text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors border border-emerald-200"
                                                title="تعديل الطالب"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (!confirm(`هل أنت متأكد من حذف الطالب ${student.full_name}؟`)) return;
                                                    const { error } = await supabase.from('summer_training_students').delete().eq('id', student.id);
                                                    if (!error) {
                                                        toast.success('تم حذف الطالب');
                                                        setStudents(prev => prev.filter(s => s.id !== student.id));
                                                    } else {
                                                        toast.error('فشل حذف الطالب');
                                                    }
                                                }}
                                                className="p-2 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors border border-red-200"
                                                title="حذف الطالب"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Supervisor Search Modal (Admin View) ── */}
            {showSupervisorModal && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSupervisorModal(false)} />
                    <div className={cn(
                        "relative w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200",
                        isDark ? 'bg-zinc-900 text-white border border-white/10' : 'bg-white text-slate-900 border border-slate-200'
                    )}>
                        {/* Header */}
                        <div className={cn("p-4 border-b flex items-center justify-between", isDark ? "border-white/10" : "border-slate-100")}>
                            <div>
                                <h2 className="text-lg font-bold">تحديد المشرفين على التدريب الصيفي</h2>
                                <p className={cn("text-xs mt-1", isDark ? "text-white/60" : "text-slate-500")}>ابحث عن الموظف بالاسم أو رقم الوظيفة</p>
                            </div>
                            <button onClick={() => setShowSupervisorModal(false)} className="p-2 rounded-full hover:bg-red-500/10 text-red-400 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search */}
                        <div className={cn("p-4 border-b", isDark ? "border-white/10" : "border-slate-100")}>
                            <div className="relative">
                                <Search className={cn("absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4", isDark ? "text-white/40" : "text-slate-400")} />
                                <input
                                    type="text"
                                    value={supervisorSearch}
                                    onChange={e => setSupervisorSearch(e.target.value)}
                                    placeholder="ابحث بالاسم أو رقم الوظيفة..."
                                    className={cn(
                                        "w-full pr-10 pl-4 py-2.5 rounded-xl border text-sm font-bold transition-all outline-none",
                                        isDark
                                            ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-emerald-500/50"
                                            : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-emerald-500"
                                    )}
                                    dir="rtl"
                                    autoFocus
                                />
                                {supervisorSearching && <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-emerald-500" />}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {/* Search Results */}
                            {supervisorSearch.trim().length >= 2 && (
                                <div className={cn("p-4 border-b", isDark ? "border-white/10" : "border-slate-100")}>
                                    <h3 className={cn("text-xs font-bold mb-3", isDark ? "text-white/60" : "text-slate-500")}>نتائج البحث</h3>
                                    {supervisorSearchResults.length === 0 && !supervisorSearching ? (
                                        <p className={cn("text-xs text-center py-4", isDark ? "text-white/40" : "text-slate-400")}>لا توجد نتائج</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {supervisorSearchResults.map(profile => {
                                                const isSupervisor = currentSupervisors.some(s => s.id === profile.id);
                                                return (
                                                    <div key={profile.id} className={cn(
                                                        "flex items-center justify-between p-3 rounded-xl border transition-all",
                                                        isSupervisor
                                                            ? isDark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-200"
                                                            : isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200"
                                                    )}>
                                                        <div className="min-w-0 flex-1 text-right">
                                                            <p className={cn("text-sm font-bold truncate", isDark ? "text-white" : "text-slate-800")}>{profile.full_name}</p>
                                                            <p className={cn("text-[10px]", isDark ? "text-white/40" : "text-slate-400")}>
                                                                رقم الوظيفة: {profile.job_number || 'غير متوفر'}
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() => handleToggleSupervisor(profile.id, !isSupervisor)}
                                                            disabled={togglingSupId === profile.id}
                                                            className={cn(
                                                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 shrink-0 mr-3",
                                                                isSupervisor
                                                                    ? "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20"
                                                                    : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600"
                                                            )}
                                                        >
                                                            {togglingSupId === profile.id ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            ) : isSupervisor ? (
                                                                <><UserMinus className="w-3.5 h-3.5" /> إزالة</>
                                                            ) : (
                                                                <><UserPlus className="w-3.5 h-3.5" /> تعيين</>
                                                            )}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Current Supervisors List */}
                            <div className="p-4">
                                <h3 className={cn("text-xs font-bold mb-3", isDark ? "text-emerald-400" : "text-emerald-700")}>
                                    المشرفون الحاليون ({currentSupervisors.length})
                                </h3>
                                {supervisorsLoading ? (
                                    <div className="flex items-center justify-center p-6">
                                        <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                                    </div>
                                ) : currentSupervisors.length === 0 ? (
                                    <p className={cn("text-xs text-center py-4", isDark ? "text-white/40" : "text-slate-400")}>لا يوجد مشرفون حالياً</p>
                                ) : (
                                    <div className="space-y-2">
                                        {currentSupervisors.map(sup => (
                                            <div key={sup.id} className={cn(
                                                "flex items-center justify-between p-3 rounded-xl border",
                                                isDark ? "bg-emerald-500/5 border-emerald-500/15" : "bg-emerald-50/50 border-emerald-200/60"
                                            )}>
                                                <div className="min-w-0 flex-1 text-right">
                                                    <p className={cn("text-sm font-bold truncate", isDark ? "text-white" : "text-slate-800")}>{sup.full_name}</p>
                                                    <p className={cn("text-[10px]", isDark ? "text-white/40" : "text-slate-400")}>
                                                        رقم الوظيفة: {sup.job_number || 'غير متوفر'}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleToggleSupervisor(sup.id, false)}
                                                    disabled={togglingSupId === sup.id}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-all active:scale-95 disabled:opacity-50 shrink-0 mr-3"
                                                >
                                                    {togglingSupId === sup.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><UserMinus className="w-3.5 h-3.5" /> إزالة</>}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className={cn("p-4 border-t flex justify-end", isDark ? "border-white/10" : "border-slate-100")}>
                            <button onClick={() => setShowSupervisorModal(false)} className="px-6 py-2 bg-slate-500 hover:bg-slate-600 text-white font-bold text-sm rounded-xl transition-all">إغلاق</button>
                        </div>
                    </div>
                </div>
            )}

            {showStudentsModal && (
                <TrainingStudentsModal
                    onClose={() => {
                        setShowStudentsModal(false);
                        loadResults();
                    }}
                    onRefresh={loadResults}
                    theme={theme}
                />
            )}




                    {/* ── نتائج الاختبارات ── */}
                    <div className="flex items-center gap-2">
                        <div className="flex-1">
                            <SectionHeader id="section-results" title="نتائج الاختبارات" icon={Trophy} isOpen={openSection === 'results'} onClick={() => toggleSection('results')} color="emerald" />
                        </div>
                        {openSection === 'results' && students.length > 0 && (
                            <div className="flex items-center gap-1.5 shrink-0">
                                <div className="relative shrink-0" ref={printMenuRef}>
                                    <button
                                        onClick={() => setShowPrintMenu(prev => !prev)}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition-all active:scale-95",
                                            isDark
                                                ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30"
                                                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                                        )}
                                        title="طباعة تقرير"
                                    >
                                        <Printer className="w-3.5 h-3.5" />
                                        طباعة تقرير
                                        <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", showPrintMenu && "rotate-180")} />
                                    </button>
                                    {showPrintMenu && (
                                        <div className={cn(
                                            "absolute top-full left-0 mt-1 w-48 rounded-xl border shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200",
                                            isDark ? "bg-zinc-900 border-white/10" : "bg-white border-slate-200"
                                        )}>
                                            {(Object.entries(PRINT_FILTER_LABELS) as [PrintFilter, string][]).map(([key, label]) => (
                                                <button
                                                    key={key}
                                                    onClick={() => handlePrintResults(key)}
                                                    className={cn(
                                                        "w-full text-right px-4 py-2.5 text-[12px] font-bold transition-colors border-b last:border-b-0",
                                                        isDark
                                                            ? "text-white/80 hover:bg-white/10 hover:text-emerald-400 border-white/5"
                                                            : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 border-slate-100"
                                                    )}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={handleExportExcel}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition-all active:scale-95",
                                        isDark
                                            ? "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30"
                                            : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                                    )}
                                    title="تصدير Excel لجميع الطلبة"
                                >
                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                    تصدير Excel
                                </button>
                            </div>
                        )}
                    </div>
                    {openSection === 'results' && (
                        <div className={cn(
                            "rounded-xl border p-4 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300",
                            isDark ? "bg-white/5 border-white/10" : "bg-white border-slate-200"
                        )}>
                            {resultsLoading ? (
                                <div className="flex items-center justify-center p-6">
                                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                                </div>
                            ) : students.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-8 space-y-3 opacity-60">
                                    <Trophy className="w-12 h-12 text-slate-400" />
                                    <p className="text-sm font-bold text-slate-500">
                                        لم يتم تحديد طلبة مشاركين بعد
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <p className={cn("text-sm font-bold text-center", isDark ? "text-emerald-300" : "text-emerald-700")}>
                                        ( عدد الطلبة الذين انهوا الاختبار {new Set(results.map(r => r.student_id)).size} من العدد الاجمالي {students.length} )
                                    </p>
                                    <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                                        {(() => {
                                            const sortedStudents = [...students].sort((a, b) => {
                                                const resultA = results.find(r => r.student_id === a.id);
                                                const resultB = results.find(r => r.student_id === b.id);

                                                if (resultA && resultB) {
                                                    if (resultA.score !== resultB.score) {
                                                        return resultB.score - resultA.score;
                                                    }
                                                    const durA = resultA.duration_seconds || Infinity;
                                                    const durB = resultB.duration_seconds || Infinity;
                                                    return durA - durB;
                                                }

                                                if (resultA && !resultB) return -1;
                                                if (!resultA && resultB) return 1;

                                                return a.full_name.localeCompare(b.full_name);
                                            });

                                            return sortedStudents.map(student => {
                                                const studentResults = results.filter(r => r.student_id === student.id);
                                                const result = studentResults.length > 0 ? studentResults[0] : undefined;
                                                
                                                if (result) {
                                                    const finalScore = result.score;
                                                    const isPassed = finalScore >= 70;

                                                    return (
                                                        <div key={student.id} onClick={() => {
                                                            const sortedAttempts = [...studentResults].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                                                            setSelectedStudentResults(sortedAttempts);
                                                            setActiveAttemptIndex(sortedAttempts.length - 1);
                                                        }} className={cn(
                                                            "relative p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md text-right",
                                                            isDark ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-slate-200 hover:border-emerald-300"
                                                        )}>
                                                            {/* Score, Grade and Delete Button (Top Left) */}
                                                            <div className="absolute top-4 left-4 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                                <button
                                                                    onClick={() => handleDeleteResult(student.id)}
                                                                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                                                                    title="حذف جميع نتائج الطالب لإعادة الاختبار"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                                <span className={cn(
                                                                    "px-2 py-1 rounded-lg text-[10px] font-bold",
                                                                    isPassed
                                                                        ? isDark ? "bg-emerald-500/15 text-emerald-300" : "bg-emerald-100 text-emerald-700"
                                                                        : isDark ? "bg-red-500/15 text-red-300" : "bg-red-100 text-red-700"
                                                                )}>
                                                                    {isPassed ? 'ناجح' : 'محاولة غير موفقة'}
                                                                </span>
                                                                <span className={cn(
                                                                    "px-2 py-1 rounded-lg text-[10px] font-bold text-center",
                                                                    isDark ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"
                                                                )} dir="rtl">
                                                                    {studentResults.length} محاولات
                                                                </span>
                                                                <span className={cn(
                                                                    "px-3 py-1.5 rounded-lg text-sm font-bold",
                                                                    isPassed
                                                                        ? isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                                                                        : isDark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-700"
                                                                )} dir="ltr">
                                                                    {finalScore} / 100
                                                                </span>
                                                            </div>

                                                            <div className="min-w-0 ml-36">
                                                                <p className={cn("text-base font-black truncate", isDark ? "text-white" : "text-slate-800")}>{student.full_name}</p>
                                                                <p className={cn("text-sm mt-1.5 font-bold", isDark ? "text-white/70" : "text-slate-600")}>
                                                                    {student.institution_name} — {student.department}
                                                                </p>
                                                <p className={cn("text-xs mt-1", isDark ? "text-white/50" : "text-slate-500")}>
                                                                    الوقت الاجمالي للاختبار <span className="font-mono" dir="ltr">{result.duration_seconds ? `${Math.floor(result.duration_seconds / 60)}:${(result.duration_seconds % 60).toFixed(2).padStart(5, '0')}` : 'غير متوفر'}</span> — الدرجة = <span className="font-mono" dir="ltr">{finalScore} / 100</span> — النتيجة: {isPassed ? 'ناجح' : 'محاولة غير موفقة'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                } else {
                                                    return (
                                                        <div key={student.id} className={cn(
                                                            "flex items-center justify-between p-3 rounded-lg border opacity-60 grayscale cursor-not-allowed",
                                                            isDark ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100"
                                                        )}>
                                                            <div className="min-w-0 flex-1 text-right">
                                                                <p className={cn("text-sm font-bold truncate", isDark ? "text-white" : "text-slate-800")}>{student.full_name}</p>
                                                                <p className={cn("text-[10px]", isDark ? "text-white/40" : "text-slate-400")}>
                                                                    {student.institution_name} — {student.department} — قيد الانتظار ولم يكمل الاختبار
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                            });
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}


            {/* Modal for viewing exam details */}
            {selectedStudentResults && selectedStudentResults.length > 0 && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedStudentResults(null)} />
                    <div className={cn(
                        "relative w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200",
                        isDark ? 'bg-zinc-900 text-white border border-white/10' : 'bg-white text-slate-900 border border-slate-200'
                    )}>
                        <div className={cn("p-4 border-b flex items-center justify-between", isDark ? "border-white/10" : "border-slate-100")}>
                            <div className="flex-1">
                                <div className="flex items-center justify-between ml-8">
                                    <h2 className="text-lg font-bold">تفاصيل إجابات الطالب</h2>
                                    {selectedStudentResults.length > 1 && (
                                        <div className="flex items-center gap-2 mr-4" dir="rtl">
                                            <label className={cn("text-xs font-bold", isDark ? "text-white/70" : "text-slate-600")}>اختر المحاولة:</label>
                                            <select 
                                                value={activeAttemptIndex} 
                                                onChange={(e) => setActiveAttemptIndex(Number(e.target.value))}
                                                className={cn(
                                                    "px-3 py-1 rounded-lg text-sm font-bold border outline-none",
                                                    isDark ? "bg-zinc-800 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                                                )}
                                            >
                                                {selectedStudentResults.map((res, idx) => (
                                                    <option key={idx} value={idx}>المحاولة {idx + 1} {idx === selectedStudentResults.length - 1 ? '(الأخيرة)' : ''}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                                <p className={cn("text-xs mt-1", isDark ? "text-white/60" : "text-slate-500")} dir="rtl">
                                    النتيجة: {selectedStudentResults[activeAttemptIndex].score} / 100
                                    {' — '}النتيجة النهائية: {selectedStudentResults[activeAttemptIndex].score >= 70 ? 'ناجح' : 'محاولة غير موفقة'}
                                </p>
                            </div>
                            <button onClick={() => setSelectedStudentResults(null)} className="absolute top-4 left-4 p-2 rounded-full hover:bg-red-500/10 text-red-400 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar text-right">
                            {selectedStudentResults[activeAttemptIndex].exam_details ? (
                                selectedStudentResults[activeAttemptIndex].exam_details.questions.map((q, i) => {
                                    const userAnswer = selectedStudentResults[activeAttemptIndex].exam_details!.answers[i];
                                    const isCorrect = userAnswer === q.correctIndex;
                                    return (
                                        <div key={i} className={cn(
                                            "rounded-xl border p-4",
                                            isCorrect
                                                ? isDark ? "border-emerald-500/20 bg-emerald-500/5" : "border-emerald-200 bg-emerald-50/50"
                                                : isDark ? "border-red-500/20 bg-red-500/5" : "border-red-200 bg-red-50/50"
                                        )}>
                                            <div className="flex items-start gap-2 mb-3">
                                                {isCorrect
                                                    ? <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                                                    : <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                                                }
                                                <span className={cn("text-sm font-bold leading-relaxed", isDark ? "text-white" : "text-slate-800")}>
                                                    {i + 1}. {q.question}
                                                </span>
                                            </div>
                                            <div className="mr-7 space-y-1.5">
                                                {q.options.map((opt, j) => (
                                                    <div key={j} className={cn(
                                                        "text-xs px-3 py-2 rounded-lg transition-colors",
                                                        j === q.correctIndex
                                                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30"
                                                            : j === userAnswer && j !== q.correctIndex
                                                                ? "bg-red-500/20 text-red-700 dark:text-red-300 line-through border border-red-500/30"
                                                                : isDark ? "text-white/50 bg-white/5" : "text-slate-500 bg-slate-50 border border-slate-100"
                                                    )}>
                                                        {opt}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="p-8 text-center">
                                    <Trophy className="w-12 h-12 mx-auto text-emerald-500/50 mb-3" />
                                    <p className={cn("font-bold", isDark ? "text-white/60" : "text-slate-500")}>لا توجد تفاصيل لهذا الاختبار</p>
                                    <p className={cn("text-xs mt-2", isDark ? "text-white/40" : "text-slate-400")}>الاختبارات القديمة لا تحتوي على سجل بالأسئلة المحددة، بينما الاختبارات الجديدة سيتم حفظ تفاصيلها بالكامل هنا.</p>
                                </div>
                            )}
                        </div>
                        <div className={cn("p-4 border-t flex justify-end", isDark ? "border-white/10" : "border-slate-100")}>
                            <button onClick={() => setSelectedResult(null)} className="px-6 py-2 bg-slate-500 hover:bg-slate-600 text-white font-bold text-sm rounded-xl transition-all">إغلاق</button>
                        </div>
                    </div>
                </div>
            )}
            {editingStudent && (
                <EditStudentModal
                    student={editingStudent}
                    onClose={() => setEditingStudent(null)}
                    onUpdate={(updated) => {
                        loadResults(); // Refresh results to sync everything
                        setEditingStudent(null);
                    }}
                />
            )}
        </div>
    );
};
