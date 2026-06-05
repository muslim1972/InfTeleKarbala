import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Loader2, Trash2, GraduationCap, User, Plus, Building2, Calendar, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '../../../lib/utils';
import { useAuth } from '../../../context/AuthContext';
import { Input } from '../../../components/ui/Input';
import { useTrainingData } from '../hooks/useTrainingData';
import type { TrainingStudent, InstitutionType } from '../types';
import { INSTITUTION_TYPE_LABELS, EXAM_GRADE_LABELS } from '../types';

interface TrainingStudentsModalProps {
    onClose: () => void;
    theme: string;
}

const AutocompleteField = ({
    label,
    value,
    onChange,
    suggestions,
    showDropdown,
    setShowDropdown,
    containerRef,
    placeholder,
    theme,
}: {
    label: string;
    value: string;
    onChange: (val: string) => void;
    suggestions: string[];
    showDropdown: boolean;
    setShowDropdown: (v: boolean) => void;
    containerRef: React.RefObject<HTMLDivElement>;
    placeholder?: string;
    theme: string;
}) => (
    <div className="space-y-1.5" ref={containerRef}>
        <label className="text-sm font-bold block">
            {label} <span className="text-red-500">*</span>
        </label>
        <div className="relative">
            <Input
                value={value}
                onChange={e => {
                    onChange(e.target.value);
                    setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder={placeholder}
                className="text-right"
            />
            {showDropdown && suggestions.length > 0 && (
                <div className={cn(
                    "absolute z-50 w-full mt-1 max-h-40 overflow-y-auto rounded-xl border shadow-lg custom-scrollbar",
                    theme === 'light' ? "bg-white border-gray-200" : "bg-zinc-800 border-white/10"
                )}>
                    {suggestions.map((item, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => {
                                onChange(item);
                                setShowDropdown(false);
                            }}
                            className={cn(
                                "w-full text-right px-3 py-2 text-sm transition-colors border-b last:border-b-0",
                                theme === 'light'
                                    ? "hover:bg-emerald-50 border-gray-100"
                                    : "hover:bg-emerald-500/10 border-white/5"
                            )}
                        >
                            {item}
                        </button>
                    ))}
                </div>
            )}
        </div>
    </div>
);

/**
 * مودال تحديد الطلبة المتدربين (طلاب الجامعات/المدارس)
 * يستخدم من قبل مشرف التدريب الصيفي لإضافة وإدارة المتدربين
 */
export const TrainingStudentsModal: React.FC<TrainingStudentsModalProps> = ({ onClose, theme }) => {
    const { user } = useAuth();
    const { createStudent, fetchStudents, deleteStudent, getAutocompleteSuggestions } = useTrainingData();

    // ── حالة النموذج ──
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [institutionType, setInstitutionType] = useState<InstitutionType>('college');
    const [institutionName, setInstitutionName] = useState('');
    const [department, setDepartment] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ── قائمة الطلاب ──
    const [students, setStudents] = useState<TrainingStudent[]>([]);
    const [isLoadingStudents, setIsLoadingStudents] = useState(true);

    // ── الإكمال التلقائي ──
    const [institutionSuggestions, setInstitutionSuggestions] = useState<string[]>([]);
    const [departmentSuggestions, setDepartmentSuggestions] = useState<string[]>([]);
    const [showInstitutionDropdown, setShowInstitutionDropdown] = useState(false);
    const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
    const institutionRef = useRef<HTMLDivElement>(null);
    const departmentRef = useRef<HTMLDivElement>(null);

    // ── حفظ آخر تاريخ انفكاك مستخدم ──
    const lastEndDateRef = useRef<string>('');

    // ── جلب البيانات عند التحميل ──
    useEffect(() => {
        loadStudents();
        loadSuggestions();
    }, []);

    // ── إغلاق القوائم المنسدلة عند النقر خارجها ──
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (institutionRef.current && !institutionRef.current.contains(e.target as Node)) {
                setShowInstitutionDropdown(false);
            }
            if (departmentRef.current && !departmentRef.current.contains(e.target as Node)) {
                setShowDepartmentDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadStudents = async () => {
        setIsLoadingStudents(true);
        try {
            const data = await fetchStudents();
            setStudents(data);
        } finally {
            setIsLoadingStudents(false);
        }
    };

    const loadSuggestions = async () => {
        const [instData, deptData] = await Promise.all([
            getAutocompleteSuggestions('institution_name'),
            getAutocompleteSuggestions('department'),
        ]);
        setInstitutionSuggestions(instData);
        setDepartmentSuggestions(deptData);
    };

    // ── تصفية الاقتراحات محلياً ──
    const filteredInstitutions = useMemo(() => {
        if (!institutionName.trim()) return institutionSuggestions;
        return institutionSuggestions.filter(s =>
            s.toLowerCase().includes(institutionName.toLowerCase())
        );
    }, [institutionName, institutionSuggestions]);

    const filteredDepartments = useMemo(() => {
        if (!department.trim()) return departmentSuggestions;
        return departmentSuggestions.filter(s =>
            s.toLowerCase().includes(department.toLowerCase())
        );
    }, [department, departmentSuggestions]);

    // ── إضافة متدرب ──
    const handleAddStudent = async () => {
        if (!fullName.trim() || !username.trim() || !password.trim()) {
            toast.error('يرجى ملء الحقول المطلوبة (الاسم، اسم المستخدم، كلمة المرور)');
            return;
        }
        if (!institutionName.trim()) {
            toast.error('يرجى إدخال اسم المؤسسة');
            return;
        }
        if (!department.trim()) {
            toast.error('يرجى إدخال القسم');
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await createStudent({
                full_name: fullName.trim(),
                username: username.trim(),
                password: password.trim(),
                institution_type: institutionType,
                institution_name: institutionName.trim(),
                department: department.trim(),
                start_date: startDate || null,
                end_date: endDate || null,
                supervisor_id: user?.id || '',
            });

            if (result.success) {
                toast.success(`تم إضافة المتدرب "${fullName.trim()}" بنجاح`);

                // حفظ آخر تاريخ انفكاك
                if (endDate) {
                    lastEndDateRef.current = endDate;
                }

                // إعادة تعيين النموذج مع الاحتفاظ بنوع المؤسسة والتواريخ
                setFullName('');
                setUsername('');
                setPassword('');
                setInstitutionName('');
                setDepartment('');
                setStartDate('');
                // ملء تاريخ الانفكاك تلقائياً من آخر قيمة مستخدمة
                setEndDate(lastEndDateRef.current);

                // تحديث القائمة والاقتراحات
                loadStudents();
                loadSuggestions();
            } else {
                toast.error(result.error || 'فشل في إضافة المتدرب');
            }
        } catch {
            toast.error('حدث خطأ غير متوقع');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── حذف متدرب ──
    const handleDeleteStudent = async (student: TrainingStudent) => {
        const confirmResult = window.confirm(`هل أنت متأكد من حذف المتدرب "${student.full_name}"؟`);
        if (!confirmResult) return;

        const success = await deleteStudent(student.id);
        if (success) {
            toast.success(`تم حذف المتدرب "${student.full_name}"`);
            setStudents(prev => prev.filter(s => s.id !== student.id));
        } else {
            toast.error('فشل في حذف المتدرب');
        }
    };



    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className={cn(
                "relative w-full max-w-2xl rounded-2xl shadow-2xl p-6 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200",
                theme === 'light' ? 'bg-white text-gray-900 border border-gray-200' : 'bg-zinc-900 text-white border border-white/10'
            )}>
                {/* زر الإغلاق */}
                <button onClick={onClose} className="absolute left-6 top-6 p-2 rounded-full transition-colors hover:bg-black/10 dark:hover:bg-white/10">
                    <X className="w-5 h-5" />
                </button>

                {/* العنوان */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                        <GraduationCap className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">تحديد الطلبة المتدربين</h2>
                        <p className={cn("text-sm", theme === 'light' ? "text-gray-500" : "text-white/50")}>
                            إضافة وإدارة الطلبة المتدربين في التدريب الصيفي
                        </p>
                    </div>
                </div>

                {/* المحتوى القابل للتمرير */}
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">

                    {/* ── نموذج الإضافة ── */}
                    <div className={cn(
                        "p-4 rounded-xl border space-y-4",
                        "border-emerald-500/20 bg-emerald-500/5"
                    )}>
                        <div className="flex items-center gap-2 mb-1">
                            <Plus className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">إضافة متدرب جديد</span>
                        </div>

                        {/* الصف الأول: الاسم الرباعي + اسم المستخدم */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold block">
                                    الاسم الرباعي <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                    placeholder="أدخل الاسم الرباعي..."
                                    className="text-right"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold block">
                                    اسم المستخدم <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    placeholder="username"
                                    className="text-left"
                                    dir="ltr"
                                />
                            </div>
                        </div>

                        {/* الصف الثاني: كلمة المرور + نوع المؤسسة */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold block">
                                    كلمة المرور <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="أدخل كلمة المرور"
                                        className="text-right text-end pl-10 font-sans tracking-normal"
                                        dir="rtl"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-emerald-500 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold block">
                                    نوع المؤسسة <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <select
                                        value={institutionType}
                                        onChange={e => setInstitutionType(e.target.value as InstitutionType)}
                                        className={cn(
                                            "w-full h-11 px-4 rounded-xl border text-sm appearance-none outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-right",
                                            theme === 'light'
                                                ? "bg-white border-gray-300 text-gray-900 hover:bg-gray-50"
                                                : "bg-white/5 border-white/10 text-gray-100 hover:bg-white/10"
                                        )}
                                        dir="rtl"
                                    >
                                        <option value="college">كلية</option>
                                        <option value="school">إعدادية</option>
                                    </select>
                                    <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        {/* الصف الثالث: اسم المؤسسة + القسم (مع الإكمال التلقائي) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <AutocompleteField
                                label="اسم المؤسسة"
                                value={institutionName}
                                onChange={setInstitutionName}
                                suggestions={filteredInstitutions}
                                showDropdown={showInstitutionDropdown}
                                setShowDropdown={setShowInstitutionDropdown}
                                containerRef={institutionRef as React.RefObject<HTMLDivElement>}
                                placeholder="مثال: جامعة كربلاء"
                                theme={theme}
                            />
                            <AutocompleteField
                                label="القسم"
                                value={department}
                                onChange={setDepartment}
                                suggestions={filteredDepartments}
                                showDropdown={showDepartmentDropdown}
                                setShowDropdown={setShowDepartmentDropdown}
                                containerRef={departmentRef as React.RefObject<HTMLDivElement>}
                                placeholder="مثال: كهرباء، اتصالات، حاسبات"
                                theme={theme}
                            />
                        </div>

                        {/* الصف الرابع: التواريخ */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold block">
                                    <Calendar className="w-3.5 h-3.5 inline-block ml-1 opacity-60" />
                                    تاريخ المباشرة
                                </label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    className="text-right pr-4"
                                    dir="ltr"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold block">
                                    <Calendar className="w-3.5 h-3.5 inline-block ml-1 opacity-60" />
                                    تاريخ الانفكاك
                                </label>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                    className="text-right pr-4"
                                    dir="ltr"
                                />
                            </div>
                        </div>

                        {/* زر الإضافة */}
                        <button
                            onClick={handleAddStudent}
                            disabled={isSubmitting}
                            className={cn(
                                "w-full h-11 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2",
                                isSubmitting
                                    ? "bg-emerald-500/50 cursor-not-allowed"
                                    : "bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98]"
                            )}
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Plus className="w-4 h-4" />
                            )}
                            {isSubmitting ? 'جاري الإضافة...' : 'إضافة المتدرب'}
                        </button>
                    </div>

                    {/* ── قائمة الطلاب ── */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold block">
                            الطلبة المتدربون ({students.length})
                        </label>
                        <div className={cn(
                            "rounded-xl border min-h-[150px] max-h-[300px] overflow-y-auto custom-scrollbar p-2",
                            theme === 'light' ? "bg-gray-50 border-gray-200" : "bg-black/20 border-white/5"
                        )}>
                            {isLoadingStudents ? (
                                <div className="flex items-center justify-center h-32">
                                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                                </div>
                            ) : students.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground space-y-2">
                                    <GraduationCap className="w-8 h-8 opacity-20" />
                                    <span className="text-sm">لم يتم إضافة أي متدربين بعد</span>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {students.map(student => (
                                        <div
                                            key={student.id}
                                            className={cn(
                                                "flex flex-wrap sm:flex-nowrap items-center justify-between p-3 rounded-lg border gap-3",
                                                theme === 'light' ? "bg-white border-gray-200" : "bg-zinc-800/50 border-white/10"
                                            )}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="p-2 rounded-lg shrink-0 bg-emerald-500/20 text-emerald-500">
                                                    <User className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-sm truncate">{student.full_name}</p>
                                                        <span className={cn(
                                                            "px-1.5 py-0.5 text-[9px] font-bold rounded shrink-0 border",
                                                            "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                                        )}>
                                                            {INSTITUTION_TYPE_LABELS[student.institution_type]} 
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                        <div className="flex items-center gap-1">
                                                            <Building2 className="w-3 h-3 opacity-40" />
                                                            <p className="text-xs text-muted-foreground">{student.institution_name}</p>
                                                        </div>
                                                        <span className="w-1 h-1 rounded-full bg-border"></span>
                                                        <p className="text-xs text-muted-foreground">{student.department}</p>
                                                        {student.start_date && student.end_date && (
                                                            <>
                                                                <span className="w-1 h-1 rounded-full bg-border"></span>
                                                                <p className="text-[10px] text-muted-foreground font-mono" dir="ltr">
                                                                    {student.start_date} → {student.end_date}
                                                                </p>
                                                            </>
                                                        )}
                                                        {student.exam_grade && (
                                                            <>
                                                                <span className="w-1 h-1 rounded-full bg-border"></span>
                                                                <span className="text-[10px] font-bold text-emerald-500">
                                                                    {EXAM_GRADE_LABELS[student.exam_grade]}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    onClick={() => handleDeleteStudent(student)}
                                                    className={cn(
                                                        "p-2 rounded-lg text-red-500 hover:text-red-600 transition-colors border",
                                                        theme === 'light'
                                                            ? "hover:bg-red-50 border-red-200/50"
                                                            : "hover:bg-red-500/10 border-red-500/20"
                                                    )}
                                                    title="حذف المتدرب"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
