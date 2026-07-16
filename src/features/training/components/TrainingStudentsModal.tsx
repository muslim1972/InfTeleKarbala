import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Loader2, Trash2, GraduationCap, User, Plus, Building2, MapPin, UserCheck, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '../../../lib/utils';
import { useAuth } from '../../../context/AuthContext';
import { Input } from '../../../components/ui/Input';
import { useTrainingData } from '../hooks/useTrainingData';
import type { TrainingStudent } from '../types';
import { EXAM_GRADE_LABELS } from '../types';

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
 */
export const TrainingStudentsModal: React.FC<TrainingStudentsModalProps> = ({ onClose, theme }) => {
    const { user } = useAuth();
    const { createStudent, fetchStudents, deleteStudent, getAutocompleteSuggestions } = useTrainingData();

    // ── حالة النموذج ──
    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [institutionName, setInstitutionName] = useState('');
    const [trainingLocation, setTrainingLocation] = useState('');
    const [trainerName, setTrainerName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ── قائمة الطلاب ──
    const [students, setStudents] = useState<TrainingStudent[]>([]);
    const [isLoadingStudents, setIsLoadingStudents] = useState(true);

    // ── الإكمال التلقائي ──
    const [institutionSuggestions, setInstitutionSuggestions] = useState<string[]>([]);
    const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
    const [trainerSuggestions, setTrainerSuggestions] = useState<string[]>([]);
    const [showInstitutionDropdown, setShowInstitutionDropdown] = useState(false);
    const [showLocationDropdown, setShowLocationDropdown] = useState(false);
    const [showTrainerDropdown, setShowTrainerDropdown] = useState(false);
    const institutionRef = useRef<HTMLDivElement>(null);
    const locationRef = useRef<HTMLDivElement>(null);
    const trainerRef = useRef<HTMLDivElement>(null);

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
            if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
                setShowLocationDropdown(false);
            }
            if (trainerRef.current && !trainerRef.current.contains(e.target as Node)) {
                setShowTrainerDropdown(false);
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
        const [instData, locData, trainData] = await Promise.all([
            getAutocompleteSuggestions('institution_name'),
            getAutocompleteSuggestions('training_location'),
            getAutocompleteSuggestions('trainer_name'),
        ]);
        setInstitutionSuggestions(instData);
        setLocationSuggestions(locData);
        setTrainerSuggestions(trainData);
    };

    // ── تصفية الاقتراحات محلياً ──
    const filteredInstitutions = useMemo(() => {
        if (!institutionName.trim()) return institutionSuggestions;
        return institutionSuggestions.filter(s =>
            s.toLowerCase().includes(institutionName.toLowerCase())
        );
    }, [institutionName, institutionSuggestions]);

    const filteredLocations = useMemo(() => {
        if (!trainingLocation.trim()) return locationSuggestions;
        return locationSuggestions.filter(s =>
            s.toLowerCase().includes(trainingLocation.toLowerCase())
        );
    }, [trainingLocation, locationSuggestions]);

    const filteredTrainers = useMemo(() => {
        if (!trainerName.trim()) return trainerSuggestions;
        return trainerSuggestions.filter(s =>
            s.toLowerCase().includes(trainerName.toLowerCase())
        );
    }, [trainerName, trainerSuggestions]);


    // ── إضافة متدرب ──
    const handleAddStudent = async () => {
        if (!fullName.trim() || !password.trim()) {
            toast.error('يرجى إدخال الاسم الثلاثي وكلمة المرور');
            return;
        }
        if (!institutionName.trim()) {
            toast.error('يرجى إدخال اسم المؤسسة');
            return;
        }
        if (!trainingLocation.trim()) {
            toast.error('يرجى إدخال موقع التدريب');
            return;
        }
        if (!trainerName.trim()) {
            toast.error('يرجى إدخال اسم المدرب');
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await createStudent({
                full_name: fullName.trim(),
                username: fullName.trim(), // الاسم كاسم مستخدم
                password: password.trim(),
                institution_name: institutionName.trim(),
                training_location: trainingLocation.trim(),
                trainer_name: trainerName.trim(),
                supervisor_id: user?.id || '',
            });

            if (result.success) {
                toast.success(`تم إضافة المتدرب "${fullName.trim()}" بنجاح`);

                // إعادة تعيين النموذج (فقط الاسم والرمز)
                setFullName('');
                setPassword('');
                // نبقي المؤسسة وموقع التدريب واسم المدرب كما هي لتسهيل الإدخال المتكرر
                
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

                        {/* الصف الأول: الاسم الثلاثي + كلمة المرور / الرمز */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold block">
                                    الاسم الثلاثي <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                    placeholder="أدخل الاسم الثلاثي..."
                                    className="text-right"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold block">
                                    كلمة المرور (الرمز) <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="أدخل كلمة المرور أو الرمز"
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
                        </div>

                        {/* الصف الثاني: اسم المؤسسة + موقع التدريب */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <AutocompleteField
                                label="الجامعة او المعهد او الإعدادية"
                                value={institutionName}
                                onChange={setInstitutionName}
                                suggestions={filteredInstitutions}
                                showDropdown={showInstitutionDropdown}
                                setShowDropdown={setShowInstitutionDropdown}
                                containerRef={institutionRef as React.RefObject<HTMLDivElement>}
                                placeholder="مثال: اعدادية الحسين المهني"
                                theme={theme}
                            />
                            <AutocompleteField
                                label="موقع التدريب"
                                value={trainingLocation}
                                onChange={setTrainingLocation}
                                suggestions={filteredLocations}
                                showDropdown={showLocationDropdown}
                                setShowDropdown={setShowLocationDropdown}
                                containerRef={locationRef as React.RefObject<HTMLDivElement>}
                                placeholder="مثال: الشبكات / المركز"
                                theme={theme}
                            />
                        </div>

                        {/* الصف الثالث: اسم المدرب */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <AutocompleteField
                                label="اسم المدرب"
                                value={trainerName}
                                onChange={setTrainerName}
                                suggestions={filteredTrainers}
                                showDropdown={showTrainerDropdown}
                                setShowDropdown={setShowTrainerDropdown}
                                containerRef={trainerRef as React.RefObject<HTMLDivElement>}
                                placeholder="مثال: م.صبا جابر"
                                theme={theme}
                            />
                        </div>

                        {/* زر الإضافة */}
                        <button
                            onClick={handleAddStudent}
                            disabled={isSubmitting}
                            className={cn(
                                "w-full h-11 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2 mt-2",
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
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                        <div className="flex items-center gap-1">
                                                            <Building2 className="w-3 h-3 opacity-40" />
                                                            <p className="text-xs text-muted-foreground">{student.institution_name}</p>
                                                        </div>
                                                        <span className="w-1 h-1 rounded-full bg-border"></span>
                                                        <div className="flex items-center gap-1">
                                                            <MapPin className="w-3 h-3 opacity-40" />
                                                            <p className="text-xs text-muted-foreground">{student.training_location}</p>
                                                        </div>
                                                        <span className="w-1 h-1 rounded-full bg-border"></span>
                                                        <div className="flex items-center gap-1">
                                                            <UserCheck className="w-3 h-3 opacity-40" />
                                                            <p className="text-xs text-muted-foreground">{student.trainer_name}</p>
                                                        </div>
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
