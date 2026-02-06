
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Layout } from "../components/layout/Layout";
import { AccordionSection } from "../components/ui/AccordionSection";
import { HistoryViewer } from "../components/admin/HistoryViewer";
import { RecordList } from "../components/features/RecordList";
import { Search, User, Wallet, Scissors, ChevronDown, Loader2, FileText, Plus, Award, Pencil, PieChart, AlertCircle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "react-hot-toast";
import { cn } from "../lib/utils";
import { YearSlider } from "../components/features/YearSlider";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Label } from "../components/ui/Label";
import { ScrollableTabs } from "../components/ui/ScrollableTabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../components/ui/Select";




// 1. Remove one of the imports (cleaning up lines 16-20)
// This will be handled by replacing the import block

import TipsEditor from "../components/admin/TipsEditor";
import { PollCreator } from "../components/admin/PollCreator";
import { MediaSectionEditor } from "../components/admin/MediaSectionEditor";

import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";


export const AdminDashboard = () => {
    const { user: currentUser } = useAuth();
    const { theme } = useTheme();
    const [activeTab, setActiveTab] = useState<'admin_add' | 'admin_manage' | 'admin_records' | 'admin_news'>('admin_add');
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        username: "",
        password: "",
        full_name: "",
        job_number: "",
        iban: "",
        role: "user"
    });

    // Manage Employees State
    const [searchJobNumber, setSearchJobNumber] = useState("");
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchExpanded, setSearchExpanded] = useState(false); // For expandable search bar

    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [financialData, setFinancialData] = useState<any>(null);
    const [expandedSections, setExpandedSections] = useState({
        main_info: false, // Renamed from collision with 'basic'
        basic: false,
        allowances: false,
        deductions: false,
        yearly_records: false,
        news_bar: false,
        polls: false,
        directives: false,
        conferences: false
    });

    // New Data States
    const [adminData, setAdminData] = useState<any>(null);
    const [yearlyData, setYearlyData] = useState<any[]>([]); // Array of yearly records

    // Administrative Records Portal State
    const [selectedAdminYear, setSelectedAdminYear] = useState(new Date().getFullYear());
    const [adminRecords, setAdminRecords] = useState<{
        thanks: any[];
        committees: any[];
        penalties: any[];
        leaves: any[];
    }>({
        thanks: [],
        committees: [],
        penalties: [],
        leaves: []
    });
    const [openRecordSection, setOpenRecordSection] = useState<string | null>(null);

    const handleToggleRecordSection = (section: string) => {
        setOpenRecordSection(prev => {
            const newState = prev === section ? null : section;

            // Auto-scroll when opening
            if (newState) {
                setTimeout(() => {
                    const element = document.getElementById(`record-section-${section}`);
                    if (element) {
                        const y = element.getBoundingClientRect().top + window.scrollY - 250; // Offset for header
                        window.scrollTo({ top: y, behavior: 'smooth' });
                    }
                }, 100);
            }
            return newState;
        });
    };


    const detailsRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLDivElement>(null);

    // Click outside to close suggestions
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Debounced Search for Suggestions
    useEffect(() => {
        const delaySearch = setTimeout(async () => {
            const query = searchJobNumber.trim();
            if (!query || !searchExpanded) {
                setSuggestions([]);
                setShowSuggestions(false);
                return;
            }

            setIsSearching(true);
            try {
                console.log("Searching for:", query); // Debug
                // Search by job number OR full name (only at start)
                const { data, error } = await supabase
                    .from('app_users')
                    .select('id, full_name, job_number, username, role')
                    .or(`job_number.ilike.${query}%,full_name.ilike.${query}%`)
                    .limit(10);

                if (error) {
                    console.error("Suggestion fetch error:", error);
                    setSuggestions([]);
                    setShowSuggestions(false);
                } else {
                    console.log("Found suggestions:", data?.length); // Debug
                    setSuggestions(data || []);
                    setShowSuggestions((data || []).length > 0);
                }
            } catch (err) {
                console.error("Suggestion error:", err);
                setSuggestions([]);
                setShowSuggestions(false);
            } finally {
                setIsSearching(false);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(delaySearch);
    }, [searchJobNumber, searchExpanded]);

    const handleSelectSuggestion = async (user: any) => {
        console.log("Selected user from suggestion:", user);
        setShowSuggestions(false);
        // Direct load without searching by job_number (which might be empty)
        await loadEmployeeData(user);
    };

    const loadEmployeeData = async (partialUser: any) => {
        try {
            setLoading(true);

            // 1. Fetch FULL user data to ensure we have all fields (IBAN, password, etc)
            // Search suggestions only return partial data, so we must re-fetch.
            const { data: fullUserData, error: userError } = await supabase
                .from('app_users')
                .select('*')
                .eq('id', partialUser.id)
                .single();

            if (userError) throw userError;
            if (!fullUserData) throw new Error("تعذر جلب بيانات الموظف");

            setSelectedEmployee(fullUserData);
            console.log("Selected employee set:", fullUserData.full_name, "ID:", fullUserData.id);
            setSearchExpanded(false);

            // جلب سجلاته المالية
            const { data: finData, error: finError } = await supabase
                .from('financial_records')
                .select('*')
                .eq('user_id', fullUserData.id)
                .maybeSingle();

            if (finError) throw finError;

            // إذا وجدنا الموظف ولم نجد بياناته المالية، ننشئ سجل افتراضي محلي ليتمكن المدير من تعبئته
            const emptyFinancial = {
                user_id: fullUserData.id,
                nominal_salary: 0,
                job_title: "",
                salary_grade: "",
                salary_stage: "",
                certificate_text: "",
                certificate_percentage: 0,
                certificate_allowance: 0,
                engineering_allowance: 0,
                legal_allowance: 0,
                transport_allowance: 0,
                marital_allowance: 0,
                children_allowance: 0,
                position_allowance: 0,
                risk_allowance: 0,
                additional_50_percent_allowance: 0,
                tax_deduction_status: "",
                tax_deduction_amount: 0,
                loan_deduction: 0,
                execution_deduction: 0,
                retirement_deduction: 0,
                school_stamp_deduction: 0,
                social_security_deduction: 0,
                other_deductions: 0
            };

            if (!finData) {
                setFinancialData(emptyFinancial);
                toast.success("الموظف موجود (يرجى إدخال بيانات الراتب الجديدة)");
            } else {
                const combined = { ...emptyFinancial, ...finData };

                // Calculate risk_percentage back from amount and nominal salary
                if (combined.nominal_salary > 0 && combined.risk_allowance > 0) {
                    const rawPerc = (combined.risk_allowance / combined.nominal_salary) * 100;
                    // Round to nearest 5 to match dropdown options
                    const roundedPerc = Math.round(rawPerc / 5) * 5;
                    combined.risk_percentage = roundedPerc.toString();
                }

                setFinancialData(combined);
            }

            // 3. Fetch Administrative Summary
            const { data: admData, error: admError } = await supabase
                .from('administrative_summary')
                .select('*')
                .eq('user_id', fullUserData.id)
                .maybeSingle();

            if (!admError) {
                setAdminData(admData || {
                    user_id: fullUserData.id,
                    remaining_leave_balance: 0,
                    five_year_law_leaves: 0,
                    disengagement_date: null,
                    resumption_date: null
                });
            }

            // 4. Fetch Yearly Records (Last 5 years for simplicity or all)
            const { data: yData, error: yError } = await supabase
                .from('yearly_records')
                .select('*')
                .eq('user_id', fullUserData.id)
                .order('year', { ascending: false });

            if (!yError) {
                setYearlyData(yData || []);
            }

            toast.success("تم جلب بيانات الموظف بنجاح");
        } catch (error: any) {
            console.error("Error loading employee data:", error);
            toast.error(error.message || "حدث خطأ أثناء تحميل البيانات");
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (specificJobNumber?: string) => {
        const trimmedSearch = specificJobNumber || searchJobNumber.trim();
        if (!trimmedSearch) return;
        setLoading(true);
        console.log("Searching for job number:", trimmedSearch);
        try {
            // جلب الموظف أولاً
            const { data: userData, error: userError } = await supabase
                .from('app_users')
                .select('*')
                .or(`job_number.eq.${trimmedSearch},username.eq.${trimmedSearch}`) // Also allow exact username match just in case, though job_number is primary
                .maybeSingle();

            if (userError) {
                console.error("User search error:", userError);
                throw userError;
            }

            console.log("User data found:", userData);

            if (!userData) {
                toast.error("الموظف غير موجود برقم: " + trimmedSearch);
                setSelectedEmployee(null);
                setFinancialData(null);
                setLoading(false); // Stop loading here since we return early
                return;
            }

            // Load related data using the separate function
            await loadEmployeeData(userData);

        } catch (error: any) {
            toast.error(error.message);
            setLoading(false);
        }
    };

    // Auto-calculate allowances
    useEffect(() => {
        if (!financialData) return;

        let shouldUpdate = false;
        const newFinancialData = { ...financialData };

        // 1. Calculate Certificate Allowance
        const nominalSalary = Number(financialData.nominal_salary || 0);
        const certPercentage = Number(financialData.certificate_percentage || 0);
        const calcCertAllowance = Math.round((certPercentage / 100) * nominalSalary);

        if (Number(financialData.certificate_allowance) !== calcCertAllowance) {
            newFinancialData.certificate_allowance = calcCertAllowance;
            shouldUpdate = true;
        }

        // 2. Calculate Engineering Allowance
        const engineeringTitles = ['م. مهندس', 'مهندس', 'ر. مهندسين', 'ر. مهندسين اقدم', 'ر. مهندسين اقدم اول'];
        let calcEngAllowance = 0;
        if (engineeringTitles.includes(financialData.job_title)) {
            calcEngAllowance = Math.round(nominalSalary * 0.35); // 35% fixed
        }

        if (Number(financialData.engineering_allowance) !== calcEngAllowance) {
            newFinancialData.engineering_allowance = calcEngAllowance;
            shouldUpdate = true;
        }

        // 3. Calculate Deductions
        // Tax Deduction: 3.5% of Nominal Salary, formatted to max 3 decimal places
        let calcTaxDeduction = Math.round(nominalSalary * 0.035);
        // Remove complex truncation logic in favor of standard rounding as requested
        // if (!Number.isInteger(calcTaxDeduction)) { ... }

        if (Number(financialData.tax_deduction_amount) !== calcTaxDeduction) {
            newFinancialData.tax_deduction_amount = calcTaxDeduction;
            shouldUpdate = true;
        }

        // Retirement Deduction: 10% of Nominal Salary
        const calcRetirement = Math.round(nominalSalary * 0.10);
        if (Number(financialData.retirement_deduction) !== calcRetirement) {
            newFinancialData.retirement_deduction = calcRetirement;
            shouldUpdate = true;
        }

        // School Stamp Deduction: Fixed 1000
        const calcSchoolStamp = 1000;
        if (Number(financialData.school_stamp_deduction) !== calcSchoolStamp) {
            newFinancialData.school_stamp_deduction = calcSchoolStamp;
            shouldUpdate = true;
        }

        // Social Security Deduction: 0.25% of Nominal Salary
        const calcSocialSecurity = Math.round(nominalSalary * 0.0025);
        if (Number(financialData.social_security_deduction) !== calcSocialSecurity) {
            newFinancialData.social_security_deduction = calcSocialSecurity;
            shouldUpdate = true;
        }

        if (shouldUpdate) {
            setFinancialData(newFinancialData);
        }
    }, [
        financialData?.nominal_salary,
        financialData?.certificate_percentage,
        financialData?.job_title,
        // Include values to avoid infinite loop checks
        financialData?.certificate_allowance,
        financialData?.engineering_allowance,
        financialData?.tax_deduction_amount,
        financialData?.retirement_deduction,
        financialData?.school_stamp_deduction,
        financialData?.social_security_deduction
    ]);

    const toggleSection = (sectionId: string) => {
        setExpandedSections(prev => {
            const isCurrentlyOpen = prev[sectionId as keyof typeof prev];
            // Close all sections, then toggle the target one
            const newState = {
                main_info: false,
                basic: false,
                allowances: false,
                deductions: false,
                admin_summary: false,
                yearly_records: false,
                news_bar: false,
                polls: false,
                directives: false,
                conferences: false
            };

            if (!isCurrentlyOpen) {
                // Open only if it wasn't already open
                newState[sectionId as keyof typeof newState] = true;

                // Scroll to the section after state update
                setTimeout(() => {
                    const element = document.getElementById(`section-${sectionId}`);
                    if (element) {
                        const headerOffset = 125; // Adjusted offset to align below main header
                        const elementPosition = element.getBoundingClientRect().top;
                        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                        window.scrollTo({
                            top: offsetPosition,
                            behavior: 'smooth'
                        });
                    }
                }, 100);
            }
            return newState;
        });
    };

    const handleUpdateEmployee = async () => {
        if (!selectedEmployee || !financialData) return;
        if (!currentUser) {
            toast.error("خطأ: لم يتم التعرف على المستخدم الحالي");
            return;
        }

        // Validation: Essential fields must not be empty
        const { full_name, job_number, username, password } = selectedEmployee;
        if (!full_name?.trim() || !job_number?.trim() || !username?.trim() || !password?.trim()) {
            toast.error("لا يمكن حفظ التعديلات! 🛑\nيرجى التأكد من ملء الحقول الأساسية:\n- الاسم الكامل\n- الرقم الوظيفي الموحد\n- اسم المستخدم\n- كلمة المرور", {
                duration: 5000,
                style: { border: '2px solid #ef4444' }
            });
            return;
        }

        setLoading(true);
        try {
            // التحقق من توافق الشهادة والنسبة
            const certText = financialData.certificate_text;
            const certPerc = Number(financialData.certificate_percentage || 0);

            let expectedPerc = 0;
            if (certText === 'المتوسطة') expectedPerc = 15;
            else if (certText === 'الاعدادية') expectedPerc = 25;
            else if (certText === 'دبلوم') expectedPerc = 35;
            else if (certText === 'بكلوريوس') expectedPerc = 45;
            else if (certText === 'دبلوم عالي') expectedPerc = 55;
            else if (certText === 'ماجستير') expectedPerc = 75;
            else if (certText === 'دكتوراه') expectedPerc = 85;

            // للشهادات الأقل من المتوسطة (ابتدائية، يقرأ ويكتب) النسبة يجب أن تكون 0
            if (certText === 'الابتدائية' || certText === 'يقرأ ويكتب') expectedPerc = 0;

            if (certPerc !== expectedPerc && certText) {
                toast.error(`خطأ: شهادة "${certText}" يجب أن تكون نسبتها ${expectedPerc}% وليس ${certPerc}%`);
                setLoading(false);
                return;
            }

            // 1. تحديث بيانات المستخدم الأساسية
            const { error: userError } = await supabase
                .from('app_users')
                .update({
                    full_name: selectedEmployee.full_name,
                    job_number: selectedEmployee.job_number,
                    username: selectedEmployee.username,
                    password: selectedEmployee.password,
                    role: selectedEmployee.role,
                    iban: selectedEmployee.iban,
                    // Audit fields
                    last_modified_by: currentUser.id,
                    last_modified_by_name: currentUser.full_name,
                    last_modified_at: new Date().toISOString()
                })
                .eq('id', selectedEmployee.id);

            if (userError) throw userError;

            // 2. تحديث البيانات المالية
            // نخرج risk_percentage لأنه غير موجود في قاعدة البيانات ونقوم بحساباته برمجياً فقط
            const { risk_percentage, ...financialPayload } = financialData;

            const { error: finError } = await supabase
                .from('financial_records')
                .upsert({
                    ...financialPayload,
                    user_id: selectedEmployee.id,
                    updated_at: new Date().toISOString(),
                    last_modified_by: currentUser.id,
                    last_modified_by_name: currentUser.full_name,
                    last_modified_at: new Date().toISOString()
                });

            if (finError) throw finError;

            // 3. تحديث البيانات الإدارية
            if (adminData) {
                const { error: admError } = await supabase
                    .from('administrative_summary')
                    .upsert({
                        ...adminData,
                        user_id: selectedEmployee.id,
                        updated_at: new Date().toISOString(),
                        last_modified_by: currentUser.id,
                        last_modified_by_name: currentUser.full_name,
                        last_modified_at: new Date().toISOString()
                    });
                if (admError) throw admError;
            }

            // 4. تحديث السجلات السنوية
            if (yearlyData && yearlyData.length > 0) {
                const { error: yError } = await supabase
                    .from('yearly_records')
                    .upsert(yearlyData.map(r => ({
                        ...r,
                        updated_at: new Date().toISOString(),
                        last_modified_by: currentUser.id,
                        last_modified_by_name: currentUser.full_name,
                        last_modified_at: new Date().toISOString()
                    })));
                if (yError) throw yError;
            }

            toast.success("تم حفظ كافة التعديلات بنجاح في قاعدة البيانات");

            // Option: Re-fetch explicitly to ensure UI mimics DB, or just trust local state. 
            // We will trust local state for now to keep it responsive.
            // No reset here.
        } catch (error: any) {
            console.error("Update error:", error);
            if (error.code === '23505' || error.message?.includes('duplicate key')) {
                toast.error("خطأ: الرقم الوظيفي أو اسم المستخدم مستخدم بالفعل لموظف آخر!");
            } else {
                toast.error(error.message || "فشل في حفظ التعديلات");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSaveEmployee = async (e: React.FormEvent) => {
        e.preventDefault();

        // التحقق من الحقول الإجبارية
        if (!formData.full_name || !formData.job_number || !formData.username || !formData.password) {
            toast.error("يرجى ملء جميع الحقول الأساسية (الاسم، الرقم الوظيفي، اسم المستخدم، كلمة المرور)");
            return;
        }

        setLoading(true);
        try {
            // Check for existing user to avoid 409 Conflict error
            const { data: existingUsers } = await supabase
                .from('app_users')
                .select('job_number, username')
                .or(`job_number.eq.${formData.job_number}, username.eq.${formData.username} `);

            if (existingUsers && existingUsers.length > 0) {
                const existing = existingUsers[0];
                if (existing.job_number === formData.job_number) {
                    toast.error("خطأ: هذا الرقم الوظيفي مستخدم بالفعل لموظف آخر!");
                } else if (existing.username === formData.username) {
                    toast.error("خطأ: اسم المستخدم هذا موجود بالفعل!");
                }
                return; // Stop execution to prevent 409 error
            }

            // 1. إضافة المستخدم في جدول app_users
            const { data: user, error: userError } = await supabase
                .from('app_users')
                .insert([formData])
                .select()
                .single();

            if (userError) throw userError;

            // 2. إنشاء سجل مالي فارغ لهذا المستخدم (بدون حقل year لتجنب الخطأ)
            const { error: financialError } = await supabase
                .from('financial_records')
                .insert([{
                    user_id: user.id,
                    nominal_salary: 0
                }]);

            if (financialError) throw financialError;

            toast.success("تم إضافة الموظف بنجاح، جارِ الانتقال للتعديل التفصيلي...");

            // 3. الانتقال التلقائي لواجهة الإدارة والتعديل التفصيلي
            setSearchJobNumber(formData.job_number);
            setActiveTab('admin_manage');

            // جلب البيانات فوراً لفتح واجهة التعديل
            setSelectedEmployee(user);
            setFinancialData({ user_id: user.id, nominal_salary: 0 });
            setExpandedSections({
                main_info: false,
                basic: false,
                allowances: false,
                deductions: false,
                yearly_records: false,
                news_bar: false,
                polls: false,
                directives: false,
                conferences: false
            });

            // تمرير الشاشة ليعرض بداية التفاصيل
            setTimeout(() => {
                if (detailsRef.current) {
                    detailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);

            // تصفير نموذج الإضافة للعملية القادمة
            setFormData({ username: "", password: "", full_name: "", job_number: "", iban: "", role: "user" });
        } catch (error: any) {
            // Handle unique constraint violations
            if (error.code === '23505' || error.message?.includes('unique constraint')) {
                // Suppress console error for known validation issues
                if (error.message?.includes('job_number') || error.details?.includes('job_number')) {
                    toast.error("خطأ: هذا الرقم الوظيفي مستخدم بالفعل لموظف آخر!");
                } else if (error.message?.includes('username') || error.details?.includes('username')) {
                    toast.error("خطأ: اسم المستخدم هذا موجود بالفعل!");
                } else {
                    toast.error("خطأ: توجد بيانات مكررة (قد يكون الاسم أو الرقم الوظيفي)");
                }
            } else {
                console.error("Save error:", error);
                toast.error("فشل الحفظ: " + (error.message || "خطأ غير معروف"));
            }
        } finally {
            setLoading(false);
        }
    };

    // --- Administrative Records Logic ---

    const fetchAdminRecords = async () => {
        if (!selectedEmployee) return;
        setLoading(true);
        try {
            const [thanks, committees, penalties, leaves] = await Promise.all([
                supabase.from('thanks_details').select('*').eq('user_id', selectedEmployee.id).eq('year', selectedAdminYear),
                supabase.from('committees_details').select('*').eq('user_id', selectedEmployee.id).eq('year', selectedAdminYear),
                supabase.from('penalties_details').select('*').eq('user_id', selectedEmployee.id).eq('year', selectedAdminYear),
                supabase.from('leaves_details').select('*').eq('user_id', selectedEmployee.id).eq('year', selectedAdminYear)
            ]);

            setAdminRecords({
                thanks: thanks.data || [],
                committees: committees.data || [],
                penalties: penalties.data || [],
                leaves: leaves.data || []
            });
        } catch (error) {
            console.error("Error fetching admin records:", error);
            toast.error("فشل جلب السجلات");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'admin_records' && selectedEmployee) {
            fetchAdminRecords();
        }
    }, [activeTab, selectedEmployee, selectedAdminYear]);

    const handleSaveRecord = async (type: 'thanks' | 'committees' | 'penalties' | 'leaves', data: any) => {
        if (!selectedEmployee) return;

        // Validation: Ensure Admin is identified via Context
        if (!currentUser?.id) {
            toast.error("خطأ حرج: لم يتم التعرف على هوية المدير! يرجى إعادة تسجيل الدخول.");
            return;
        }

        setLoading(true);
        try {
            const tableName = `${type}_details`;

            const payload = {
                ...data,
                user_id: selectedEmployee.id,
                year: selectedAdminYear,
                last_modified_by: currentUser.id,
                last_modified_by_name: currentUser.full_name,
                last_modified_at: new Date().toISOString()
            };

            console.log(`[Audit] Saving as Admin: ${currentUser.full_name} (${currentUser.id})`);

            const { error } = await supabase.from(tableName).upsert([payload]); // Changed to upsert for edit support
            if (error) throw error;

            toast.success(data.id ? "تم تحديث السجل بنجاح" : "تم إضافة السجل بنجاح");
            fetchAdminRecords(); // Refresh list

            // Optional: Update Count in yearly_records (Implementation left as exercise or handled by DB trigger optimally)
            // For now, we focus on the details.
        } catch (error: any) {
            toast.error("فشل الحفظ: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRecord = async (type: 'thanks' | 'committees' | 'penalties' | 'leaves', id: string) => {
        if (!confirm("هل أنت متأكد من حذف هذا السجل؟")) return;
        setLoading(true);
        try {
            const tableName = `${type}_details`;
            const { error } = await supabase.from(tableName).delete().eq('id', id);
            if (error) throw error;

            toast.success("تم الحذف بنجاح");
            fetchAdminRecords();
        } catch (error: any) {
            toast.error("فشل الحذف: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const financialFields = {
        basic: [
            {
                key: 'job_title',
                label: 'العنوان الوظيفي',
                options: [
                    'ر. مهندسين اقدم اول', 'ر. مهندسين اقدم', 'ر. مهندسين', 'مهندس', 'م. مهندس',
                    'ر. مبرمجين اقدم اول', 'ر. مبرمجين اقدم', 'ر. مبرمجين', 'مبرمج', 'م. مبرمج',
                    'ر. مشغلين اقدم اول', 'ر. مشغلين اقدم', 'ر. مشغلين', 'مشغل حاسبة', 'م. مشغل حاسبة',
                    'مدير فني اقدم', 'مدير فني', 'فني اقدم', 'فني', 'عامل خدمة'
                ]
            },
            {
                key: 'salary_grade',
                label: 'الدرجة في سلم الرواتب',
                options: Array.from({ length: 10 }, (_, i) => (i + 1).toString())
            },
            {
                key: 'salary_stage',
                label: 'المرحلة في الدرجة الوظيفية',
                options: Array.from({ length: 10 }, (_, i) => (i + 1).toString())
            },
            {
                key: 'certificate_text',
                label: 'التحصيل الدراسي',
                options: ['دكتوراه', 'ماجستير', 'دبلوم عالي', 'بكلوريوس', 'دبلوم', 'الاعدادية', 'المتوسطة', 'الابتدائية', 'يقرأ ويكتب']
            },
            {
                key: 'certificate_percentage',
                label: 'النسبة المستحقة للشهادة',
                suffix: '%',
                options: ['0', '15', '25', '35', '45', '55', '75', '85']
            },
            { key: 'nominal_salary', label: 'الراتب الاسمي', isMoney: true },
            {
                key: 'risk_percentage',
                label: 'الخطورة %',
                suffix: '%',
                options: Array.from({ length: 20 }, (_, i) => ((i + 1) * 5).toString())
            },

        ],
        allowances: [
            { key: 'certificate_allowance', label: 'م. الشهادة', isMoney: true, disabled: true },
            { key: 'engineering_allowance', label: 'م. هندسية', isMoney: true, disabled: true },
            { key: 'legal_allowance', label: 'م. القانونية', isMoney: true, disabled: true },
            { key: 'transport_allowance', label: 'م. النقل', isMoney: true, options: ['20000', '30000'] },
            { key: 'marital_allowance', label: 'م. الزوجية', isMoney: true },
            { key: 'children_allowance', label: 'م. الاطفال', isMoney: true },
            { key: 'position_allowance', label: 'م. المنصب', isMoney: true },
            { key: 'risk_allowance', label: 'م. الخطورة', isMoney: true, disabled: true },
            { key: 'additional_50_percent_allowance', label: 'م. اضافية 50%', isMoney: true },
        ],
        deductions: [
            { key: 'tax_deduction_status', label: 'حالة الاستقطاع الضريبي' },
            { key: 'tax_deduction_amount', label: 'الاستقطاع الضريبي', isMoney: true, disabled: true },
            { key: 'loan_deduction', label: 'استقطاع مبلغ القرض', isMoney: true },
            { key: 'execution_deduction', label: 'استقطاع مبالغ التنفيذ', isMoney: true },
            { key: 'retirement_deduction', label: 'استقطاع التقاعد', isMoney: true, disabled: true },
            { key: 'school_stamp_deduction', label: 'استقطاع طابع مدرسي', isMoney: true, disabled: true },
            { key: 'social_security_deduction', label: 'استقطاع الحماية الاجتماعية', isMoney: true, disabled: true },
            { key: 'other_deductions', label: 'استقطاع مبلغ مطروح', isMoney: true },
        ]
    };

    const handleFinancialChange = (key: string, value: any) => {
        if (!financialData) return;

        const newData = { ...financialData, [key]: value };

        // Auto-calculate Risk Allowance: (Risk % / 100) * Nominal Salary
        if (key === 'risk_percentage' || key === 'nominal_salary') {
            const nominal = parseFloat(key === 'nominal_salary' ? value : (financialData.nominal_salary || 0));
            const riskP = parseFloat(key === 'risk_percentage' ? value : (financialData.risk_percentage || 0));

            if (!isNaN(nominal) && !isNaN(riskP)) {
                // Calculation: (Percentage / 100) * Nominal Salary
                newData.risk_allowance = Math.round((riskP / 100) * nominal);
            }
        }

        setFinancialData(newData);
    };

    // Header Content with Tabs and Search
    const headerContent = (
        <div className="space-y-3">
            {/* Tabs */}
            <div className={`flex p-1 rounded-xl border shadow-inner w-full ${theme === 'light'
                ? 'bg-gray-100 border-gray-200'
                : 'bg-black/40 border-white/5'
                } backdrop-blur-md overflow-hidden`}>
                <ScrollableTabs
                    tabs={[
                        { id: 'admin_add', label: 'إضافة موظف' },
                        { id: 'admin_manage', label: 'إدارة الموظفين' },
                        { id: 'admin_records', label: 'إدارة السجلات' },
                        { id: 'admin_news', label: 'الاعلام' },
                        { id: 'admin_supervisors', label: 'المشرفون' },
                    ]}
                    activeTab={activeTab}
                    onTabChange={(id) => setActiveTab(id as any)}
                    containerClassName="w-full"
                    activeTabClassName="bg-blue-600 text-white shadow-lg"
                    inactiveTabClassName={theme === 'light' ? "text-gray-600 hover:text-black" : "text-white/40 hover:text-white/60"}
                    tabClassName="flex-1" // Keep flex-1 if we want them to fill space, but user said "take one line... and expand". 
                // Actually user said "make the tab take on line... expland horizontally off screen".
                // If I use flex-1, they shrink. I should remove flex-1 or make it grow but not shrink?
                // "make the tab take one line" implies whitespace-nowrap (handled in component).
                // "expand horizontally... off screen" implies they shouldn't wrap.
                // The ScrollableTabs component uses `flex-none` by default for items.
                // Let's pass `flex-1 min-w-fit` maybe?
                // User said: "اجعل التبويبة على تأخذ سطر واحد وليتوسع الشريط افقيا ويخرج عن الشاشة"
                // "make the tab take one line and let the bar expand horizontally and go out of screen"
                // So they should have their natural width or a minimum width, and not shrink.
                // The component has `flex-none` on buttons, so they won't shrink.
                // I will pass `min-w-[100px]` or something to ensure they utilize space if few, but `flex-1` might force them to be small if container is small?
                // No, `flex-1` with `min-w` is good. 
                // But if I want them to overflow, `flex-none` is better.
                // However, if there are only 4 tabs on a large screen, they should probably fill the width?
                // User said: "sometimes it expands in height... due to wrapping".
                // So `whitespace-nowrap` is the key fixes.
                // I will remove `flex-1` from `tabClassName` to let them be natural width, OR keep `flex-1` but ensure `min-width`.
                // If I look at the screenshot, they are quite wide.
                // I'll try `w-full` on container (default) and `flex-1` on tabs? No, that causes shrinking.
                // I will use `flex-none` (default in component) and maybe `px-6` for larger touch targets.
                />
            </div>

            {/* Search & Year Slider (only in manage & records tabs) */}
            {/* Search & Year Slider (Unified Toolbar) */}
            <div className="flex items-center justify-between gap-3 relative overflow-visible h-10 min-h-[40px]">

                {/* Right Side (Start in RTL): Year Slider (Reserved Slot) */}
                <div className="flex-shrink-0 min-w-[140px]">
                    {activeTab === 'admin_records' ? (
                        <div className={cn(
                            "flex items-center gap-1 px-2 py-0.5 rounded-lg border animate-in fade-in zoom-in duration-300",
                            theme === 'light'
                                ? "bg-white border-gray-200 shadow-sm"
                                : "bg-white/5 border-white/5"
                        )}>
                            <div className="w-28">
                                <YearSlider
                                    selectedYear={selectedAdminYear}
                                    onYearChange={setSelectedAdminYear}
                                />
                            </div>
                        </div>
                    ) : (activeTab === 'admin_add' || (activeTab === 'admin_manage' && selectedEmployee)) ? (
                        <button
                            onClick={(e) => activeTab === 'admin_add' ? handleSaveEmployee(e) : handleUpdateEmployee()}
                            disabled={loading}
                            className="w-full py-2 px-2 bg-brand-green hover:bg-brand-green/90 text-white rounded-lg font-bold text-xs flex items-center justify-center shadow-lg shadow-brand-green/20 disabled:opacity-50 transition-all animate-in fade-in zoom-in duration-300 whitespace-nowrap"
                        >
                            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin ml-2" /> : null}
                            <span>حفظ التعديل والاضافة</span>
                        </button>
                    ) : (
                        <div id="admin-header-portal" className="w-full h-full flex items-center" />
                    )}
                </div>

                {/* Left Side (End in RTL): Name + Search */}
                <div className="flex items-center gap-3">

                    {/* User Name - Hidden when search is expanded */}
                    {!searchExpanded && selectedEmployee && (
                        <h3 className={`font-bold text-sm animate-in fade-in duration-200 ${theme === 'light' ? 'text-gray-900' : 'text-white'
                            }`}>
                            {selectedEmployee.full_name}
                        </h3>
                    )}

                    {/* Search Button & Input */}
                    <div className="flex items-center gap-2 relative overflow-visible" ref={searchRef}>
                        {searchExpanded && (
                            <div className="relative animate-in slide-in-from-right-5 fade-in duration-300 overflow-visible">
                                <input
                                    type="text"
                                    placeholder="الرقم الوظيفي أو الاسم"
                                    value={searchJobNumber}
                                    onChange={e => setSearchJobNumber(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                    onFocus={() => {
                                        if (suggestions.length > 0) setShowSuggestions(true);
                                    }}
                                    onBlur={(e) => {
                                        const relatedTarget = e.relatedTarget as HTMLElement;
                                        if (!relatedTarget?.closest('.suggestions-dropdown')) {
                                            setTimeout(() => {
                                                setSearchExpanded(false);
                                            }, 200);
                                        }
                                    }}
                                    autoFocus
                                    className={`w-48 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-green/50 ${theme === 'light'
                                        ? 'bg-gray-50 border-gray-200 text-black placeholder:text-gray-400'
                                        : 'bg-white/5 border-white/10 text-white placeholder:text-white/50'
                                        }`}
                                />
                                {/* Suggestions Dropdown using Portal */}
                                {showSuggestions && suggestions.length > 0 && searchRef.current && createPortal(
                                    <div
                                        className={`suggestions-dropdown fixed backdrop-blur-xl border rounded-lg shadow-2xl overflow-hidden z-[9999] max-h-[180px] overflow-y-auto ${theme === 'light'
                                            ? 'bg-white border-gray-200'
                                            : 'bg-slate-900/95 border-white/10'
                                            }`}
                                        style={{
                                            top: `${searchRef.current.getBoundingClientRect().bottom + 8}px`,
                                            left: `${searchRef.current.getBoundingClientRect().left}px`,
                                            width: '200px'
                                        }}
                                    >
                                        {suggestions.map((user, idx) => (
                                            <button
                                                key={user.id || idx}
                                                type="button"
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                }}
                                                onMouseUp={() => {
                                                    console.log("Button clicked for:", user.full_name);
                                                    handleSelectSuggestion(user);
                                                }}
                                                className={`w-full text-right px-3 py-2 border-b last:border-0 flex items-center justify-between group transition-colors cursor-pointer ${theme === 'light'
                                                    ? 'hover:bg-gray-100 border-gray-200'
                                                    : 'hover:bg-white/10 border-white/5'
                                                    }`}
                                            >
                                                <div>
                                                    <div className={`font-bold text-xs group-hover:text-brand-green transition-colors ${theme === 'light' ? 'text-gray-900' : 'text-white'
                                                        }`}>{user.full_name}</div>
                                                    <div className={`text-[10px] ${theme === 'light' ? 'text-gray-600' : 'text-white/50'
                                                        }`}>{user.job_number}</div>
                                                </div>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${theme === 'light'
                                                    ? 'bg-gray-100 text-gray-700'
                                                    : 'bg-white/10 text-white/70'
                                                    }`}>
                                                    {user.role === 'admin' ? 'مدير' : 'موظف'}
                                                </span>
                                            </button>
                                        ))}
                                    </div>,
                                    document.body
                                )}
                            </div>
                        )}
                        <button
                            onClick={() => {
                                if (searchExpanded) {
                                    if (searchJobNumber) handleSearch();
                                    else setSearchExpanded(false);
                                } else {
                                    setSearchJobNumber('');
                                    setSuggestions([]);
                                    setSearchExpanded(true);
                                }
                            }}
                            disabled={loading || isSearching}
                            className="bg-brand-green/20 text-brand-green p-1.5 rounded-lg hover:bg-brand-green/30 disabled:opacity-50 transition-all active:scale-95"
                            title="بحث"
                        >
                            {loading || isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </div>

        </div>
    );

    return (
        <Layout headerTitle="إدارة النظام" showUserName={true} headerContent={headerContent}>

            {/* TAB: Add Employee */}
            {activeTab === 'admin_add' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full px-2 md:container md:mx-auto max-w-2xl">
                    <Card className="w-full">
                        <CardHeader>
                            <CardTitle>إضافة موظف جديد</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Row 1: Full Name */}
                            <div className="grid gap-2">
                                <Label htmlFor="full_name">الاسم الكامل</Label>
                                <Input
                                    id="full_name"
                                    type="text"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    placeholder="الاسم الرباعي واللقب"
                                />
                            </div>

                            {/* Row 2: Account Type */}
                            <div className="grid gap-2">
                                <Label>نوع الحساب</Label>
                                <div className="grid grid-cols-2 gap-4">
                                    <Button
                                        type="button"
                                        variant={formData.role === 'user' ? 'default' : 'outline'}
                                        onClick={() => setFormData({ ...formData, role: 'user' })}
                                        className="w-full gap-2"
                                    >
                                        <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", formData.role === 'user' ? "border-white" : "border-muted-foreground")}>
                                            {formData.role === 'user' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                        </div>
                                        موظف
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={formData.role === 'admin' ? 'default' : 'outline'}
                                        onClick={() => setFormData({ ...formData, role: 'admin' })}
                                        className="w-full gap-2"
                                    >
                                        <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", formData.role === 'admin' ? "border-white" : "border-muted-foreground")}>
                                            {formData.role === 'admin' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                        </div>
                                        مشرف
                                    </Button>
                                </div>
                            </div>

                            {/* Row 3: Job Number */}
                            <div className="grid gap-2">
                                <Label htmlFor="job_number">الرقم الوظيفي الموحد</Label>
                                <div className="relative">
                                    <Input
                                        id="job_number"
                                        type="text"
                                        value={formData.job_number}
                                        onChange={(e) => setFormData({ ...formData, job_number: e.target.value })}
                                        placeholder="123456"
                                        className="font-mono text-left"
                                        dir="ltr"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-mono pointer-events-none">#</div>
                                </div>
                            </div>

                            {/* Row 4: IBAN */}
                            <div className="grid gap-2">
                                <Label htmlFor="iban">رمز ( IBAN )</Label>
                                <Input
                                    id="iban"
                                    type="text"
                                    value={formData.iban}
                                    onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                                    placeholder="IQ..."
                                    className="font-mono text-left"
                                    dir="ltr"
                                />
                            </div>

                            {/* Row 5: Username */}
                            <div className="grid gap-2">
                                <Label htmlFor="username">اسم المستخدم المؤقت</Label>
                                <Input
                                    id="username"
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    placeholder="username"
                                    className="font-mono text-left"
                                    dir="ltr"
                                    autoComplete="off"
                                />
                            </div>

                            {/* Row 6: Password */}
                            <div className="grid gap-2">
                                <Label htmlFor="password">كلمة المرور المؤقتة</Label>
                                <Input
                                    id="password"
                                    type="text"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="password"
                                    className="font-mono text-left"
                                    dir="ltr"
                                    autoComplete="off"
                                />
                            </div>

                        </CardContent>
                    </Card>
                </div>
            )}

            {/* TAB: Manage Employees */}
            {activeTab === 'admin_manage' && (
                <div className="space-y-6">

                    {selectedEmployee ? (
                        <div ref={detailsRef} className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-0 scroll-mt-20 w-full px-2 md:container md:mx-auto">

                            <AccordionSection
                                id="main_info"
                                title="معلومات اساسية"
                                icon={User}
                                isOpen={expandedSections.main_info}
                                onToggle={() => toggleSection('main_info')}
                            >
                                {/* Main Info Fields */}
                                <div className="grid grid-cols-1 gap-4">
                                    <EditableField
                                        label="الاسم الكامل"
                                        value={selectedEmployee.full_name}
                                        onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, full_name: val })}
                                        recordId={selectedEmployee.id}
                                        tableName="app_users"
                                        dbField="full_name"
                                    />

                                    {/* Role Selection (UI matching Add Employee) */}
                                    {/* Role Selection (Refactored) */}
                                    <div className="grid grid-cols-[132px_1fr] items-center gap-2">
                                        {/* Label */}
                                        <div className="flex justify-start pl-2">
                                            <label className="text-xs font-bold block text-muted-foreground text-right w-full">نوع الحساب</label>
                                        </div>

                                        {/* Input Area + Spacer */}
                                        <div className="flex items-center gap-2 relative">
                                            {/* Spacer for alignment with history buttons */}
                                            <div className="w-6 shrink-0" />

                                            <div className="flex gap-4 flex-1">
                                                <Button
                                                    type="button"
                                                    variant={selectedEmployee.role === 'user' ? 'default' : 'outline'}
                                                    onClick={() => setSelectedEmployee({ ...selectedEmployee, role: 'user' })}
                                                    className="flex-1 gap-2"
                                                >
                                                    <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", selectedEmployee.role === 'user' ? "border-white" : "border-muted-foreground")}>
                                                        {selectedEmployee.role === 'user' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                    </div>
                                                    موظف
                                                </Button>

                                                <Button
                                                    type="button"
                                                    variant={selectedEmployee.role === 'admin' ? 'default' : 'outline'}
                                                    onClick={() => setSelectedEmployee({ ...selectedEmployee, role: 'admin' })}
                                                    className="flex-1 gap-2"
                                                >
                                                    <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", selectedEmployee.role === 'admin' ? "border-white" : "border-muted-foreground")}>
                                                        {selectedEmployee.role === 'admin' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                    </div>
                                                    مشرف
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    <EditableField
                                        label="الرقم الوظيفي الموحد"
                                        value={selectedEmployee.job_number}
                                        onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, job_number: val })}
                                        recordId={selectedEmployee.id}
                                        tableName="app_users"
                                        dbField="job_number"
                                    />

                                    {/* IBAN Field */}
                                    <EditableField
                                        label="رمز ( IBAN )"
                                        value={selectedEmployee.iban || ""}
                                        onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, iban: val })}
                                        recordId={selectedEmployee.id}
                                        tableName="app_users"
                                        dbField="iban"
                                    />

                                    <EditableField
                                        label="اسم المستخدم المؤقت"
                                        value={selectedEmployee.username}
                                        onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, username: val })}
                                        recordId={selectedEmployee.id}
                                        tableName="app_users"
                                        dbField="username"
                                    />

                                    {/* Password - optional to show here or keep hidden, but logic dictates "Same as A" */}
                                    <div className="grid grid-cols-[132px_1fr] items-center gap-2">
                                        {/* Label */}
                                        <div className="flex justify-start pl-2">
                                            <label className="text-xs font-bold block text-muted-foreground text-right w-full">كلمة المرور المؤقتة</label>
                                        </div>

                                        {/* Input Area + Spacer */}
                                        <div className="flex items-center gap-2 relative">
                                            {/* Spacer for alignment */}
                                            <div className="w-6 shrink-0" />

                                            <Input
                                                type="text"
                                                value={selectedEmployee.password || ""}
                                                onChange={(e) => setSelectedEmployee({ ...selectedEmployee, password: e.target.value })}
                                                placeholder="كلمة المرور"
                                                dir="ltr"
                                                className="font-mono text-left flex-1"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </AccordionSection>

                            <AccordionSection
                                id="basic"
                                title="معلومات الدرجة الوظيفية"
                                icon={User}
                                isOpen={expandedSections.basic}
                                color="from-blue-600 to-blue-500"
                                onToggle={() => toggleSection('basic')}
                            >
                                <div className="space-y-4">
                                    {/* Start Date */}
                                    <div className="grid grid-cols-[132px_1fr] items-center gap-2">
                                        {/* Label */}
                                        <div className="flex justify-start pl-2">
                                            <label className="text-xs font-bold block whitespace-nowrap text-muted-foreground text-right w-full">تأريخ اول مباشرة</label>
                                        </div>

                                        {/* Input Area + History */}
                                        <div className="flex items-center gap-2 relative">
                                            {/* History Icon Slot (Fixed Width) */}
                                            <div className="w-6 shrink-0 flex justify-center">
                                                {adminData?.id && (
                                                    <HistoryViewer
                                                        tableName="administrative_summary"
                                                        recordId={adminData.id}
                                                        fieldName="first_appointment_date"
                                                        label="تأريخ اول مباشرة"
                                                    />
                                                )}
                                            </div>

                                            <Input
                                                type="date"
                                                value={adminData?.first_appointment_date || ''}
                                                onChange={e => setAdminData({ ...adminData, first_appointment_date: e.target.value })}
                                                className="flex-1"
                                            />
                                        </div>
                                    </div>

                                    {/* Job Title and Risk % */}
                                    <div className="grid grid-cols-1 gap-4">
                                        <FinancialInput
                                            key="job_title"
                                            field={financialFields.basic.find(f => f.key === 'job_title')}
                                            value={financialData?.job_title}
                                            onChange={handleFinancialChange}
                                            recordId={financialData?.id}
                                            tableName="financial_records"
                                            dbField="job_title"
                                        />
                                        <FinancialInput
                                            key="risk_percentage"
                                            field={financialFields.basic.find(f => f.key === 'risk_percentage')}
                                            value={financialData?.risk_percentage}
                                            onChange={handleFinancialChange}
                                            recordId={financialData?.id}
                                            tableName="financial_records"
                                            // This is technically computed often but stored as text? Let's assume we want to track it
                                            dbField="risk_percentage"
                                        />
                                    </div>

                                    {/* Row 2: Grade and Stage - Vertical Stack */}
                                    <div className="grid grid-cols-1 gap-4">
                                        <FinancialInput
                                            key="salary_grade"
                                            field={{ ...financialFields.basic.find(f => f.key === 'salary_grade'), label: "الدرجة الوظيفية" }}
                                            value={financialData?.salary_grade}
                                            onChange={handleFinancialChange}
                                            recordId={financialData?.id}
                                            tableName="financial_records"
                                            dbField="salary_grade"
                                        />

                                        {/* Salary Stage (المرحلة) */}
                                        <div className="grid grid-cols-[132px_1fr] items-center gap-2">
                                            {/* Label */}
                                            <div className="flex justify-start pl-2">
                                                <label className="text-xs font-bold block whitespace-nowrap text-muted-foreground text-right w-full">المرحلة</label>
                                            </div>

                                            {/* Input Area + History */}
                                            <div className="flex items-center gap-2 relative">
                                                {/* History Icon Slot (Fixed Width) */}
                                                <div className="w-6 shrink-0 flex justify-center">
                                                    {financialData?.id && (
                                                        <HistoryViewer
                                                            tableName="financial_records"
                                                            recordId={financialData.id}
                                                            fieldName="salary_stage"
                                                            label="المرحلة"
                                                        />
                                                    )}
                                                </div>

                                                <div className="relative flex-1">
                                                    <Select
                                                        value={financialData?.['salary_stage']?.toString() || ""}
                                                        onValueChange={(val) => setFinancialData({ ...(financialData || {}), 'salary_stage': val })}
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="اختر..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
                                                                <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 3: Certificate Text */}
                                    <FinancialInput
                                        key="certificate_text"
                                        field={financialFields.basic.find(f => f.key === 'certificate_text')}
                                        value={financialData?.certificate_text}
                                        onChange={handleFinancialChange}
                                        recordId={financialData?.id}
                                        tableName="financial_records"
                                        dbField="certificate_text"
                                    />

                                    {/* Row 4: Certificate Percentage & Nominal Salary */}
                                    {/* Row 4: Nominal Salary & Certificate Percentage - Adjusted for mobile: 130px fixed width for Cert to give Salary more space */}
                                    {/* Row 4: Certificate Percentage & Nominal Salary - Vertical Stack */}
                                    <div className="grid grid-cols-1 gap-4">
                                        <FinancialInput
                                            key="nominal_salary"
                                            field={financialFields.basic.find(f => f.key === 'nominal_salary')}
                                            value={financialData?.nominal_salary}
                                            onChange={handleFinancialChange}
                                            recordId={financialData?.id}
                                            tableName="financial_records"
                                            dbField="nominal_salary"
                                        />
                                        <FinancialInput
                                            key="certificate_percentage"
                                            field={{ ...financialFields.basic.find(f => f.key === 'certificate_percentage'), label: "م.الشهادة %" }}
                                            value={financialData?.certificate_percentage}
                                            onChange={handleFinancialChange}
                                            recordId={financialData?.id}
                                            tableName="financial_records"
                                            dbField="certificate_percentage"
                                        />
                                    </div>
                                </div>
                            </AccordionSection>

                            <AccordionSection
                                id="allowances"
                                title="المخصصات"
                                icon={Wallet}
                                isOpen={expandedSections.allowances}
                                color="from-green-600 to-green-500"
                                onToggle={() => toggleSection('allowances')}
                            >
                                <div className="grid grid-cols-1 gap-4">
                                    {financialFields.allowances.map(field => (
                                        <FinancialInput
                                            key={field.key}
                                            field={field}
                                            value={financialData?.[field.key]}
                                            onChange={handleFinancialChange}
                                            recordId={financialData?.id}
                                            tableName="financial_records"
                                            dbField={field.key}
                                        />
                                    ))}
                                </div>
                            </AccordionSection>

                            <AccordionSection
                                id="deductions"
                                title="الاستقطاعات"
                                icon={Scissors}
                                isOpen={expandedSections.deductions}
                                color="from-red-600 to-red-500"
                                onToggle={() => toggleSection('deductions')}
                            >
                                <div className="grid grid-cols-1 gap-4">
                                    {financialFields.deductions.map(field => (
                                        <FinancialInput
                                            key={field.key}
                                            field={field}
                                            value={financialData?.[field.key]}
                                            onChange={handleFinancialChange}
                                            recordId={financialData?.id}
                                            tableName="financial_records"
                                            dbField={field.key}
                                        />
                                    ))}
                                </div>
                            </AccordionSection>


                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <div className="p-4 bg-white/5 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 border border-white/10">
                                <User className="w-10 h-10 text-white/20" />
                            </div>
                            <h3 className="text-white font-bold text-xl mb-2">إدارة الموظفين</h3>
                            <p className="text-white/40">يرجى البحث عن موظف بواسطة الرقم الوظيفي لتعديل بياناته</p>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Admin Records Portal */}
            {activeTab === 'admin_records' && (
                <div className="space-y-6">
                    {selectedEmployee ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 mx-6">
                            {/* Sections */}
                            <div className="space-y-4">
                                <RecordSection
                                    id="thanks"
                                    title="كتب الشكر والتقدير"
                                    icon={Award}
                                    color="from-yellow-600 to-yellow-500"
                                    data={adminRecords.thanks}
                                    type="thanks"
                                    onSave={handleSaveRecord}
                                    onDelete={handleDeleteRecord}
                                    isOpen={openRecordSection === 'thanks'}
                                    onToggle={() => handleToggleRecordSection('thanks')}
                                    selectedYear={selectedAdminYear}
                                    fields={[
                                        { key: 'book_number', label: 'رقم الكتاب' },
                                        { key: 'book_date', label: 'تاريخ الكتاب', type: 'date-fixed-year' },
                                        { key: 'reason', label: 'سبب الشكر' },
                                        { key: 'issuer', label: 'الجهة المانحة' }
                                    ]}
                                />
                                <RecordSection
                                    id="committees"
                                    title="اللجان"
                                    icon={User}
                                    color="from-blue-600 to-blue-500"
                                    data={adminRecords.committees}
                                    type="committees"
                                    onSave={handleSaveRecord}
                                    onDelete={handleDeleteRecord}
                                    isOpen={openRecordSection === 'committees'}
                                    onToggle={() => handleToggleRecordSection('committees')}
                                    selectedYear={selectedAdminYear}
                                    fields={[
                                        { key: 'committee_name', label: 'اسم اللجنة' },
                                        { key: 'role', label: 'العضوية / الصفة' },
                                        { key: 'start_date', label: 'تاريخ اللجنة', type: 'date-fixed-year' }
                                    ]}
                                />
                                <RecordSection
                                    id="penalties"
                                    title="العقوبات"
                                    icon={Scissors}
                                    color="from-red-600 to-red-500"
                                    data={adminRecords.penalties}
                                    type="penalties"
                                    onSave={handleSaveRecord}
                                    onDelete={handleDeleteRecord}
                                    isOpen={openRecordSection === 'penalties'}
                                    onToggle={() => handleToggleRecordSection('penalties')}
                                    selectedYear={selectedAdminYear}
                                    fields={[
                                        { key: 'penalty_type', label: 'نوع العقوبة' },
                                        { key: 'reason', label: 'السبب' },
                                        { key: 'penalty_date', label: 'تاريخ العقوبة', type: 'date-fixed-year' },
                                        { key: 'effect', label: 'الأثر المترتب (اختياري)' }
                                    ]}
                                />
                                <RecordSection
                                    id="leaves"
                                    title="الاجازات"
                                    icon={FileText}
                                    color="from-green-600 to-green-500"
                                    data={adminRecords.leaves}
                                    type="leaves"
                                    onSave={handleSaveRecord}
                                    onDelete={handleDeleteRecord}
                                    isOpen={openRecordSection === 'leaves'}
                                    onToggle={() => handleToggleRecordSection('leaves')}
                                    selectedYear={selectedAdminYear} // Pass selected year
                                    fields={[
                                        {
                                            key: 'leave_type',
                                            label: 'نوع الاجازة',
                                            type: 'select',
                                            options: ['اعتيادية', 'مرضية', 'سنوات', 'لجان طبية', 'ايقاف عن العمل']
                                        },
                                        { key: 'duration', label: 'المدة (محسوبة)', readOnly: true },
                                        { key: 'start_date', label: 'تاريخ الانفكاك', type: 'date-fixed-year' },
                                        { key: 'end_date', label: 'تاريخ المباشرة (اختياري)', type: 'date-fixed-year' },
                                    ]}
                                />
                            </div>
                            <div className="pb-32"></div>
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <div className="p-4 bg-white/5 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 border border-white/10">
                                <FileText className="w-10 h-10 text-white/20" />
                            </div>
                            <h3 className="text-white font-bold text-xl mb-2">سجلات الموظفين</h3>
                            <p className="text-white/40">ابدأ بالبحث عن موظف لإدارة سجلاته الإدارية</p>
                        </div>
                    )}
                </div>
            )}

            {/* News Ticker Tab */}
            {activeTab === 'admin_news' && (
                <div className="space-y-6 mx-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* News Bar Section */}
                    <AccordionSection
                        id="news_bar"
                        title="إدارة شريط الاخبار"
                        icon={FileText}
                        isOpen={expandedSections.news_bar}
                        color="from-teal-600 to-teal-500"
                        onToggle={() => toggleSection('news_bar')}
                    >
                        <div className="p-2">
                            <div className="flex justify-between items-center mb-4">
                                <p className="text-white/60 text-sm leading-relaxed">
                                    يمكنك هنا تحديث شريط الاخبار الذي يظهر في أسفل التطبيق لجميع المستخدمين.
                                </p>
                                <button
                                    onClick={() => toggleSection('news_bar')}
                                    className="text-white/40 hover:text-white flex items-center gap-1 text-xs transition-colors"
                                >
                                    <ChevronDown className="w-4 h-4 rotate-180" />
                                    إغلاق
                                </button>
                            </div>
                            <TipsEditor appName="InfTeleKarbala" />
                        </div>
                    </AccordionSection>

                    {/* Polls Section */}
                    <AccordionSection
                        id="polls"
                        title="الاستطلاعات"
                        icon={PieChart}
                        isOpen={expandedSections.polls}
                        color="from-purple-600 to-purple-500"
                        onToggle={() => toggleSection('polls')}
                    >
                        <div className="p-2">
                            <PollCreator />
                        </div>
                    </AccordionSection>

                    {/* Directives Section (Red) */}
                    <AccordionSection
                        id="directives"
                        title="التوجيهات"
                        icon={AlertCircle}
                        isOpen={expandedSections.directives}
                        color="from-red-600 to-red-500"
                        onToggle={() => toggleSection('directives')}
                    >
                        <div className="p-2">
                            <MediaSectionEditor
                                type="directive"
                                title="محتوى التوجيهات الهامة"
                                placeholder="اكتب التوجيه هنا... سيظهر هذا النص في نافذة منبثقة حمراء تتطلب تأكيد القراءة."
                            />
                        </div>
                    </AccordionSection>

                    {/* Conferences Section (Green) */}
                    <AccordionSection
                        id="conferences"
                        title="النشاطات"
                        icon={User}
                        isOpen={expandedSections.conferences}
                        color="from-green-600 to-green-500"
                        onToggle={() => toggleSection('conferences')}
                    >
                        <div className="p-2">
                            <MediaSectionEditor
                                type="conference"
                                title="محتوى النشاطات"
                                placeholder="اكتب تفاصيل المؤتمر هنا... سيظهر هذا النص في نافذة خضراء."
                            />
                        </div>
                    </AccordionSection>

                </div>
            )}


        </Layout>
    );
};


function RecordSection({ id, title, icon: Icon, color, data, onSave, onDelete, type, fields, isOpen, onToggle, selectedYear }: any) {
    const [newItem, setNewItem] = useState<any>({});
    const [isEditing, setIsEditing] = useState(false);

    // Auto-calculate duration helper
    const calculateDuration = () => {
        if (newItem.start_date && newItem.end_date) {
            const start = new Date(newItem.start_date);
            const end = new Date(newItem.end_date);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                const diffTime = Math.abs(end.getTime() - start.getTime());
                // Iraq Rule: Duration is inclusive of start and end date
                return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            }
        }
        return 0;
    };

    // Custom Save Handler to calculate duration and validate
    const handleSave = () => {
        let finalItem = { ...newItem };

        if (type === 'leaves') {
            const now = new Date();
            const startStr = finalItem.start_date;
            const endStr = finalItem.end_date;

            // Basic Date Presence Check
            if (!startStr) {
                alert("يرجى تحديد تاريخ الانفكاك");
                return;
            }

            const start = new Date(startStr);
            const end = endStr ? new Date(endStr) : null;

            // 1. Future Checks (Relative to current time)
            if (start > now) {
                alert("خطأ: لا يمكن اختيار تاريخ انفكاك في المستقبل!");
                return;
            }
            if (end && end > now) {
                alert("خطأ: لا يمكن اختيار تاريخ مباشرة في المستقبل!");
                return;
            }

            // 2. Logic Checks
            if (end && start > end) {
                alert("خطأ: تاريخ الانفكاك يجب أن يكون قبل تاريخ المباشرة!");
                return;
            }

            // Auto calculate duration
            if (startStr && endStr) {
                finalItem.duration = calculateDuration();
            } else {
                finalItem.duration = 0;
            }
        }

        onSave(type, finalItem);
        setNewItem({});
        setIsEditing(false);
    };

    // Inside RecordSection function
    return (
        <div id={`record-section-${id}`} className="rounded-2xl overflow-hidden shadow-lg border border-border mb-4 bg-card">
            <button
                onClick={onToggle}
                className={cn(
                    "w-full p-3 flex items-center justify-between text-white transition-all bg-gradient-to-r hover:brightness-110",
                    color
                )}
            >
                <div className="flex items-center gap-2">
                    <div className="bg-white/20 p-1.5 rounded-lg">
                        <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-sm">{title} ({data.length})</span>
                </div>
                <ChevronDown className={cn("w-5 h-5 transition-transform duration-300", isOpen ? "rotate-180" : "")} />
            </button>

            {isOpen && (
                <div className="p-4 bg-background/50 border-t border-border space-y-4">
                    {/* Add/Edit Form */}
                    <div className={cn("p-4 rounded-xl border space-y-3 transition-colors", isEditing ? "bg-brand-green/10 border-brand-green/30" : "bg-muted/50 border-border")}>
                        <h4 className={cn("text-sm font-bold flex items-center gap-2", isEditing ? "text-brand-green" : "text-foreground/70")}>
                            {isEditing ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            {isEditing ? "تعديل السجل" : "إضافة سجل جديد"}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {fields.map((field: any) => (
                                <div key={field.key} className="grid grid-cols-[132px_1fr] items-center gap-2">
                                    {/* Label */}
                                    <div className="flex justify-start pl-2">
                                        <label className="text-xs text-muted-foreground font-bold block whitespace-nowrap text-right w-full">{field.label}</label>
                                    </div>

                                    {/* Input + Spacer */}
                                    <div className="flex items-center gap-2 relative w-full">
                                        {/* Spacer for alignment (No history here yet, but keeps alignment) */}
                                        <div className="w-6 shrink-0" />

                                        <div className="flex-1 relative">
                                            {field.type === 'select' ? (
                                                <div className="relative">
                                                    <Select
                                                        value={newItem[field.key] || ""}
                                                        onValueChange={(val) => setNewItem({ ...newItem, [field.key]: val })}
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="اختر..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="default_placeholder" className="hidden">اختر...</SelectItem>
                                                            {field.options?.map((opt: string) => (
                                                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            ) : field.type === 'date-fixed-year' ? (
                                                <div className="flex gap-2">
                                                    {/* Day - Number Input */}
                                                    <Input
                                                        type="number"
                                                        placeholder="يوم"
                                                        min={1} max={31}
                                                        value={newItem[field.key] ? newItem[field.key].split('-')[2] : ''}
                                                        onChange={e => {
                                                            let day = e.target.value;
                                                            if (parseInt(day) > 31) day = "31";
                                                            const dayStr = day.length === 1 ? `0${day}` : day;
                                                            const current = newItem[field.key] || `${selectedYear}-01-01`;
                                                            const parts = current.split('-');
                                                            setNewItem({ ...newItem, [field.key]: `${selectedYear || parts[0]}-${parts[1]}-${dayStr}` });
                                                        }}
                                                        className="flex-1 text-center"
                                                    />
                                                    {/* Month */}
                                                    <div className="flex-1 relative">
                                                        <Select
                                                            value={newItem[field.key] ? newItem[field.key].split('-')[1] : ''}
                                                            onValueChange={(val) => {
                                                                const month = val;
                                                                const current = newItem[field.key] || `${selectedYear}-01-01`;
                                                                const parts = current.split('-');
                                                                setNewItem({ ...newItem, [field.key]: `${selectedYear || parts[0]}-${month}-${parts[2]}` });
                                                            }}
                                                        >
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue placeholder="شهر" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                                    <SelectItem key={m} value={m.toString().padStart(2, '0')}>{m}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    {/* Year (Fixed) */}
                                                    <div className="flex-1 bg-muted border border-border rounded-lg px-2 py-2 text-muted-foreground text-sm text-center font-mono select-none flex items-center justify-center">
                                                        {selectedYear}
                                                    </div>
                                                </div>
                                            ) : field.readOnly ? (
                                                <Input
                                                    type="text"
                                                    value={field.key === 'duration' ? calculateDuration() : (newItem[field.key] || "")}
                                                    readOnly
                                                    className="w-full bg-muted border border-border text-muted-foreground cursor-not-allowed font-bold"
                                                />
                                            ) : (
                                                <Input
                                                    type={field.type || "text"}
                                                    placeholder={field.label}
                                                    value={newItem[field.key] || ""}
                                                    onChange={e => setNewItem({ ...newItem, [field.key]: e.target.value })}
                                                    className="flex-1"
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleSave}
                                className={cn("flex-1 py-2 rounded-lg text-sm font-bold transition-colors",
                                    isEditing ? "bg-brand-green text-white hover:bg-brand-green/90" : "bg-brand-green/20 text-brand-green hover:bg-brand-green/30"
                                )}
                            >
                                {isEditing ? "حفظ التعديلات" : "حفظ السجل"}
                            </button>
                            {isEditing && (
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        setNewItem({});
                                    }}
                                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-bold"
                                >
                                    إلغاء
                                </button>
                            )}
                        </div>
                    </div>

                    {/* List using Shared Component */}
                    <RecordList
                        data={data}
                        fields={fields}
                        type={type}
                        onEdit={(item) => {
                            setNewItem(item);
                            setIsEditing(true);
                            // Optional: scroll to form
                        }}
                        onDelete={onDelete}
                    />
                </div>
            )}
        </div>
    );
}

function EditableField({
    label,
    value,
    onChange,
    recordId,
    tableName,
    dbField
}: any) {
    return (
        <div className="grid grid-cols-[132px_1fr] items-center gap-2">
            {/* Label Column: Aligned to Right (RTL Start) */}
            <div className="flex justify-start pl-2">
                <label className="text-xs font-bold block whitespace-nowrap text-muted-foreground text-right w-full">{label}</label>
            </div>

            {/* Input Column: Flex with Icon first (Right in RTL) */}
            <div className="flex items-center gap-2 relative">
                {/* Fixed Width Slot for History Icon (or empty) */}
                <div className="w-6 shrink-0 flex justify-center">
                    {recordId && tableName && dbField && (
                        <HistoryViewer
                            tableName={tableName}
                            recordId={recordId}
                            fieldName={dbField}
                            label={label}
                        />
                    )}
                </div>

                <Input
                    type="text"
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    className="flex-1"
                />
            </div>
        </div>
    );
}

function FinancialInput({ field, value, onChange, recordId, tableName, dbField }: any) {
    if (!field) return null;
    return (
        <div className="grid grid-cols-[132px_1fr] items-center gap-2">
            {/* Label Column */}
            <div className="flex justify-start pl-2">
                <label className="text-[10px] md:text-xs font-bold block whitespace-nowrap text-muted-foreground text-right w-full">{field.label}</label>
            </div>

            {/* Input Column */}
            <div className="flex items-center gap-2 relative w-full">
                {/* Fixed Width Slot for History Icon (or empty) */}
                <div className="w-6 shrink-0 flex justify-center">
                    {recordId && tableName && (dbField || field.key) && (
                        <HistoryViewer
                            tableName={tableName}
                            recordId={recordId}
                            fieldName={dbField || field.key}
                            label={field.label}
                        />
                    )}
                </div>

                <div className="flex-1 relative">
                    {field.options ? (
                        <Select
                            value={value || ""}
                            onValueChange={(val) => onChange(field.key, val)}
                            disabled={field.disabled}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="اختر..." />
                            </SelectTrigger>
                            <SelectContent>
                                {field.options.map((opt: string) => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <div className="relative w-full">
                            <Input
                                type={field.isMoney ? "number" : "text"}
                                value={value || ""}
                                onChange={(e) => onChange(field.key, e.target.value)}
                                disabled={field.disabled}
                                className={cn("no-spin w-full", field.isMoney && "pl-10")}
                            />
                            {field.isMoney && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">د.ع</span>}
                            {field.suffix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">{field.suffix}</span>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
