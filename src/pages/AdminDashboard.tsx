
import { useState, useRef, useEffect } from "react";
import { Layout } from "../components/layout/Layout";
import { GlassCard } from "../components/ui/GlassCard";
import { UserPlus, Settings, Save, Search, User, Wallet, Scissors, ChevronDown, Loader2, FileText, Plus, Trash2, Calendar, Award, Pencil } from "lucide-react";
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
        role: "user"
    });

    // Manage Employees State
    const [searchJobNumber, setSearchJobNumber] = useState("");
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

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
                        const y = element.getBoundingClientRect().top + window.scrollY - 100; // Offset for header
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
            if (!query) {
                setSuggestions([]);
                setShowSuggestions(false);
                return;
            }

            setIsSearching(true);
            try {
                // Search by job number OR full name
                const { data, error } = await supabase
                    .from('app_users')
                    .select('id, full_name, job_number, username, role')
                    .or(`job_number.ilike.${query}%,full_name.ilike.${query}%`)
                    .limit(20);

                if (error) {
                    console.error("Suggestion fetch error:", error);
                } else {
                    setSuggestions(data || []);
                    setShowSuggestions(true);
                }
            } catch (err) {
                console.error("Suggestion error:", err);
            } finally {
                setIsSearching(false);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(delaySearch);
    }, [searchJobNumber]);

    const handleSelectSuggestion = async (user: any) => {
        setSearchJobNumber(user.job_number); // Set ID to ensure search works
        setShowSuggestions(false);
        // Call existing search logic directly for this user
        await handleSearch(user.job_number);
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
                        const y = element.getBoundingClientRect().top + window.scrollY - 250; // Increased offset for header/tabs
                        window.scrollTo({ top: y, behavior: 'smooth' });
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
                    role: selectedEmployee.role
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

            // Reset to search view
            setSelectedEmployee(null);
            setFinancialData(null);
            setAdminData(null);
            setYearlyData([]);
            setSearchJobNumber("");
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
            setFormData({ username: "", password: "", full_name: "", job_number: "", role: "user" });
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
                label: 'الشهادة',
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

    return (
        <Layout>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-brand-green/20 text-brand-green border border-brand-green/20">
                        <Settings className="w-6 h-6" />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">إدارة النظام</h1>
                </div>

                <div className="flex bg-black/40 backdrop-blur-md p-1.5 rounded-2xl border border-white/5 shadow-inner w-full md:w-auto">
                    <button
                        onClick={() => setActiveTab('admin_add')}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl transition-all font-bold text-sm",
                            activeTab === 'admin_add' ? "bg-brand-green text-white shadow-lg" : "text-white/40 hover:text-white/60"
                        )}
                    >
                        <UserPlus className="w-4 h-4" />
                        <span>إضافة موظف</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('admin_manage')}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl transition-all font-bold text-sm",
                            activeTab === 'admin_manage' ? "bg-brand-green text-white shadow-lg" : "text-white/40 hover:text-white/60"
                        )}
                    >
                        <Search className="w-4 h-4" />
                        <span>إدارة الموظفين</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('admin_records')}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl transition-all font-bold text-sm",
                            activeTab === 'admin_records' ? "bg-brand-green text-white shadow-lg" : "text-white/40 hover:text-white/60"
                        )}
                    >
                        <FileText className="w-4 h-4" />
                        <span>إدارة السجلات</span>
                    </button>
                </div>
            </div>

            <div className="mb-24">

                {/* TAB: Add Employee */}
                {activeTab === 'admin_add' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <GlassCard className="p-6 md:p-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-white/70">الاسم الكامل</label>
                                    <div className="relative">
                                        <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                                        <input
                                            type="text"
                                            value={formData.full_name}
                                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white focus:outline-none focus:border-brand-green/50 transition-colors"
                                            placeholder="الاسم الرباعي واللقب"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-white/70">الرقم الوظيفي</label>
                                    <div className="relative">
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-white/10 rounded text-center min-w-[24px]">
                                            <span className="text-xs font-mono text-white/50">#</span>
                                        </div>
                                        <input
                                            type="text"
                                            value={formData.job_number}
                                            onChange={(e) => setFormData({ ...formData, job_number: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white focus:outline-none focus:border-brand-green/50 transition-colors font-mono"
                                            placeholder="123456"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-white/70">اسم المستخدم (للدخول)</label>
                                    <div className="relative">
                                        <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                                        <input
                                            type="text"
                                            value={formData.username}
                                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white focus:outline-none focus:border-brand-green/50 transition-colors"
                                            placeholder="username"
                                            dir="ltr"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-white/70">كلمة المرور</label>
                                    <div className="relative">
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 flex items-center justify-center">
                                            <span className="text-lg">●</span>
                                        </div>
                                        <input
                                            type="text"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white focus:outline-none focus:border-brand-green/50 transition-colors font-mono"
                                            placeholder="password"
                                            dir="ltr"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-white/70">نوع الحساب</label>
                                    <div className="grid grid-cols-2 gap-3 p-1 bg-white/5 rounded-xl border border-white/10">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, role: 'user' })}
                                            className={cn(
                                                "flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all",
                                                formData.role === 'user' ? "bg-white/10 text-white shadow-sm ring-1 ring-white/20" : "text-white/40 hover:text-white/60"
                                            )}
                                        >
                                            <User className="w-4 h-4" />
                                            <span>موظف</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, role: 'admin' })}
                                            className={cn(
                                                "flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all",
                                                formData.role === 'admin' ? "bg-brand-green/20 text-brand-green shadow-sm ring-1 ring-brand-green/20" : "text-white/40 hover:text-white/60"
                                            )}
                                        >
                                            <Settings className="w-4 h-4" />
                                            <span>مدير</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </GlassCard>
                    </div>
                )}

                {/* TAB: Manage Employees */}
                {activeTab === 'admin_manage' && (
                    <div className="space-y-6">
                        {/* Sticky Search Bar */}
                        <div className="sticky top-20 z-40 animate-in fade-in slide-in-from-top-4 duration-500">
                            <GlassCard className="p-4 relative overflow-visible z-20">
                                <div className="flex gap-3 relative" ref={searchRef}>
                                    <div className="flex-1 relative">
                                        <input
                                            type="text"
                                            placeholder="بحث عن موظف (الرقم الوظيفي أو الاسم)..."
                                            value={searchJobNumber}
                                            onChange={e => setSearchJobNumber(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                            onFocus={() => {
                                                if (suggestions.length > 0) setShowSuggestions(true);
                                            }}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-green/50"
                                        />
                                        {/* Suggestions Dropdown */}
                                        {showSuggestions && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[220px] overflow-y-auto custom-scrollbar">
                                                {suggestions.map((user, idx) => (
                                                    <button
                                                        key={user.id || idx}
                                                        onClick={() => handleSelectSuggestion(user)}
                                                        className="w-full text-right px-4 py-3 hover:bg-white/10 border-b border-white/5 last:border-0 flex items-center justify-between group transition-colors"
                                                    >
                                                        <div>
                                                            <div className="font-bold text-white group-hover:text-brand-green transition-colors">{user.full_name}</div>
                                                            <div className="text-xs text-white/50">{user.job_number}</div>
                                                        </div>
                                                        <span className="text-xs bg-white/10 px-2 py-1 rounded text-white/70">
                                                            {user.role === 'admin' ? 'مدير' : 'موظف'}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleSearch()}
                                        disabled={loading}
                                        className="bg-brand-green text-white px-5 rounded-xl hover:opacity-90 disabled:opacity-50 transition-all active:scale-95"
                                    >
                                        {loading || isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                                    </button>
                                </div>
                            </GlassCard>
                        </div>

                        {selectedEmployee ? (
                            <div ref={detailsRef} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-10 scroll-mt-20">
                                {/* Employee Card Header */}
                                <GlassCard className="p-6 border-brand-green/20 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-green/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-brand-green/10 transition-colors" />

                                    <div className="flex items-center justify-between relative z-10">
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-green to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-brand-green/20">
                                                <User className="w-8 h-8" />
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-bold text-white mb-1">{selectedEmployee.full_name}</h2>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white/60 text-sm font-mono bg-white/5 px-2 py-0.5 rounded">{selectedEmployee.job_number}</span>
                                                    <span className="text-brand-green text-xs font-bold px-2 py-0.5 rounded bg-brand-green/10 border border-brand-green/10">
                                                        {selectedEmployee.role === 'admin' ? 'مدير نظام' : 'موظف'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </GlassCard>

                                <AccordionSection
                                    title="البيانات الأساسية والحساب"
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
                                        <EditableField
                                            label="الرقم الوظيفي"
                                            value={selectedEmployee.job_number}
                                            onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, job_number: val })}
                                        />
                                        <EditableField
                                            label="اسم المستخدم"
                                            value={selectedEmployee.username}
                                            onChange={(val: string) => setSelectedEmployee({ ...selectedEmployee, username: val })}
                                        />
                                        <div className="space-y-2">
                                            <label className="text-xs text-white/40 font-bold block">نوع الحساب</label>
                                            <select
                                                value={selectedEmployee.role}
                                                onChange={(e) => setSelectedEmployee({ ...selectedEmployee, role: e.target.value })}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-green/50"
                                            >
                                                <option value="user" className="bg-slate-900">موظف</option>
                                                <option value="admin" className="bg-slate-900">مدير</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-white/5">
                                        <div className="space-y-2">
                                            <label className="text-xs text-white/40 font-bold block mb-2">تغيير كلمة المرور (اختياري)</label>
                                            <input
                                                type="text"
                                                placeholder="أدخل كلمة مرور جديدة للتغيير فقط"
                                                onChange={(e) => {
                                                    if (e.target.value) {
                                                        setSelectedEmployee({ ...selectedEmployee, new_password: e.target.value });
                                                    } else {
                                                        const { new_password, ...rest } = selectedEmployee;
                                                        setSelectedEmployee(rest);
                                                    }
                                                }}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-green/50 font-mono"
                                            />
                                        </div>
                                    </div>
                                </AccordionSection>

                                <AccordionSection
                                    title="المعلومات الاساسية والرواتب"
                                    icon={User}
                                    isOpen={expandedSections.basic}
                                    color="from-blue-600 to-blue-500"
                                    onToggle={() => toggleSection('basic')}
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {financialFields.basic.map(field => (
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

                                <div className="pb-32"></div>
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
                        {/* Search Bar (Reused Logic) */}
                        <GlassCard className="p-4 relative overflow-visible z-20">
                            <div className="flex gap-3 relative" ref={searchRef}>
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        placeholder="بحث عن موظف (الرقم الوظيفي أو الاسم)..."
                                        value={searchJobNumber}
                                        onChange={e => setSearchJobNumber(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                        onFocus={() => {
                                            if (suggestions.length > 0) setShowSuggestions(true);
                                        }}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-green/50"
                                    />
                                    {/* Suggestions Dropdown */}
                                    {showSuggestions && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[220px] overflow-y-auto custom-scrollbar">
                                            {suggestions.map((user, idx) => (
                                                <button
                                                    key={user.id || idx}
                                                    onClick={() => handleSelectSuggestion(user)}
                                                    className="w-full text-right px-4 py-3 hover:bg-white/10 border-b border-white/5 last:border-0 flex items-center justify-between group transition-colors"
                                                >
                                                    <div>
                                                        <div className="font-bold text-white group-hover:text-brand-green transition-colors">{user.full_name}</div>
                                                        <div className="text-xs text-white/50">{user.job_number}</div>
                                                    </div>
                                                    <span className="text-xs bg-white/10 px-2 py-1 rounded text-white/70">
                                                        {user.role === 'admin' ? 'مدير' : 'موظف'}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleSearch()}
                                    disabled={loading}
                                    className="bg-brand-green text-white px-5 rounded-xl hover:opacity-90 disabled:opacity-50 transition-all active:scale-95"
                                >
                                    {loading || isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                                </button>
                            </div>
                        </GlassCard>

                        {selectedEmployee ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Employee Header */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-2xl font-bold text-white">{selectedEmployee.full_name}</h2>
                                        <p className="text-white/40">{selectedEmployee.job_title}</p>
                                    </div>
                                    <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                                        <span className="text-brand-green font-mono font-bold text-lg">{selectedEmployee.job_number}</span>
                                    </div>
                                </div>

                                {/* Year Selection */}
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                                    <h3 className="text-white/70 mb-2 font-bold flex items-center gap-2 text-sm">
                                        <Calendar className="w-4 h-4" />
                                        حدد السنة المالية
                                    </h3>
                                    <YearSlider selectedYear={selectedAdminYear} onYearChange={setSelectedAdminYear} />
                                </div>

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
                                        fields={[
                                            { key: 'book_number', label: 'رقم الكتاب' },
                                            { key: 'book_date', label: 'تاريخ الكتاب', type: 'date' },
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
                                        fields={[
                                            { key: 'committee_name', label: 'اسم اللجنة' },
                                            { key: 'role', label: 'العضوية / الصفة' },
                                            { key: 'start_date', label: 'تاريخ اللجنة', type: 'date' }
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
                                        fields={[
                                            { key: 'penalty_type', label: 'نوع العقوبة' },
                                            { key: 'reason', label: 'السبب' },
                                            { key: 'penalty_date', label: 'تاريخ العقوبة', type: 'date' },
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
                                        fields={[
                                            { key: 'leave_type', label: 'نوع الاجازة' },
                                            { key: 'start_date', label: 'تاريخ البدء', type: 'date' },
                                            { key: 'duration', label: 'المدة (يوم)', type: 'number' },
                                            { key: 'end_date', label: 'تاريخ الانتهاء', type: 'date' }
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
            </div>

            {/* Sticky Action Footer */}
            <div className="fixed bottom-0 left-0 right-0 p-4 z-50 bg-gradient-to-t from-[#0f172a] via-[#0f172a] to-transparent pointer-events-none flex justify-center pb-6">
                <div className="pointer-events-auto bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-2 w-full max-w-2xl shadow-2xl flex items-center gap-4">
                    {activeTab === 'admin_add' && (
                        <button
                            onClick={(e) => handleSaveEmployee(e)}
                            disabled={loading}
                            className="flex-1 py-3 px-6 bg-brand-green hover:bg-brand-green/90 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-green/20 disabled:opacity-50 transition-all"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            <span>حفظ بيانات الموظف الجديد</span>
                        </button>
                    )}

                    {activeTab === 'admin_manage' && selectedEmployee && (
                        <button
                            onClick={handleUpdateEmployee}
                            disabled={loading}
                            className="flex-1 py-3 px-6 bg-brand-green hover:bg-brand-green/90 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-green/20 disabled:opacity-50 transition-all"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            <span>حفظ كافة التعديلات</span>
                        </button>
                    )}

                    {activeTab === 'admin_records' && (
                        <div className="flex-1 text-center py-3 text-white/40 text-sm">
                            التحكم يتم مباشرة من خلال الأزرار داخل كل قسم
                        </div>
                    )}

                    {(!activeTab || (activeTab === 'admin_manage' && !selectedEmployee)) && (
                        <div className="flex-1 text-center py-3 text-white/40 text-sm">
                            الرجاء اختيار إجراء للبدء
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};


function RecordSection({ id, title, icon: Icon, color, data, onSave, onDelete, type, fields, isOpen, onToggle }: any) {
    const [newItem, setNewItem] = useState<any>({});
    const [isEditing, setIsEditing] = useState(false);

    return (
        <div id={`record-section-${id}`} className="rounded-2xl overflow-hidden shadow-lg border border-white/5 mb-4">
            <button
                onClick={onToggle}
                className={cn(
                    "w-full p-4 flex items-center justify-between text-white transition-all bg-gradient-to-r hover:brightness-110",
                    color
                )}
            >
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                        <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-bold">{title} ({data.length})</span>
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
                                    <input
                                        type={field.type || "text"}
                                        placeholder={field.label}
                                        value={newItem[field.key] || ""}
                                        onChange={e => setNewItem({ ...newItem, [field.key]: e.target.value })}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-green/30"
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    onSave(type, newItem);
                                    setNewItem({});
                                    setIsEditing(false);
                                }}
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

                    {/* List */}
                    <div className="space-y-2">
                        {data.map((item: any, idx: number) => (
                            <div key={item.id || idx} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-white text-sm">{item[fields[0].key]}</span>
                                        {item.book_date && <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded">{item.book_date}</span>}
                                        {item.start_date && <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded">{item.start_date}</span>}
                                        {item.penalty_date && <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded">{item.penalty_date}</span>}
                                    </div>
                                    <p className="text-white/60 text-xs">{item[fields[1].key]}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => {
                                            setNewItem(item); // Populate form
                                            setIsEditing(true); // Switch mode
                                            // Scroll to form (optional, simplified)
                                        }}
                                        className="p-2 text-white/20 hover:text-brand-green hover:bg-brand-green/10 rounded-lg transition-colors"
                                        title="تعديل"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => onDelete(type, item.id)}
                                        className="p-2 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                        title="حذف"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {data.length === 0 && (
                            <p className="text-center text-white/20 text-sm py-4">لا توجد سجلات</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function AccordionSection({ title, icon: Icon, isOpen, onToggle, children, color }: any) {
    return (
        <div id={`section-${title.replace(/\s/g, '_')}`} className="rounded-2xl overflow-hidden shadow-lg border border-white/5">
            <button
                onClick={onToggle}
                className={cn(
                    "w-full p-4 flex items-center justify-between text-white transition-all bg-gradient-to-r hover:brightness-110",
                    color ? color : "from-emerald-600 to-emerald-500"
                )}
            >
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                        <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-bold">{title}</span>
                </div>
                <ChevronDown className={cn("w-5 h-5 transition-transform duration-300", isOpen ? "rotate-180" : "")} />
            </button>
            {isOpen && (
                <div className="p-4 bg-black/20 border-t border-white/5 space-y-4">
                    {children}
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
                <select
                    value={value || ""}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    disabled={field.disabled}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-green/50 disabled:opacity-50"
                >
                    <option value="">اختر...</option>
                    {field.options.map((opt: string) => (
                        <option key={opt} value={opt} className="bg-slate-900">{opt}</option>
                    ))}
                </select>
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

