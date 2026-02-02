
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Layout } from "../components/layout/Layout";
import { GlassCard } from "../components/ui/GlassCard";
import { AccordionSection } from "../components/ui/AccordionSection";
import { RecordList } from "../components/features/RecordList";
import { Search, User, Wallet, Scissors, ChevronDown, Loader2, FileText, Plus, Award, Pencil } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "react-hot-toast";
import { cn } from "../lib/utils";
import { YearSlider } from "../components/features/YearSlider";



import { useAuth } from "../context/AuthContext";

export const AdminDashboard = () => {
    const { user: currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState<'admin_add' | 'admin_manage' | 'admin_records'>('admin_add');
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
        admin_summary: false,
        yearly_records: false
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
        // Call existing search logic directly for this user
        await handleSearch(user.job_number);
        console.log("After handleSearch completed");
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
                return;
            }


            setSelectedEmployee(userData);
            console.log("Selected employee set:", userData.full_name, "ID:", userData.id);
            setSearchExpanded(false); // Hide search after successful data fetch

            // جلب سجلاته المالية
            const { data: finData, error: finError } = await supabase
                .from('financial_records')
                .select('*')
                .eq('user_id', userData.id)
                .maybeSingle();

            if (finError) throw finError;

            // إذا وجدنا الموظف ولم نجد بياناته المالية، ننشئ سجل افتراضي محلي ليتمكن المدير من تعبئته
            const emptyFinancial = {
                user_id: userData.id,
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
                setFinancialData({ ...emptyFinancial, ...finData });
            }

            // 3. Fetch Administrative Summary
            const { data: admData, error: admError } = await supabase
                .from('administrative_summary')
                .select('*')
                .eq('user_id', userData.id)
                .maybeSingle();

            if (!admError) {
                setAdminData(admData || {
                    user_id: userData.id,
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
                .eq('user_id', userData.id)
                .order('year', { ascending: false });

            if (!yError) {
                // If no records, maybe initialize current year? letting UI handle it.
                setYearlyData(yData || []);
            }

            toast.success("تم جلب بيانات الموظف بنجاح");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
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
        const calcCertAllowance = (certPercentage / 100) * nominalSalary;

        if (Number(financialData.certificate_allowance) !== calcCertAllowance) {
            newFinancialData.certificate_allowance = calcCertAllowance;
            shouldUpdate = true;
        }

        // 2. Calculate Engineering Allowance
        const engineeringTitles = ['مهندس', 'ر. مهندسين', 'ر. مهندسين اقدم', 'ر. مهندسين اقدم اول'];
        let calcEngAllowance = 0;
        if (engineeringTitles.includes(financialData.job_title)) {
            calcEngAllowance = nominalSalary * 0.35; // 35% fixed
        }

        if (Number(financialData.engineering_allowance) !== calcEngAllowance) {
            newFinancialData.engineering_allowance = calcEngAllowance;
            shouldUpdate = true;
        }

        // 3. Calculate Deductions
        // Tax Deduction: 3.5% of Nominal Salary, formatted to max 3 decimal places
        let calcTaxDeduction = nominalSalary * 0.035;
        // Check if it has decimals
        if (!Number.isInteger(calcTaxDeduction)) {
            // Check if it has more than 3 decimal places
            const str = calcTaxDeduction.toString();
            if (str.includes('.') && str.split('.')[1].length > 3) {
                // Truncate to 3 decimal places without rounding up
                calcTaxDeduction = Math.floor(calcTaxDeduction * 1000) / 1000;
            }
        }

        if (Number(financialData.tax_deduction_amount) !== calcTaxDeduction) {
            newFinancialData.tax_deduction_amount = calcTaxDeduction;
            shouldUpdate = true;
        }

        // Retirement Deduction: 10% of Nominal Salary
        const calcRetirement = nominalSalary * 0.10;
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
        const calcSocialSecurity = nominalSalary * 0.0025;
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
                yearly_records: false
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
                    iban: selectedEmployee.iban
                })
                .eq('id', selectedEmployee.id);

            if (userError) throw userError;

            // 2. تحديث البيانات المالية
            const { error: finError } = await supabase
                .from('financial_records')
                .upsert({
                    ...financialData,
                    user_id: selectedEmployee.id,
                    updated_at: new Date().toISOString()
                });

            if (finError) throw finError;

            // 3. تحديث البيانات الإدارية
            if (adminData) {
                const { error: admError } = await supabase
                    .from('administrative_summary')
                    .upsert({
                        ...adminData,
                        user_id: selectedEmployee.id,
                        updated_at: new Date().toISOString()
                    });
                if (admError) throw admError;
            }

            // 4. تحديث السجلات السنوية
            if (yearlyData && yearlyData.length > 0) {
                const { error: yError } = await supabase
                    .from('yearly_records')
                    .upsert(yearlyData.map(r => ({ ...r, updated_at: new Date().toISOString() })));
                if (yError) throw yError;
            }

            toast.success("تم حفظ كافة التعديلات بنجاح في قاعدة البيانات");

            // Option: Re-fetch explicitly to ensure UI mimics DB, or just trust local state. 
            // We will trust local state for now to keep it responsive.
            // No reset here.
        } catch (error: any) {
            console.error("Update error:", error);
            toast.error(error.message || "فشل في حفظ التعديلات");
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
                admin_summary: false,
                yearly_records: false
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
        ],
        allowances: [
            { key: 'certificate_allowance', label: 'مخصصات الشهادة', isMoney: true, disabled: true },
            { key: 'engineering_allowance', label: 'مخصصات هندسية', isMoney: true, disabled: true },
            { key: 'legal_allowance', label: 'مخصصات القانونية', isMoney: true, disabled: true },
            { key: 'transport_allowance', label: 'مخصصات النقل', isMoney: true, options: ['20000', '30000'] },
            { key: 'marital_allowance', label: 'مخصصات الزوجية', isMoney: true },
            { key: 'children_allowance', label: 'مخصصات الاطفال', isMoney: true },
            { key: 'position_allowance', label: 'مخصصات المنصب', isMoney: true },
            { key: 'risk_allowance', label: 'مخصصات الخطورة', isMoney: true },
            { key: 'additional_50_percent_allowance', label: 'مخصصات اضافية 50%', isMoney: true },
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
        setFinancialData({ ...financialData, [key]: value });
    };

    // Header Content with Tabs and Search
    const headerContent = (
        <div className="space-y-3">
            {/* Tabs */}
            <div className="flex bg-black/40 backdrop-blur-md p-1 rounded-xl border border-white/5 shadow-inner w-full">
                <button
                    onClick={() => setActiveTab('admin_add')}
                    className={cn(
                        "flex-1 flex items-center justify-center px-4 py-2 rounded-lg transition-all font-bold text-xs",
                        activeTab === 'admin_add' ? "bg-blue-600 text-white shadow-lg" : "text-white/40 hover:text-white/60"
                    )}
                >
                    <span>إضافة موظف</span>
                </button>
                <button
                    onClick={() => setActiveTab('admin_manage')}
                    className={cn(
                        "flex-1 flex items-center justify-center px-4 py-2 rounded-lg transition-all font-bold text-xs",
                        activeTab === 'admin_manage' ? "bg-blue-600 text-white shadow-lg" : "text-white/40 hover:text-white/60"
                    )}
                >
                    <span>إدارة الموظفين</span>
                </button>
                <button
                    onClick={() => setActiveTab('admin_records')}
                    className={cn(
                        "flex-1 flex items-center justify-center px-4 py-2 rounded-lg transition-all font-bold text-xs",
                        activeTab === 'admin_records' ? "bg-blue-600 text-white shadow-lg" : "text-white/40 hover:text-white/60"
                    )}
                >
                    <span>إدارة السجلات</span>
                </button>
            </div>

            {/* Search & Year Slider (only in manage & records tabs) */}
            {/* Search & Year Slider (Unified Toolbar) */}
            <div className="flex items-center justify-between gap-3 relative overflow-visible h-10 min-h-[40px]">

                {/* Right Side (Start in RTL): Year Slider (Reserved Slot) */}
                <div className="flex-shrink-0 min-w-[140px]">
                    {activeTab === 'admin_records' ? (
                        <div className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-lg border border-white/5 animate-in fade-in zoom-in duration-300">
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
                        <div className="w-full h-full" />
                    )}
                </div>

                {/* Left Side (End in RTL): Name + Search */}
                <div className="flex items-center gap-3">

                    {/* User Name - Hidden when search is expanded */}
                    {!searchExpanded && selectedEmployee && (
                        <h3 className="text-white font-bold text-sm animate-in fade-in duration-200">
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
                                    className="w-48 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-green/50"
                                />
                                {/* Suggestions Dropdown using Portal */}
                                {showSuggestions && suggestions.length > 0 && searchRef.current && createPortal(
                                    <div
                                        className="suggestions-dropdown fixed bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden z-[9999] max-h-[180px] overflow-y-auto"
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
                                                className="w-full text-right px-3 py-2 hover:bg-white/10 border-b border-white/5 last:border-0 flex items-center justify-between group transition-colors cursor-pointer"
                                            >
                                                <div>
                                                    <div className="font-bold text-xs text-white group-hover:text-brand-green transition-colors">{user.full_name}</div>
                                                    <div className="text-[10px] text-white/50">{user.job_number}</div>
                                                </div>
                                                <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/70">
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
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 mx-6">
                    <GlassCard className="p-6 max-w-2xl mx-auto">
                        <div className="space-y-4">
                            {/* Row 1: Full Name */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-white/70">الاسم الكامل</label>
                                <div className="relative">
                                    <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                    <input
                                        type="text"
                                        value={formData.full_name}
                                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 pr-9 text-sm text-white focus:outline-none focus:border-brand-green/50 transition-colors"
                                        placeholder="الاسم الرباعي واللقب"
                                    />
                                </div>
                            </div>

                            {/* Row 2: Account Type (2 Tik Design) */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-white/70">نوع الحساب</label>
                                <div className="flex gap-4 p-2 bg-white/5 rounded-xl border border-white/10">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, role: 'user' })}
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all",
                                            formData.role === 'user' ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.2)]" : "text-white/40 hover:bg-white/5"
                                        )}
                                    >
                                        <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", formData.role === 'user' ? "border-blue-400 bg-blue-400" : "border-white/30")}>
                                            {formData.role === 'user' && <User className="w-2.5 h-2.5 text-white" />}
                                        </div>
                                        <span className="text-xs font-bold">موظف</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, role: 'admin' })}
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all",
                                            formData.role === 'admin' ? "bg-brand-green/20 text-brand-green ring-1 ring-brand-green/50 shadow-[0_0_10px_rgba(34,197,94,0.2)]" : "text-white/40 hover:bg-white/5"
                                        )}
                                    >
                                        <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", formData.role === 'admin' ? "border-brand-green bg-brand-green" : "border-white/30")}>
                                            {formData.role === 'admin' && <User className="w-2.5 h-2.5 text-white" />}
                                        </div>
                                        <span className="text-xs font-bold">مشرف</span>
                                    </button>
                                </div>
                            </div>

                            {/* Row 3: Job Number */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-white/70">الرقم الوظيفي الموحد</label>
                                <div className="relative">
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 bg-white/10 rounded text-center min-w-[20px]">
                                        <span className="text-[10px] font-mono text-white/50">#</span>
                                    </div>
                                    <input
                                        type="text"
                                        value={formData.job_number}
                                        onChange={(e) => setFormData({ ...formData, job_number: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 pr-10 text-sm text-white focus:outline-none focus:border-brand-green/50 transition-colors font-mono"
                                        placeholder="123456"
                                    />
                                </div>
                            </div>

                            {/* Row 4: IBAN */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-white/70">رمز ( IBAN )</label>
                                <div className="relative">
                                    <Wallet className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                    <input
                                        type="text"
                                        value={formData.iban}
                                        onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 pr-9 text-sm text-white focus:outline-none focus:border-brand-green/50 transition-colors font-mono"
                                        placeholder="IQ..."
                                        dir="ltr"
                                    />
                                </div>
                            </div>

                            {/* Row 5: Username */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-white/70">اسم المستخدم المؤقت</label>
                                <div className="relative">
                                    <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                    <input
                                        type="text"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 pr-9 text-sm text-white focus:outline-none focus:border-brand-green/50 transition-colors"
                                        placeholder="username"
                                        dir="ltr"
                                    />
                                </div>
                            </div>

                            {/* Row 6: Password */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-white/70">كلمة المرور المؤقتة</label>
                                <div className="relative">
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 flex items-center justify-center">
                                        <span className="text-base">●</span>
                                    </div>
                                    <input
                                        type="text"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 pr-9 text-sm text-white focus:outline-none focus:border-brand-green/50 transition-colors font-mono"
                                        placeholder="password"
                                        dir="ltr"
                                    />
                                </div>
                            </div>

                        </div>
                    </GlassCard>
                </div>
            )}

            {/* TAB: Manage Employees */}
            {activeTab === 'admin_manage' && (
                <div className="space-y-6">

                    {selectedEmployee ? (
                        <div ref={detailsRef} className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-0 scroll-mt-20 mx-6">

                            <AccordionSection
                                id="main_info"
                                title="معلومات اساسية"
                                icon={User}
                                isOpen={expandedSections.main_info}
                                onToggle={() => toggleSection('main_info')}
                            >
                                {/* Main Info Fields */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <EditableField
                                        label="الاسم الكامل"
                                        value={selectedEmployee.full_name}
                                        onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, full_name: val })}
                                    />

                                    {/* Role Selection (UI matching Add Employee) */}
                                    <div className="space-y-2">
                                        <label className="text-xs text-white/40 font-bold block">نوع الحساب</label>
                                        <div className="flex gap-2 p-1 bg-black/20 rounded-xl border border-white/10">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedEmployee({ ...selectedEmployee, role: 'user' })}
                                                className={cn(
                                                    "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all",
                                                    selectedEmployee.role === 'user' ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50" : "text-white/40 hover:bg-white/5"
                                                )}
                                            >
                                                <div className={cn("w-3 h-3 rounded-full border flex items-center justify-center", selectedEmployee.role === 'user' ? "border-blue-400 bg-blue-400" : "border-white/30")}></div>
                                                <span className="text-xs font-bold">موظف</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setSelectedEmployee({ ...selectedEmployee, role: 'admin' })}
                                                className={cn(
                                                    "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all",
                                                    selectedEmployee.role === 'admin' ? "bg-brand-green/20 text-brand-green ring-1 ring-brand-green/50" : "text-white/40 hover:bg-white/5"
                                                )}
                                            >
                                                <div className={cn("w-3 h-3 rounded-full border flex items-center justify-center", selectedEmployee.role === 'admin' ? "border-brand-green bg-brand-green" : "border-white/30")}></div>
                                                <span className="text-xs font-bold">مشرف</span>
                                            </button>
                                        </div>
                                    </div>

                                    <EditableField
                                        label="الرقم الوظيفي الموحد"
                                        value={selectedEmployee.job_number}
                                        onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, job_number: val })}
                                    />

                                    {/* IBAN Field */}
                                    <EditableField
                                        label="رمز ( IBAN )"
                                        value={selectedEmployee.iban || ""}
                                        onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, iban: val })}
                                    />

                                    <EditableField
                                        label="اسم المستخدم المؤقت"
                                        value={selectedEmployee.username}
                                        onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, username: val })}
                                    />

                                    {/* Password - optional to show here or keep hidden, but logic dictates "Same as A" */}
                                    <div className="space-y-2">
                                        <label className="text-xs text-white/40 font-bold block">كلمة المرور المؤقتة</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={selectedEmployee.password || ""}
                                                onChange={(e) => setSelectedEmployee({ ...selectedEmployee, password: e.target.value })}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-green/50"
                                                dir="ltr"
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
                                    {/* Date of First Direct Commencement - Editable */}
                                    <div className="space-y-2">
                                        <label className="text-xs text-white/40 font-bold block">تأريخ اول مباشر</label>
                                        <input
                                            type="date"
                                            // Prioritize adminData date, fall back to what might be in financialData or empty
                                            value={adminData?.first_appointment_date || ''}
                                            onChange={e => setAdminData({ ...adminData, first_appointment_date: e.target.value })}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-green/50"
                                        />
                                    </div>

                                    {/* Job Title */}
                                    <FinancialInput
                                        key="job_title"
                                        field={financialFields.basic.find(f => f.key === 'job_title')}
                                        value={financialData?.job_title}
                                        onChange={handleFinancialChange}
                                    />

                                    {/* Grade and Education - Same Row */}
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <FinancialInput
                                                key="salary_grade"
                                                field={financialFields.basic.find(f => f.key === 'salary_grade')}
                                                value={financialData?.salary_grade}
                                                onChange={handleFinancialChange}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <FinancialInput
                                                key="certificate_text"
                                                field={financialFields.basic.find(f => f.key === 'certificate_text')}
                                                value={financialData?.certificate_text}
                                                onChange={handleFinancialChange}
                                            />
                                        </div>
                                    </div>

                                    {/* Salary Stage (المرحلة) */}
                                    <div className="space-y-2">
                                        <label className="text-xs text-white/40 font-bold block">المرحلة ضمن الدرجة</label>
                                        <div className="relative">
                                            <select
                                                value={financialData['salary_stage'] || ""}
                                                onChange={(e) => setFinancialData({ ...financialData, 'salary_stage': e.target.value })}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-green/50 appearance-none"
                                            >
                                                <option value="" className="bg-slate-800">اختر المرحلة</option>
                                                {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
                                                    <option key={num} value={num} className="bg-slate-800">{num}</option>
                                                ))}
                                            </select>
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                                <div className="border-t-[4px] border-t-white/30 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent"></div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Certificate Percentage */}
                                    <FinancialInput
                                        key="certificate_percentage"
                                        field={financialFields.basic.find(f => f.key === 'certificate_percentage')}
                                        value={financialData?.certificate_percentage}
                                        onChange={handleFinancialChange}
                                    />

                                    {/* Nominal Salary */}
                                    <FinancialInput
                                        key="nominal_salary"
                                        field={financialFields.basic.find(f => f.key === 'nominal_salary')}
                                        value={financialData?.nominal_salary}
                                        onChange={handleFinancialChange}
                                    />
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
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {financialFields.allowances.map(field => (
                                        <FinancialInput
                                            key={field.key}
                                            field={field}
                                            value={financialData?.[field.key]}
                                            onChange={handleFinancialChange}
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
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {financialFields.deductions.map(field => (
                                        <FinancialInput
                                            key={field.key}
                                            field={field}
                                            value={financialData?.[field.key]}
                                            onChange={handleFinancialChange}
                                        />
                                    ))}
                                </div>
                            </AccordionSection>

                            <AccordionSection
                                id="admin_summary"
                                title="الخلاصة الإدارية"
                                icon={User}
                                isOpen={expandedSections.admin_summary}
                                color="from-purple-600 to-purple-500"
                                onToggle={() => toggleSection('admin_summary')}
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-white/70 text-xs font-bold">تأريخ المباشرة (اول التعيين)</label>
                                        <input
                                            type="date"
                                            value={adminData?.first_appointment_date || ''}
                                            onChange={e => setAdminData({ ...adminData, first_appointment_date: e.target.value })}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-green/50"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-white/70 text-xs font-bold">تاريخ الانفكاك (إجازة 5 سنوات)</label>
                                        <input
                                            type="date"
                                            value={adminData?.disengagement_date || ''}
                                            onChange={e => setAdminData({ ...adminData, disengagement_date: e.target.value })}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-green/50"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-white/70 text-xs font-bold">تاريخ المباشرة (بعد الإجازة)</label>
                                        <input
                                            type="date"
                                            value={adminData?.resumption_date || ''}
                                            onChange={e => setAdminData({ ...adminData, resumption_date: e.target.value })}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-green/50"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-white/70 text-xs font-bold">رصيد الإجازات المتبقي (يدوي/سابق)</label>
                                        <input
                                            type="number"
                                            value={adminData?.remaining_leave_balance || ''}
                                            onChange={e => setAdminData({ ...adminData, remaining_leave_balance: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-green/50"
                                        />
                                    </div>
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
        <div id={`record-section-${id}`} className="rounded-2xl overflow-hidden shadow-lg border border-white/5 mb-4">
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
                <div className="p-4 bg-black/20 border-t border-white/5 space-y-4">
                    {/* Add/Edit Form */}
                    <div className={cn("p-4 rounded-xl border space-y-3 transition-colors", isEditing ? "bg-brand-green/10 border-brand-green/30" : "bg-white/5 border-white/5")}>
                        <h4 className={cn("text-sm font-bold flex items-center gap-2", isEditing ? "text-brand-green" : "text-white/70")}>
                            {isEditing ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            {isEditing ? "تعديل السجل" : "إضافة سجل جديد"}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {fields.map((field: any) => (
                                <div key={field.key} className="space-y-1">
                                    <label className="text-xs text-white/40 font-bold block px-1">{field.label}</label>

                                    {field.type === 'select' ? (
                                        <div className="relative">
                                            <select
                                                value={newItem[field.key] || ""}
                                                onChange={e => setNewItem({ ...newItem, [field.key]: e.target.value })}
                                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 pl-9 text-white text-sm focus:outline-none focus:border-brand-green/30 [&>option]:bg-[#0f172a] appearance-none"
                                            >
                                                <option value="">اختر...</option>
                                                {field.options?.map((opt: string) => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
                                        </div>
                                    ) : field.type === 'date-fixed-year' ? (
                                        <div className="flex gap-2">
                                            {/* Day - Number Input */}
                                            <input
                                                type="number"
                                                placeholder="يوم"
                                                min="1" max="31"
                                                value={newItem[field.key] ? newItem[field.key].split('-')[2] : ''}
                                                onChange={e => {
                                                    let day = e.target.value;
                                                    if (parseInt(day) > 31) day = "31";
                                                    // Zero pad logic
                                                    const dayStr = day.length === 1 ? `0${day}` : day;

                                                    const current = newItem[field.key] || `${selectedYear}-01-01`;
                                                    const parts = current.split('-');
                                                    // Use dayStr for state to match date format, but input displays value prop
                                                    setNewItem({ ...newItem, [field.key]: `${selectedYear || parts[0]}-${parts[1]}-${dayStr}` });
                                                }}
                                                className="flex-1 bg-black/20 border border-white/10 rounded-lg px-2 py-2 text-white text-sm text-center focus:outline-none focus:border-brand-green/30"
                                            />
                                            {/* Month */}
                                            <div className="flex-1 relative">
                                                <select
                                                    value={newItem[field.key] ? newItem[field.key].split('-')[1] : ''}
                                                    onChange={e => {
                                                        const month = e.target.value;
                                                        const current = newItem[field.key] || `${selectedYear}-01-01`;
                                                        const parts = current.split('-');
                                                        setNewItem({ ...newItem, [field.key]: `${selectedYear || parts[0]}-${month}-${parts[2]}` });
                                                    }}
                                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-2 pl-7 text-white text-sm text-center focus:outline-none focus:border-brand-green/30 [&>option]:bg-[#0f172a] appearance-none"
                                                >
                                                    <option value="">شهر</option>
                                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                        <option key={m} value={m.toString().padStart(2, '0')}>{m}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 text-white/50 pointer-events-none" />
                                            </div>
                                            {/* Year (Fixed) */}
                                            <div className="flex-1 bg-white/5 border border-white/5 rounded-lg px-2 py-2 text-white/50 text-sm text-center font-mono select-none">
                                                {selectedYear}
                                            </div>
                                        </div>
                                    ) : field.readOnly ? (
                                        <input
                                            type="text"
                                            value={field.key === 'duration' ? calculateDuration() : (newItem[field.key] || "")}
                                            readOnly
                                            className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-white/50 text-sm cursor-not-allowed text-brand-green font-bold"
                                        />
                                    ) : (
                                        <input
                                            type={field.type || "text"}
                                            placeholder={field.label}
                                            value={newItem[field.key] || ""}
                                            onChange={e => setNewItem({ ...newItem, [field.key]: e.target.value })}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green/30"
                                        />
                                    )}
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

function EditableField({ label, value, onChange }: any) {
    return (
        <div className="space-y-2">
            <label className="text-xs text-white/40 font-bold block">{label}</label>
            <input
                type="text"
                value={value || ""}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-green/50"
            />
        </div>
    );
}

function FinancialInput({ field, value, onChange }: any) {
    return (
        <div className="space-y-2">
            <label className="text-xs text-white/40 font-bold block">{field.label}</label>
            {field.options ? (
                <div className="relative">
                    <select
                        value={value || ""}
                        onChange={(e) => onChange(field.key, e.target.value)}
                        disabled={field.disabled}
                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 pl-10 text-white text-sm focus:outline-none focus:border-brand-green/50 disabled:opacity-50 appearance-none"
                    >
                        <option value="">اختر...</option>
                        {field.options.map((opt: string) => (
                            <option key={opt} value={opt} className="bg-slate-900">{opt}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
                </div>
            ) : (
                <div className="relative">
                    <input
                        type={field.isMoney ? "number" : "text"}
                        value={value || ""}
                        onChange={(e) => onChange(field.key, e.target.value)}
                        disabled={field.disabled}
                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-green/50 disabled:opacity-50"
                    />
                    {field.isMoney && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 text-xs">د.ع</span>}
                    {field.suffix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 text-xs">{field.suffix}</span>}
                </div>
            )}
        </div>
    );
}

