// IncentivesTabContent v5 - محرك الحساب المركزي مع إصلاح التحميل من DB
import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { toast } from "react-hot-toast";
import { 
    Search, 
    User, 
    ShieldCheck, 
    Coins, 
    Loader2, 
    Save,
    ClipboardList,
    Check,
    X
} from "lucide-react";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/Select";


interface IncentiveRecord {
    id?: string;
    user_id: string;
    year: number;
    month: number;
    certificate_text: string;
    certificate_points: number;
    service_years: number;
    service_points: number;
    position_name: string;
    position_points: number;
    work_location_type: string;
    work_location_points: number;
    eval_commitment: number;
    eval_speed_accuracy: number;
    eval_initiative: number;
    eval_cooperation: number;
    eval_skills_development: number;
    is_project_manager: boolean;
    project_management_points: number;
    is_financial_legal: boolean;
    financial_legal_points: number;
    committees_count: number;
    committees_points: number;
    extraordinary_points: number;
    special_cases_points: number;
    penalty_days_deduction: number;
    unauthorized_absence_days: number;
    leaves_over_30_days: boolean;
    special_leaves_hajj_maternity: boolean;
    regular_leave_days: number;
    sick_leave_days: number;
    is_fully_suspended: boolean;
    deductions_points: number;
    total_points: number;
    calculated_incentive: number;
    status: string;
}

interface IncentivesTabContentProps {
    isAdminView?: boolean;
}

export const IncentivesTabContent = ({ isAdminView = false }: IncentivesTabContentProps) => {
    const { user: currentUser } = useAuth();
    const { theme } = useTheme();

    const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);

    // الصلاحيات
    const isDeveloperOrGeneral = (currentUser?.admin_role === 'developer' || currentUser?.admin_role === 'general') && isAdminView;
    const [isDepartmentManager, setIsDepartmentManager] = useState(false);

    // البحث والموظفون
    const [searchQuery, setSearchQuery] = useState("");
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searching, setSearching] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const searchRef = useRef<HTMLDivElement>(null);

    // قيمة النقطة لشهر وسنة معينة
    const [pointValue, setPointValue] = useState<number>(0);
    const [loadingPoint, setLoadingPoint] = useState(false);

    // سجل الحوافز الحالي
    const [incentiveData, setIncentiveData] = useState<IncentiveRecord | null>(null);
    const [saving, setSaving] = useState(false);
    const [loadingRecord, setLoadingRecord] = useState(false);

    // حالة التحكم بقيمة النقطة
    const [pointValInput, setPointValInput] = useState<number | "">("");
    const [savingPoint, setSavingPoint] = useState(false);

    // الفحص لمعرفة هل الموظف الحالي مدير قسم
    useEffect(() => {
        const checkManagerStatus = async () => {
            if (!currentUser) return;
            try {
                const { data, error } = await supabase
                    .rpc('get_departments_bypass_rls')
                    .select('id')
                    .eq('manager_id', currentUser.id)
                    .maybeSingle();
                
                if (error) console.error("Error checking manager status:", error);
                if (data) {
                    setIsDepartmentManager(true);
                }
            } catch (err) {
                console.error("Error checking manager status:", err);
            }
        };
        checkManagerStatus();
    }, [currentUser]);

    // جلب قيمة النقطة للشهر والسنة المحددين
    const fetchPointValue = async (yr: number, mth: number) => {
        setLoadingPoint(true);
        try {
            const { data, error } = await supabase
                .from('incentive_point_values')
                .select('point_value')
                .eq('year', yr)
                .eq('month', mth)
                .maybeSingle();
            
            if (error) console.error("Error fetching point value:", error);
            if (data) {
                setPointValue(Number(data.point_value));
                setPointValInput(Number(data.point_value));
            } else {
                setPointValue(0);
                setPointValInput("");
            }
        } catch (e) {
            console.error("Error fetching point value:", e);
        } finally {
            setLoadingPoint(false);
        }
    };

    const handleSavePoint = async () => {
        if (pointValInput === "") {
            toast.error("يرجى إدخال قيمة النقطة أولاً");
            return;
        }
        setSavingPoint(true);
        try {
            const { error } = await supabase
                .from('incentive_point_values')
                .upsert({
                    year: selectedYear,
                    month: selectedMonth,
                    point_value: Number(pointValInput),
                    updated_at: new Date().toISOString()
                }, { onConflict: 'year,month' });

            if (error) throw error;
            setPointValue(Number(pointValInput));
            toast.success("تم حفظ قيمة النقطة بنجاح");
        } catch (e: any) {
            console.error(e);
            toast.error("فشل الحفظ: " + e.message);
        } finally {
            setSavingPoint(false);
        }
    };

    const handleClearPoint = async () => {
        const confirmClear = window.confirm("هل تريد تفريغ قيمة النقطة لهذا الشهر؟");
        if (!confirmClear) return;
        
        setSavingPoint(true);
        try {
            const { error } = await supabase
                .from('incentive_point_values')
                .delete()
                .eq('year', selectedYear)
                .eq('month', selectedMonth);

            if (error) throw error;
            setPointValue(0);
            setPointValInput("");
            toast.success("تم تفريغ قيمة النقطة بنجاح");
        } catch (e: any) {
            console.error(e);
            toast.error("فشل تفريغ القيمة: " + e.message);
        } finally {
            setSavingPoint(false);
        }
    };

    useEffect(() => {
        fetchPointValue(selectedYear, selectedMonth);
    }, [selectedYear, selectedMonth]);

    // مزامنة احتساب الحافز المالي عند تغيير قيمة النقطة أو إجمالي النقاط
    useEffect(() => {
        if (incentiveData) {
            const newCalc = Math.ceil(incentiveData.total_points * pointValue);
            if (incentiveData.calculated_incentive !== newCalc) {
                setIncentiveData(prev => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        calculated_incentive: newCalc
                    };
                });
            }
        }
    }, [pointValue, incentiveData?.total_points]);

    // إغلاق مقترحات البحث عند النقر في الخارج
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // جلب مقترحات البحث المخصصة للمسؤول أو المشرف
    useEffect(() => {
        const fetchSuggestions = async () => {
            const trimmed = searchQuery.trim();
            if (!trimmed || !currentUser) {
                setSuggestions([]);
                return;
            }

            setSearching(true);
            try {
                if (isDeveloperOrGeneral) {
                    // المطور والمشرف العام يبحثون في جميع الموظفين
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('id, full_name, job_number, department_id, appointment_date')
                        .or(`job_number.ilike.${trimmed}%,full_name.ilike.${trimmed}%`)
                        .order('full_name')
                        .limit(10);
                    
                    if (error) console.error("Error fetching profiles:", error);
                    if (data) setSuggestions(data);
                } else if (isDepartmentManager) {
                    // المسؤول يبحث شجرياً بمنتسبي قسمه فقط
                    const { data, error } = await supabase
                        .rpc('get_managed_employees', { p_manager_id: currentUser.id });
                    
                    if (error) console.error("Error fetching managed employees:", error);
                    if (data) {
                        const filtered = data.filter((emp: any) => 
                            emp.full_name.includes(trimmed) || emp.job_number.startsWith(trimmed)
                        ).slice(0, 10);
                        setSuggestions(filtered);
                    }
                }
            } catch (err) {
                console.error("Error fetching suggestions:", err);
            } finally {
                setSearching(false);
            }
        };

        const timer = setTimeout(fetchSuggestions, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, currentUser, isDeveloperOrGeneral, isDepartmentManager]);

    // استنتاج المنصب الإداري ونقاطه من شجرة الأقسام
    const inferPositionDetails = async (empId: string) => {
        try {
            const { data: depts, error } = await supabase
                .rpc('get_departments_bypass_rls')
                .select('name, level')
                .eq('manager_id', empId);

            if (error) console.error("Error inferring position:", error);
            const deptArr = depts as any[]; if (deptArr && deptArr.length > 0) {
                // الموظف يدير قسماً، نأخذ المنصب المناسب لأعلى مستوى قسم يديره
                const sorted = [...deptArr].sort((a, b) => a.level - b.level); // الأقل رقماً هو الأعلى مستوى
                const topDept = sorted[0];
                
                let position_name = "";
                let position_points = 0;

                if (topDept.level === 1) {
                    position_name = "مدير المديرية";
                    position_points = 30;
                } else if (topDept.level === 2) {
                    position_name = "معاون مدير المديرية";
                    position_points = 25;
                } else if (topDept.level === 3) {
                    position_name = "مدير قسم خارج المقر او المحافظات";
                    position_points = 18;
                } else if (topDept.level === 4) {
                    position_name = "معاون مدير قسم او شعبة خارج المقر";
                    position_points = 12;
                } else {
                    position_name = `مسؤول إداري (${topDept.name})`;
                    position_points = 12;
                }
                return { position_name, position_points };
            }
        } catch (e) {
            console.error("Error inferring position:", e);
        }
        return { position_name: "", position_points: 0 };
    };

    // احتساب نقاط الشهادة
    const getCertificatePoints = (certText: string) => {
        if (!certText) return 6; // القيمة الافتراضية
        const t = certText.trim();
        if (t.includes('دكتوراه') || t.includes('ماجستير')) return 10;
        if (t.includes('دبلوم عالي') || t.includes('بكالوريوس') || t.includes('بكلوريوس')) return 9;
        if (t.includes('دبلوم') || t.includes('الاعدادية') || t.includes('إعدادية')) return 8;
        if (t.includes('المتوسطة') || t.includes('الابتدائية') || t.includes('ابتدائية')) return 7;
        return 6; // بدون شهادة أو غير ذلك
    };

    // احتساب سنوات الخدمة تلقائياً
    const calculateServiceYears = (appointmentDate: string) => {
        if (!appointmentDate) return 0;
        const appDate = new Date(appointmentDate);
        const today = new Date();
        let years = today.getFullYear() - appDate.getFullYear();
        const m = today.getMonth() - appDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < appDate.getDate())) {
            years--;
        }
        return Math.max(0, years);
    };

    // جلب أو تهيئة سجل حوافز الموظف
    const loadEmployeeIncentiveRecord = async (emp: any) => {
        setLoadingRecord(true);
        try {
            // 1. محاولة جلب سجل الحوافز المخزن مسبقاً لهذا الشهر والسنة
            const { data: record, error } = await supabase
                .from('incentive_records')
                .select('*')
                .eq('user_id', emp.id)
                .eq('year', selectedYear)
                .eq('month', selectedMonth)
                .maybeSingle();

            if (error) console.error("Error loading incentive record:", error);

            // جلب البيانات الديناميكية الحقيقية دائماً (سواء كان هناك سجل محفوظ أم لا)
            const { data: finData } = await supabase
                .from('financial_records')
                .select('certificate_text')
                .eq('user_id', emp.id)
                .maybeSingle();

            const certText = finData?.certificate_text || "بدون شهادة";
            const serviceYears = calculateServiceYears(emp.appointment_date);

            if (record) {
                // تحديث القيم الديناميكية في السجل المحفوظ (سنوات الخدمة والشهادة) 
                // لأنها قد تكون قديمة أو من تجارب سابقة
                console.log('[INCENTIVE-DEBUG] سجل محفوظ - القيم القديمة:', {
                    db_service_years: (record as any).service_years,
                    db_position_name: (record as any).position_name,
                    db_position_points: (record as any).position_points,
                });
                console.log('[INCENTIVE-DEBUG] القيم الديناميكية المحدثة:', {
                    fresh_service_years: serviceYears,
                    emp_appointment_date: emp.appointment_date,
                    fresh_cert: certText,
                });
                const refreshedRecord = {
                    ...(record as IncentiveRecord),
                    service_years: serviceYears,
                    certificate_text: certText,
                };
                // إعادة تشغيل محرك الحساب الكامل لضمان تناسق جميع القيم
                const calculatedData = calculateIncentivesLocally(refreshedRecord);
                console.log('[INCENTIVE-DEBUG] بعد الحساب المركزي:', {
                    final_service_years: calculatedData.service_years,
                    final_service_points: calculatedData.service_points,
                    final_position_name: calculatedData.position_name,
                    final_position_points: calculatedData.position_points,
                    final_total_points: calculatedData.total_points,
                });
                setIncentiveData(calculatedData);
            } else {
                // إذا لم يكن مسجلاً، نقوم بتهيئة السجل الجديد بالقيم التلقائية
                const certPoints = getCertificatePoints(certText);
                const servicePoints = Math.min(13, serviceYears * 0.5);

                // استنتاج المنصب الإداري ونقاطه
                const posDetails = await inferPositionDetails(emp.id);

                const initialData = {
                    user_id: emp.id,
                    year: selectedYear,
                    month: selectedMonth,
                    certificate_text: certText,
                    certificate_points: certPoints,
                    service_years: serviceYears,
                    service_points: servicePoints,
                    position_name: posDetails.position_name,
                    position_points: posDetails.position_points,
                    work_location_type: "لا ينطبق",
                    work_location_points: 0,
                    eval_commitment: 2,
                    eval_speed_accuracy: 2,
                    eval_initiative: 2,
                    eval_cooperation: 2,
                    eval_skills_development: 2,
                    is_project_manager: false,
                    project_management_points: 0,
                    is_financial_legal: false,
                    financial_legal_points: 0,
                    committees_count: 0,
                    committees_points: 0,
                    extraordinary_points: 0,
                    special_cases_points: 0,
                    penalty_days_deduction: 0,
                    unauthorized_absence_days: 0,
                    leaves_over_30_days: false,
                    special_leaves_hajj_maternity: false,
                    regular_leave_days: 0,
                    sick_leave_days: 0,
                    is_fully_suspended: false,
                    deductions_points: 0,
                    total_points: 0,
                    calculated_incentive: 0,
                    status: 'draft'
                };
                
                // احتساب القيم فوراً حتى لا يظهر 0 عند تحديد موظف لأول مرة
                const calculatedData = calculateIncentivesLocally(initialData as any);
                setIncentiveData(calculatedData);
            }
        } catch (e) {
            console.error("Error loading incentive record:", e);
            toast.error("حدث خطأ أثناء تحميل سجل الحوافز");
        } finally {
            setLoadingRecord(false);
        }
    };

    // عند تغيير الموظف المختار
    const handleSelectEmployee = (emp: any) => {
        setSelectedEmployee(emp);
        setSearchQuery(emp.full_name);
        setShowSuggestions(false);
        loadEmployeeIncentiveRecord(emp);
    };

    // إعادة احتساب الحوافز محلياً
    const calculateIncentivesLocally = (data: IncentiveRecord): IncentiveRecord => {
        const newData = { ...data };

        // 1. حساب الخدمة الوظيفية (بدون تقريب هنا، التقريب في النهاية فقط)
        newData.service_points = Math.min(13, newData.service_years * 0.5);

        // 2. حساب نقاط الشهادة
        newData.certificate_points = getCertificatePoints(newData.certificate_text);

        // 2.5 استنتاج نقاط المنصب ديناميكياً
        let posPts = 0;
        const pos = newData.position_name;
        if (pos === "المدير العام") posPts = 50;
        else if (pos === "المعاون") posPts = 45;
        else if (pos === "عضو مجلس الادارة") posPts = 35;
        else if (pos === "مدير المديرية") posPts = 30;
        else if (pos === "معاون مدير المديرية") posPts = 25;
        else if (pos === "مدير القسم في مقر الشركة") posPts = 20;
        else if (pos === "معاون مدير قسم او مسؤول شعبة في الشركة / اقسام نوعية") posPts = 20;
        else if (pos === "مدير قسم خارج المقر او المحافظات") posPts = 18;
        else if (pos === "معاون مدير قسم او شعبة خارج المقر") posPts = 12;
        newData.position_points = posPts;

        // 2.6 استنتاج نقاط موقع العمل ديناميكياً
        let locPts = 0;
        const loc = newData.work_location_type;
        if (loc === "مقر الشركة والمديريات التخصصية والتخطيط") locPts = 15;
        else if (loc === "مقرات المديريات والأقسام خارج المقر الرئيس") locPts = 10;
        else if (loc === "موقع يبعد 40 كم فأكثر عن السكن") locPts = 10;
        else if (loc === "مراكز السيطرة والتشغيل") locPts = 30;
        newData.work_location_points = locPts;

        // 3. حساب اللجان
        newData.committees_points = Math.min(15, newData.committees_count * 5);

        // 3.5 نقاط المشاريع والتخصص المالي من الأعلام (flags)
        newData.project_management_points = newData.is_project_manager ? 10 : 0;
        newData.financial_legal_points = newData.is_financial_legal ? 5 : 0;
        
        // 4. مجموع نقاط المعيار الوظيفي الإجمالي
        const evaluationTotal = 
            Number(newData.eval_commitment) + 
            Number(newData.eval_speed_accuracy) + 
            Number(newData.eval_initiative) + 
            Number(newData.eval_cooperation) + 
            Number(newData.eval_skills_development);

        const basePoints = 
            Number(newData.certificate_points) + 
            Number(newData.service_points) + 
            Number(newData.position_points) + 
            Number(newData.work_location_points) + 
            evaluationTotal + 
            Number(newData.project_management_points) + 
            Number(newData.financial_legal_points) + 
            Number(newData.committees_points) + 
            Number(newData.extraordinary_points) + 
            Number(newData.special_cases_points);

        // 5. حساب الخصومات والأيام
        // استقطاع الإجازات الاعتيادية والمرضية حسب الأيام عدا 3 أيام في الشهر
        const regularDeductDays = Math.max(0, newData.regular_leave_days - 3);
        const sickDeductDays = Math.max(0, newData.sick_leave_days - 3);
        
        // غياب بدون عذر (يحجب 3 أضعاف)
        const absenceDeductDays = newData.unauthorized_absence_days * 3;

        // إجمالي أيام الخصم
        const totalDeductedDays = 
            Number(newData.penalty_days_deduction) + 
            regularDeductDays + 
            sickDeductDays + 
            absenceDeductDays;

        // احتساب نقاط الخصم: (النقاط الأساسية / 30 يوماً) * إجمالي أيام الخصم
        let deductions = (basePoints / 30) * totalDeductedDays;
        
        // التقريب لأقرب مرتبة عشرية
        deductions = Math.round(deductions * 100) / 100;
        newData.deductions_points = deductions;

        // 6. الحجب الكامل في الحالات الخاصة
        let finalPoints = basePoints - deductions;
        if (newData.is_fully_suspended || newData.leaves_over_30_days || newData.special_leaves_hajj_maternity) {
            finalPoints = 0;
        }

        // التقريب للأعلى للحصول على رقم صحيح دائمًا
        newData.total_points = Math.max(0, Math.ceil(finalPoints));
        
        // تعديل نقاط الخصم الظاهرة لتكون مطابقة تماماً للمجموع (لإخفاء الكسور عن المستخدم)
        newData.deductions_points = basePoints - newData.total_points;
        
        // 7. الحساب المالي (التقريب للأعلى لمنع الكسور في المبالغ المالية)
        newData.calculated_incentive = Math.ceil(newData.total_points * pointValue);

        return newData;
    };

    // تغيير الحقول يدوياً
    const handleFieldChange = (key: keyof IncentiveRecord, value: any) => {
        if (!incentiveData) return;
        
        let updatedData = { ...incentiveData, [key]: value };

        // تحديث نقاط الشهادة تلقائياً إذا تم تغيير النص
        if (key === 'certificate_text') {
            updatedData.certificate_points = getCertificatePoints(value);
        }

        // تحديث نقاط موقع العمل
        if (key === 'work_location_type') {
            let pts = 0;
            if (value === "مقر الشركة والمديريات التخصصية والتخطيط") pts = 15;
            else if (value === "مقرات المديريات والأقسام خارج المقر الرئيس") pts = 10;
            else if (value === "موقع يبعد 40 كم فأكثر عن السكن") pts = 10;
            else if (value === "مراكز السيطرة والتشغيل") pts = 30;
            updatedData.work_location_points = pts;
        }

        // تحديث نقاط اللجان
        if (key === 'committees_count') {
            updatedData.committees_points = Math.min(15, Number(value) * 5);
        }

        // تحديث نقاط المشاريع
        if (key === 'is_project_manager') {
            updatedData.project_management_points = value ? 10 : 0;
        }

        // تحديث نقاط التخصص المالي والقانوني
        if (key === 'is_financial_legal') {
            updatedData.financial_legal_points = value ? 5 : 0;
        }

        // إعادة الاحتساب التلقائي
        const calculated = calculateIncentivesLocally(updatedData);
        setIncentiveData(calculated);
    };

    // حفظ السجل في قاعدة البيانات
    const handleSaveIncentives = async (statusToSave: 'draft' | 'approved') => {
        if (!incentiveData || !selectedEmployee || !currentUser) return;
        
        setSaving(true);
        try {
            const latestCalculatedIncentive = Math.ceil(incentiveData.total_points * pointValue);
            const payload = {
                ...incentiveData,
                calculated_incentive: latestCalculatedIncentive,
                status: statusToSave,
                created_by: currentUser.id,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('incentive_records')
                .upsert(payload, { onConflict: 'user_id,year,month' });

            if (error) throw error;

            toast.success(statusToSave === 'approved' ? "تم اعتماد حوافز الموظف بنجاح" : "تم حفظ المسودة بنجاح");
            
            // تحديث البيانات المحلية
            setIncentiveData(payload);
        } catch (e: any) {
            console.error("Error saving incentives:", e);
            toast.error("فشل في حفظ الحوافز: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    // جلب حوافز الموظف العادي (للقراءة فقط) عند تحميل الصفحة
    const [userRecord, setUserRecord] = useState<any>(null);
    const [loadingUserRecord, setLoadingUserRecord] = useState(false);

    useEffect(() => {
        // إذا كان الموظف عادياً (مستخدم) وليس له صلاحيات إدخال، نجلب حوافزه لشهر وسنة محددين تلقائياً
        const loadOwnIncentives = async () => {
            if (isDeveloperOrGeneral || isDepartmentManager || !currentUser) return;
            setLoadingUserRecord(true);
            try {
                const { data, error } = await supabase
                    .from('incentive_records')
                    .select('*')
                    .eq('user_id', currentUser.id)
                    .eq('year', selectedYear)
                    .eq('month', selectedMonth)
                    .maybeSingle();

                if (error) console.error("Error fetching own incentives:", error);
                setUserRecord(data);
            } catch (err) {
                console.error("Error fetching own incentives:", err);
            } finally {
                setLoadingUserRecord(false);
            }
        };

        loadOwnIncentives();
    }, [currentUser, selectedYear, selectedMonth, isDeveloperOrGeneral, isDepartmentManager]);

    // عرض شاشة الموظف العادي (للقراءة فقط)
    if (!isDeveloperOrGeneral && !isDepartmentManager) {
        return (
            <div className={`rounded-2xl border p-6 backdrop-blur-md ${theme === 'light' ? 'bg-white/60 border-gray-200' : 'bg-slate-950/60 border-white/10'}`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b pb-4">
                    <div>
                        <h2 className={`text-lg md:text-xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>كشف حوافز: {currentUser?.full_name}</h2>
                        <p className="text-xs text-muted-foreground mt-1">تفاصيل احتساب النقاط والحافز المالي لشهر {selectedMonth} / {selectedYear}</p>
                    </div>

                    <div className="flex gap-2">
                        <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                            <SelectTrigger className="w-24">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {[2025, 2026, 2027].map(yr => (
                                    <SelectItem key={yr} value={yr.toString()}>{yr}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
                            <SelectTrigger className="w-28">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(mth => (
                                    <SelectItem key={mth} value={mth.toString()}>شهر {mth}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* قيمة النقطة */}
                <div className={`mb-6 p-4 rounded-xl border flex items-center justify-between ${theme === 'light' ? 'bg-blue-50/50 border-blue-200/50' : 'bg-blue-950/10 border-blue-900/20'}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                            <Coins className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-xs text-muted-foreground">قيمة النقطة الواحدة لهذا الشهر</span>
                            <div className={`text-lg font-extrabold ${theme === 'light' ? 'text-blue-900' : 'text-blue-300'}`}>
                                {loadingPoint ? <Loader2 className="w-4 h-4 animate-spin inline ml-2" /> : pointValue.toLocaleString()} د.ع
                            </div>
                        </div>
                    </div>
                </div>

                {loadingUserRecord ? (
                    <div className="py-20 flex justify-center w-full">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-green" />
                    </div>
                ) : userRecord ? (
                    <div className="space-y-6">
                        {/* النتيجة النهائية المدمجة */}
                        <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-4 ${theme === 'light' ? 'bg-gradient-to-l from-emerald-50 to-white border-emerald-200 shadow-sm' : 'bg-gradient-to-l from-emerald-950/30 to-slate-900/50 border-emerald-900/30'}`}>
                            
                            <div className="flex items-center gap-4 flex-1">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${theme === 'light' ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-900/50 text-emerald-400'}`}>
                                    <span className="text-xl font-bold">{userRecord.total_points}</span>
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-emerald-800 dark:text-emerald-300">مجموع النقاط المستحقة</div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5">بعد استقطاع {userRecord.deductions_points} نقاط</div>
                                </div>
                            </div>
                            
                            <div className="h-10 w-px bg-emerald-200 dark:bg-emerald-900/50 hidden md:block"></div>

                            <div className="flex items-center justify-between gap-4 flex-1 w-full md:w-auto">
                                <div className="text-right">
                                    <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mb-0.5">مبلغ الحافز المالي النهائي</div>
                                    <div className={`text-2xl font-black ${theme === 'light' ? 'text-emerald-950' : 'text-emerald-100'}`}>
                                        {(userRecord.calculated_incentive || Math.ceil(userRecord.total_points * pointValue)).toLocaleString()} <span className="text-sm font-normal">د.ع</span>
                                    </div>
                                </div>
                                <span className={`text-[10px] px-3 py-1 rounded-full font-bold whitespace-nowrap ${userRecord.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                                    {userRecord.status === 'approved' ? 'مصدق ومعتمد' : 'مسودة'}
                                </span>
                            </div>

                        </div>

                        {/* تفاصيل المعايير */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className={`p-4 rounded-xl border ${theme === 'light' ? 'bg-gray-50/50' : 'bg-white/5'}`}>
                                <h3 className="font-bold text-sm mb-3">تفاصيل النقاط الأساسية</h3>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between"><span>التحصيل العلمي ({userRecord.certificate_text}):</span><span className="font-bold">{userRecord.certificate_points} نقاط</span></div>
                                    <div className="flex justify-between"><span>الخدمة الوظيفية ({userRecord.service_years} سنة):</span><span className="font-bold">{userRecord.service_points} نقاط</span></div>
                                    <div className="flex justify-between"><span>المنصب الإداري ({userRecord.position_name || 'لا يوجد'}):</span><span className="font-bold">{userRecord.position_points} نقاط</span></div>
                                    <div className="flex justify-between"><span>موقع العمل ({userRecord.work_location_type}):</span><span className="font-bold">{userRecord.work_location_points} نقاط</span></div>
                                </div>
                            </div>

                            <div className={`p-4 rounded-xl border ${theme === 'light' ? 'bg-gray-50/50' : 'bg-white/5'}`}>
                                <h3 className="font-bold text-sm mb-3">التقييم واللجان والإضافات</h3>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between"><span>مجموع نقاط تقييم المسؤول:</span><span className="font-bold">{(userRecord.eval_commitment + userRecord.eval_speed_accuracy + userRecord.eval_initiative + userRecord.eval_cooperation + userRecord.eval_skills_development)} / 10 نقاط</span></div>
                                    <div className="flex justify-between"><span>إدارة المشاريع (مهندس عقد/مدير مشروع):</span><span className="font-bold">{userRecord.project_management_points} نقاط</span></div>
                                    <div className="flex justify-between"><span>تخصص مالي وقانوني وعقود وتدقيق:</span><span className="font-bold">{userRecord.financial_legal_points} نقاط</span></div>
                                    <div className="flex justify-between"><span>المشاركة في اللجان ({userRecord.committees_count} لجان):</span><span className="font-bold">{userRecord.committees_points} نقاط</span></div>
                                    <div className="flex justify-between"><span>حوافز استثنائية من المدير العام:</span><span className="font-bold">{userRecord.extraordinary_points} نقاط</span></div>
                                    <div className="flex justify-between"><span>النقاط الإضافية للأمراض المستعصية:</span><span className="font-bold">{userRecord.special_cases_points} نقاط</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-16 text-muted-foreground">
                        <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">لم يقم المسؤول باحتساب حوافزك لهذا الشهر بعد.</p>
                    </div>
                )}
            </div>
        );
    }

    // عرض واجهة الإدخال والاحتساب للمسؤولين والمشرفين والمطور
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full px-2 md:container md:mx-auto items-start pb-20">
            {/* الجزء الأيمن: البحث واختيار الموظف وقيمة النقطة */}
            <div className="lg:col-span-1 space-y-6 relative z-30">
                
                {/* قيمة النقطة لهذا الشهر - تظهر للمطور والمشرف العام فقط */}
                {isDeveloperOrGeneral && (
                    <div className={`p-5 rounded-2xl border backdrop-blur-md ${theme === 'light' ? 'bg-white/60 border-gray-200' : 'bg-slate-950/60 border-white/10'}`}>
                        <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-brand-green"><Coins className="w-4 h-4" /> إعداد قيمة النقطة الواحدة</h3>
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                                    <SelectTrigger className="flex-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[2025, 2026, 2027].map(yr => (
                                            <SelectItem key={yr} value={yr.toString()}>{yr}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
                                    <SelectTrigger className="flex-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(mth => (
                                            <SelectItem key={mth} value={mth.toString()}>شهر {mth}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className={`p-4 rounded-xl border flex items-center justify-between ${theme === 'light' ? 'bg-blue-50/50 border-blue-200/50' : 'bg-blue-950/10 border-blue-900/20'}`}>
                                <div className="w-full space-y-3">
                                    <span className="text-[10px] text-muted-foreground block font-bold">تحديد القيمة المعتمدة للشهر المختار:</span>
                                    <div className="flex flex-wrap items-center gap-2 w-full">
                                        <div className="relative flex-1 min-w-[120px]">
                                            <Input
                                                type="number"
                                                placeholder="القيمة..."
                                                value={pointValInput}
                                                onChange={(e) => setPointValInput(e.target.value === "" ? "" : Number(e.target.value))}
                                                className="no-spin pl-8 text-sm font-bold font-mono"
                                                disabled={loadingPoint || savingPoint}
                                            />
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">د.ع</span>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleSavePoint}
                                            disabled={loadingPoint || savingPoint}
                                            className="p-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl shadow-md transition active:scale-95 flex items-center justify-center shrink-0"
                                            title="حفظ القيمة"
                                        >
                                            {savingPoint ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleClearPoint}
                                            disabled={loadingPoint || savingPoint}
                                            className="p-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-md transition active:scale-95 flex items-center justify-center shrink-0"
                                            title="تفريغ الحقل"
                                        >
                                            <X className="w-4 h-4 stroke-[3]" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* البحث عن الموظفين */}
                <div className={`p-5 rounded-2xl border backdrop-blur-md ${theme === 'light' ? 'bg-white/60 border-gray-200' : 'bg-slate-950/60 border-white/10'}`}>
                    <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><User className="w-4 h-4" /> اختيار الموظف</h3>
                    
                    <div className="relative overflow-visible" ref={searchRef}>
                        <div className="relative">
                            <Search className="w-4 h-4 text-gray-400 absolute right-3 top-3" />
                            <input
                                type="text"
                                placeholder="ابحث بالاسم أو الرقم الوظيفي..."
                                value={searchQuery}
                                onChange={e => {
                                    setSearchQuery(e.target.value);
                                    setShowSuggestions(true);
                                }}
                                className={`w-full pr-9 pl-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green/30 transition-all ${
                                    theme === 'light' ? 'bg-white text-black border-gray-200' : 'bg-white/5 text-white border-white/10'
                                }`}
                            />
                            {searching && (
                                <Loader2 className="w-4 h-4 animate-spin text-brand-green absolute left-3 top-3" />
                            )}
                        </div>

                        {showSuggestions && suggestions.length > 0 && (
                            <div className={`absolute z-50 w-full mt-2 rounded-xl border shadow-xl overflow-hidden backdrop-blur-md max-h-60 overflow-y-auto ${
                                theme === 'light' ? 'bg-white border-gray-100' : 'bg-slate-900 border-white/5'
                            }`}>
                                {suggestions.map(sug => (
                                    <button
                                        key={sug.id}
                                        onClick={() => handleSelectEmployee(sug)}
                                        className={`w-full text-right px-4 py-2.5 flex items-center justify-between border-b last:border-0 text-xs transition-colors ${
                                            theme === 'light' ? 'hover:bg-gray-50 border-gray-100 text-gray-800' : 'hover:bg-white/5 border-white/5 text-gray-200'
                                        }`}
                                    >
                                        <div>
                                            <div className="font-bold">{sug.full_name}</div>
                                            <div className="text-[10px] text-muted-foreground">{sug.job_number}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* الجزء الأيسر: استعراض الحوافز واحتسابها للموظف المختار */}
            <div className="lg:col-span-2">
                {loadingRecord ? (
                    <div className={`p-20 flex justify-center items-center rounded-2xl border backdrop-blur-md ${theme === 'light' ? 'bg-white/60' : 'bg-slate-950/60'}`}>
                        <Loader2 className="w-8 h-8 animate-spin text-brand-green" />
                    </div>
                ) : selectedEmployee && incentiveData ? (
                    <div className={`p-6 rounded-2xl border space-y-6 backdrop-blur-md ${theme === 'light' ? 'bg-white/60 border-gray-200' : 'bg-slate-950/60 border-white/10'}`}>
                        
                        {/* ترويسة معلومات الموظف */}
                        <div className="flex justify-between items-start border-b pb-4">
                            <div>
                                <h2 className="font-bold text-lg">{selectedEmployee.full_name}</h2>
                                <p className="text-xs text-muted-foreground mt-1">الرقم الوظيفي: {selectedEmployee.job_number}</p>
                            </div>
                            <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${incentiveData.status === 'approved' ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                {incentiveData.status === 'approved' ? 'معتمد ومصدق' : 'مسودة'}
                            </span>
                        </div>

                        {/* ملخص احتساب النقاط والمبلغ النهائي */}
                        <div className={`p-5 rounded-2xl border grid grid-cols-1 md:grid-cols-2 gap-4 ${theme === 'light' ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-br from-green-950/20 to-emerald-950/10 border-green-900/30'}`}>
                            <div className="flex flex-col justify-center items-center border-l border-dashed border-green-200 dark:border-green-900/30 p-2">
                                <span className="text-[11px] text-emerald-800/80 dark:text-emerald-400/80 font-bold mb-1">مجموع النقاط المستحقة للموظف</span>
                                <span className={`text-4xl font-extrabold ${theme === 'light' ? 'text-emerald-900' : 'text-emerald-200'}`}>{incentiveData.total_points}</span>
                                <span className="text-[10px] text-muted-foreground mt-1">(بعد خصم {incentiveData.deductions_points} نقاط)</span>
                            </div>
                            <div className="flex flex-col justify-center items-center p-2">
                                <span className="text-[11px] text-emerald-800/80 dark:text-emerald-400/80 font-bold mb-1">الحافز المالي المستحق</span>
                                <span className={`text-2xl font-black ${theme === 'light' ? 'text-emerald-950' : 'text-emerald-100'}`}>{incentiveData.calculated_incentive?.toLocaleString()} د.ع</span>
                                <span className="text-[9px] text-muted-foreground mt-1">(النقاط الكلية * {pointValue} د.ع قيمة النقطة)</span>
                            </div>
                        </div>

                        {/* 1. حقول المعيار الوظيفي الأساسي */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-xs text-brand-green border-b pb-1">1. المعيار الوظيفي الأساسي (للقراءة والتعديل)</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* التحصيل العلمي */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-muted-foreground">التحصيل العلمي</label>
                                    <Select value={incentiveData.certificate_text} onValueChange={(val) => handleFieldChange('certificate_text', val)}>
                                        <SelectTrigger className="w-full text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {['دكتوراه', 'ماجستير', 'دبلوم عالي', 'بكالوريوس', 'دبلوم', 'الاعدادية', 'المتوسطة', 'الابتدائية', 'يقرأ ويكتب', 'أمي'].map(cert => (
                                                <SelectItem key={cert} value={cert}>{cert}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <span className="text-[10px] text-brand-green font-bold">النقاط المستحقة: {incentiveData.certificate_points} نقاط</span>
                                </div>

                                {/* الخدمة الوظيفية */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-muted-foreground">الخدمة الوظيفية (سنوات)</label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={incentiveData.service_years}
                                        onChange={(e) => handleFieldChange('service_years', parseFloat(e.target.value) || 0)}
                                        className="text-xs"
                                    />
                                    <span className="text-[10px] text-brand-green font-bold">النقاط المستحقة: {incentiveData.service_points} نقاط (حد أقصى 13)</span>
                                </div>

                                {/* المنصب الإداري */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-muted-foreground">المنصب الإداري (المستوى الوظيفي)</label>
                                    <Select value={incentiveData.position_name || "لا يوجد"} onValueChange={(val) => {
                                        handleFieldChange('position_name', val === "لا يوجد" ? "" : val);
                                    }}>
                                        <SelectTrigger className="w-full text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {["لا يوجد", "المدير العام", "المعاون", "عضو مجلس الادارة", "مدير المديرية", "معاون مدير المديرية", "مدير القسم في مقر الشركة", "معاون مدير قسم او مسؤول شعبة في الشركة / اقسام نوعية", "مدير قسم خارج المقر او المحافظات", "معاون مدير قسم او شعبة خارج المقر"].map(pos => (
                                                <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <span className="text-[10px] text-brand-green font-bold">النقاط المستحقة: {incentiveData.position_points} نقاط</span>
                                </div>

                                {/* موقع العمل الجغرافي */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-muted-foreground">موقع العمل الجغرافي</label>
                                    <Select value={incentiveData.work_location_type} onValueChange={(val) => handleFieldChange('work_location_type', val)}>
                                        <SelectTrigger className="w-full text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {["لا ينطبق", "مقر الشركة والمديريات التخصصية والتخطيط", "مقرات المديريات والأقسام خارج المقر الرئيس", "موقع يبعد 40 كم فأكثر عن السكن", "مراكز السيطرة والتشغيل"].map(loc => (
                                                <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <span className="text-[10px] text-brand-green font-bold">النقاط المستحقة: {incentiveData.work_location_points} نقاط</span>
                                </div>
                            </div>
                        </div>

                        {/* 2. تقييم المسؤول المباشر */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-xs text-brand-green border-b pb-1">2. تقييم المسؤول المباشر (الحد الأقصى 10 نقاط)</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted-foreground">الالتزام بساعات العمل الفعلية (0-2)</label>
                                    <Input
                                        type="number"
                                        min="0" max="2" step="0.5"
                                        value={incentiveData.eval_commitment === 0 ? "" : incentiveData.eval_commitment}
                                        onChange={(e) => handleFieldChange('eval_commitment', Math.min(2, Math.max(0, parseFloat(e.target.value) || 0)))}
                                        className="text-xs"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted-foreground">سرعة ودقة إنجاز المهام (0-2)</label>
                                    <Input
                                        type="number"
                                        min="0" max="2" step="0.5"
                                        value={incentiveData.eval_speed_accuracy === 0 ? "" : incentiveData.eval_speed_accuracy}
                                        onChange={(e) => handleFieldChange('eval_speed_accuracy', Math.min(2, Math.max(0, parseFloat(e.target.value) || 0)))}
                                        className="text-xs"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted-foreground">المبادرة وتصدي للمهام (0-2)</label>
                                    <Input
                                        type="number"
                                        min="0" max="2" step="0.5"
                                        value={incentiveData.eval_initiative === 0 ? "" : incentiveData.eval_initiative}
                                        onChange={(e) => handleFieldChange('eval_initiative', Math.min(2, Math.max(0, parseFloat(e.target.value) || 0)))}
                                        className="text-xs"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted-foreground">التعاون والعمل الجماعي (0-2)</label>
                                    <Input
                                        type="number"
                                        min="0" max="2" step="0.5"
                                        value={incentiveData.eval_cooperation === 0 ? "" : incentiveData.eval_cooperation}
                                        onChange={(e) => handleFieldChange('eval_cooperation', Math.min(2, Math.max(0, parseFloat(e.target.value) || 0)))}
                                        className="text-xs"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted-foreground">تطوير المهارات والأفكار (0-2)</label>
                                    <Input
                                        type="number"
                                        min="0" max="2" step="0.5"
                                        value={incentiveData.eval_skills_development === 0 ? "" : incentiveData.eval_skills_development}
                                        onChange={(e) => handleFieldChange('eval_skills_development', Math.min(2, Math.max(0, parseFloat(e.target.value) || 0)))}
                                        className="text-xs"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 3. إضافات الحوافز الاستثنائية واللجان والتكليفات */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-xs text-brand-green border-b pb-1">3. التكليفات واللجان والحوافز الخاصة</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    {/* مهندس عقد أو مدير مشروع */}
                                    <div className="flex items-center justify-between p-2.5 rounded-lg border">
                                        <div className="text-xs">
                                            <span className="font-bold block">إدارة المشاريع وعقود المهندسين</span>
                                            <span className="text-[10px] text-muted-foreground">تمنح 10 نقاط لمسؤولية الإشراف والمشروع.</span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={incentiveData.is_project_manager}
                                            onChange={(e) => handleFieldChange('is_project_manager', e.target.checked)}
                                            className="w-4 h-4 rounded text-brand-green focus:ring-brand-green"
                                        />
                                    </div>

                                    {/* موظف تخصصي مالي وقانوني وعقود وتدقيق */}
                                    <div className="flex items-center justify-between p-2.5 rounded-lg border">
                                        <div className="text-xs">
                                            <span className="font-bold block">موظف تخصصي (مالي/قانوني/تدقيق)</span>
                                            <span className="text-[10px] text-muted-foreground">يمنح 5 نقاط لحملة العناوين المالية والقانونية والرقابة.</span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={incentiveData.is_financial_legal}
                                            onChange={(e) => handleFieldChange('is_financial_legal', e.target.checked)}
                                            className="w-4 h-4 rounded text-brand-green focus:ring-brand-green"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {/* عدد اللجان المشارك بها */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-muted-foreground">المشاركة في اللجان (من 0 إلى 3)</label>
                                        <Input
                                            type="number"
                                            min="0" max="3"
                                            value={incentiveData.committees_count === 0 ? "" : incentiveData.committees_count}
                                            onChange={(e) => handleFieldChange('committees_count', Math.min(3, Math.max(0, parseInt(e.target.value) || 0)))}
                                            className="text-xs"
                                        />
                                        <span className="text-[10px] text-brand-green font-bold">نقاط اللجان المستحقة: {incentiveData.committees_points} نقاط</span>
                                    </div>

                                    {/* حوافز المدير العام وحالات المرضى */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-muted-foreground">حوافز متميزة للمدير العام (0-10)</label>
                                            <Input
                                                type="number"
                                                min="0" max="10"
                                                value={incentiveData.extraordinary_points === 0 ? "" : incentiveData.extraordinary_points}
                                                onChange={(e) => handleFieldChange('extraordinary_points', Math.min(10, Math.max(0, parseFloat(e.target.value) || 0)))}
                                                className="text-xs"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-muted-foreground">نقاط الأمراض المستعصية (0-10)</label>
                                            <Input
                                                type="number"
                                                min="0" max="10"
                                                value={incentiveData.special_cases_points === 0 ? "" : incentiveData.special_cases_points}
                                                onChange={(e) => handleFieldChange('special_cases_points', Math.min(10, Math.max(0, parseFloat(e.target.value) || 0)))}
                                                className="text-xs"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 4. الخصومات والاستقطاعات الرقمية */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-xs text-rose-500 border-b pb-1">4. الخصومات والاستقطاعات الرقمية (تطرح من الحافز)</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* أيام العقوبات */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-muted-foreground">أيام حجب العقوبات خلال الشهر</label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={incentiveData.penalty_days_deduction === 0 ? "" : incentiveData.penalty_days_deduction}
                                        onChange={(e) => handleFieldChange('penalty_days_deduction', Math.max(0, parseInt(e.target.value) || 0))}
                                        placeholder="لفت نظر 30، انذار 60، إلخ"
                                        className="text-xs"
                                    />
                                </div>

                                {/* غياب بدون عذر */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-muted-foreground">أيام الغياب بدون عذر مشروع</label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={incentiveData.unauthorized_absence_days === 0 ? "" : incentiveData.unauthorized_absence_days}
                                        onChange={(e) => handleFieldChange('unauthorized_absence_days', Math.max(0, parseInt(e.target.value) || 0))}
                                        className="text-xs"
                                    />
                                    <span className="text-[9px] text-rose-500 font-bold block mt-1">(تُخصم 3 أضعاف النقاط اليومية)</span>
                                </div>

                                {/* أيام إجازة اعتيادية */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-muted-foreground">إجازات اعتيادية براتب تام (أيام)</label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={incentiveData.regular_leave_days === 0 ? "" : incentiveData.regular_leave_days}
                                        onChange={(e) => handleFieldChange('regular_leave_days', Math.max(0, parseInt(e.target.value) || 0))}
                                        className="text-xs"
                                    />
                                    <span className="text-[9px] text-muted-foreground block mt-1">(تستقطع عدا 3 أيام في الشهر)</span>
                                </div>

                                {/* أيام إجازة مرضية */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-muted-foreground">إجازات مرضية خلال الشهر (أيام)</label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={incentiveData.sick_leave_days === 0 ? "" : incentiveData.sick_leave_days}
                                        onChange={(e) => handleFieldChange('sick_leave_days', Math.max(0, parseInt(e.target.value) || 0))}
                                        className="text-xs"
                                    />
                                    <span className="text-[9px] text-muted-foreground block mt-1">(تستقطع عدا 3 أيام عدا المستعصية)</span>
                                </div>

                                {/* إجازات وحجب كامل */}
                                <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-2 pt-4">
                                    <div className="flex items-center justify-between p-2 rounded border">
                                        <span className="text-xs font-bold text-rose-500">حجب كامل (إجازة &gt; 30 يوماً)</span>
                                        <input
                                            type="checkbox"
                                            checked={incentiveData.leaves_over_30_days}
                                            onChange={(e) => handleFieldChange('leaves_over_30_days', e.target.checked)}
                                            className="w-4 h-4 rounded text-rose-500 focus:ring-rose-500"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-2 rounded border">
                                        <span className="text-xs font-bold text-rose-500">حجب كامل (أمومة/حج/دراسة)</span>
                                        <input
                                            type="checkbox"
                                            checked={incentiveData.special_leaves_hajj_maternity}
                                            onChange={(e) => handleFieldChange('special_leaves_hajj_maternity', e.target.checked)}
                                            className="w-4 h-4 rounded text-rose-500 focus:ring-rose-500"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-2 rounded border col-span-2">
                                        <span className="text-xs font-bold text-rose-500">توقيف/سجن/حبس/سحب يد/فصل/عزل</span>
                                        <input
                                            type="checkbox"
                                            checked={incentiveData.is_fully_suspended}
                                            onChange={(e) => handleFieldChange('is_fully_suspended', e.target.checked)}
                                            className="w-4 h-4 rounded text-rose-500 focus:ring-rose-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* أزرار الحفظ والاعتماد */}
                        <div className="flex flex-col sm:flex-row gap-4 border-t pt-4">
                            <Button
                                onClick={() => handleSaveIncentives('draft')}
                                disabled={saving}
                                className="flex-1 py-3 font-bold text-xs bg-slate-700 hover:bg-slate-800 text-white gap-2"
                            >
                                <Save className="w-4 h-4" />
                                حفظ كمسودة
                            </Button>
                            
                            <Button
                                onClick={() => handleSaveIncentives('approved')}
                                disabled={saving}
                                className="flex-1 py-3 font-bold text-xs bg-brand-green hover:bg-brand-green/90 text-white gap-2 shadow-lg"
                            >
                                <ShieldCheck className="w-4 h-4" />
                                اعتماد وتصديق الحوافز
                            </Button>
                        </div>

                    </div>
                ) : (
                    <div className={`p-20 text-center rounded-2xl border backdrop-blur-md ${theme === 'light' ? 'bg-white/60 border-gray-200' : 'bg-slate-950/60 border-white/10'}`}>
                        <ClipboardList className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                        <h3 className="font-bold text-lg mb-2">عرض وإعداد نقاط الحوافز</h3>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                            اختر موظفاً من قائمة البحث بالجانب الأيمن للبدء في احتساب نقاطه وإدخال التقييم المباشر والخصومات الخاصة به.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
