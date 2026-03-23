import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { toast } from "react-hot-toast";

export const useEmployeeManager = (currentUser: any, setActiveTab?: (tab: string) => void, detailsRef?: React.RefObject<HTMLDivElement>) => {
    // 1. Loading State
    const [loading, setLoading] = useState(false);

    // 2. Add Employee Form State
    const [formData, setFormData] = useState({
        username: "",
        password: "",
        full_name: "",
        job_number: "",
        iban: "",
        role: "user",
        admin_role: "developer",
        department_id: null as string | null
    });

    // 3. Search & Manage Employees State
    const [searchJobNumber, setSearchJobNumber] = useState("");
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searchExpanded, setSearchExpanded] = useState(false);

    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [financialData, setFinancialData] = useState<any>(null);
    const [adminData, setAdminData] = useState<any>(null);
    const [yearlyData, setYearlyData] = useState<any[]>([]);

    // 4. Five Year Leave State
    const [activeFiveYearLeave, setActiveFiveYearLeave] = useState<any>(null);
    const [showFiveYearLeaveModal, setShowFiveYearLeaveModal] = useState(false);
    const [showFiveYearLeaveHistoryModal, setShowFiveYearLeaveHistoryModal] = useState(false);
    const [newFiveYearLeave, setNewFiveYearLeave] = useState<any>({
        order_number: '',
        order_date: '',
        start_date: '',
        end_date: ''
    });

    // 5. Admin Records State
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

    // 6. Field Permissions State
    const [fieldPermissions, setFieldPermissions] = useState<any[]>([]);

    const fetchFieldPermissions = async () => {
        try {
            const { data } = await supabase.from('field_permissions').select('*');
            if (data) setFieldPermissions(data);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchFieldPermissions();
    }, []);

    // --- Core Logic Functions ---

    // Load Employee Profile & Related Data
    const loadEmployeeData = async (partialUser: any) => {
        try {
            setLoading(true);

            // Fetch FULL user
            const { data: fullUserData, error: userError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', partialUser.id)
                .single();

            if (userError) throw userError;
            if (!fullUserData) throw new Error("تعذر جلب بيانات الموظف");

            if (fullUserData.avatar && !fullUserData.avatar_url) {
                fullUserData.avatar_url = fullUserData.avatar;
            }

            if (!fullUserData.department_id) {
                const { data: managedDept } = await supabase
                    .from('departments')
                    .select('parent_id')
                    .eq('manager_id', fullUserData.id)
                    .maybeSingle();

                if (managedDept?.parent_id) {
                    fullUserData.department_id = managedDept.parent_id;
                    supabase.from('profiles').update({ department_id: managedDept.parent_id }).eq('id', fullUserData.id).then();
                }
            }

            setSelectedEmployee(fullUserData);
            setSearchExpanded(false);

            // Fetch Financial
            const { data: finData, error: finError } = await supabase
                .from('financial_records')
                .select('*')
                .eq('user_id', fullUserData.id)
                .maybeSingle();

            if (finError) throw finError;

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
                const stripAl = (t: string) => t.replace(/^ال/, '');
                const certOptions = ['دكتوراه', 'ماجستير', 'دبلوم عالي', 'بكالوريوس', 'دبلوم', 'الاعدادية', 'المتوسطة', 'الابتدائية', 'يقرأ ويكتب', 'أمي'];

                if (combined.certificate_text) {
                    let raw = combined.certificate_text.trim();
                    raw = raw.replace(/^[^ء-يa-zA-Z0-9]+/, '').replace(/[^ء-يa-zA-Z0-9]+$/, '').trim();
                    if (raw.includes('بكلوريوس')) raw = 'بكالوريوس';
                    if (raw.includes('بنسبة')) raw = raw.split('بنسبة')[0].trim();

                    const match = certOptions.find(opt =>
                        stripAl(opt) === stripAl(raw) ||
                        opt === raw ||
                        stripAl(opt).replace(/ى/g, 'ي') === stripAl(raw).replace(/ى/g, 'ي') ||
                        raw.includes(opt) || opt.includes(raw)
                    );
                    combined.certificate_text = match || raw;
                }

                if (combined.nominal_salary > 0 && combined.risk_allowance > 0) {
                    const rawPerc = (combined.risk_allowance / combined.nominal_salary) * 100;
                    combined.risk_percentage = Math.round(rawPerc / 5) * 5 + "";
                }

                if (combined.certificate_percentage !== null && combined.certificate_percentage !== undefined) {
                    combined.certificate_percentage = String(combined.certificate_percentage);
                }

                setFinancialData(combined);
            }

            // Fetch Admin
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

            // Fetch Yearly
            const { data: yData, error: yError } = await supabase
                .from('yearly_records')
                .select('*')
                .eq('user_id', fullUserData.id)
                .order('year', { ascending: false });

            if (!yError) setYearlyData(yData || []);

            // Fetch Leaves
            const { data: fylData, error: fylError } = await supabase
                .from('five_year_leaves')
                .select('*')
                .eq('user_id', fullUserData.id)
                .order('created_at', { ascending: false });

            setActiveFiveYearLeave(!fylError && fylData && fylData.length > 0 ? fylData[0] : null);
            setNewFiveYearLeave({ order_number: '', order_date: '', start_date: '', end_date: '' });

            toast.success("تم جلب بيانات الموظف بنجاح");
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "حدث خطأ أثناء تحميل البيانات");
        } finally {
            setLoading(false);
        }
    };

    // Search Job Number
    const handleSearch = async (specificJobNumber?: string) => {
        const trimmedSearch = specificJobNumber || searchJobNumber.trim();
        if (!trimmedSearch) return;
        setLoading(true);
        try {
            const { data: userData, error: userError } = await supabase
                .from('profiles')
                .select('id')
                .or(`job_number.eq.${trimmedSearch},username.eq.${trimmedSearch}`)
                .maybeSingle();

            if (userError) throw userError;

            if (!userData) {
                toast.error("الموظف غير موجود برقم: " + trimmedSearch);
                setSelectedEmployee(null);
                setFinancialData(null);
                setLoading(false);
                return;
            }

            await loadEmployeeData({ id: userData.id });
        } catch (error: any) {
            toast.error(error.message);
            setLoading(false);
        }
    };

    // Update Employee
    const handleUpdateEmployee = async () => {
        if (!selectedEmployee || !financialData) return;
        if (!currentUser) return;

        const { full_name, job_number, username, password } = selectedEmployee;
        if (!full_name?.trim() || !job_number?.trim() || !username?.trim() || !password?.trim()) {
            toast.error("تأكد من ملء الحقول الأساسية");
            return;
        }

        setLoading(true);
        try {
            const certText = financialData.certificate_text?.trim() || '';
            const certPerc = Number(financialData.certificate_percentage || 0);
            const stripAl = (t: string) => t.replace(/^ال/, '');
            let expectedPerc = 0;
            const normalizedCert = stripAl(certText).replace(/ى/g, 'ي');

            if (normalizedCert.includes('دكتوراه')) expectedPerc = 150;
            else if (normalizedCert.includes('ماجستير')) expectedPerc = 125;
            else if (normalizedCert.includes('دبلوم عالي')) expectedPerc = 55;
            else if (normalizedCert.includes('بكلوريوس') || normalizedCert.includes('بكالوريوس')) expectedPerc = 45;
            else if (normalizedCert.includes('دبلوم')) expectedPerc = 35;
            else if (normalizedCert.includes('اعدادية')) expectedPerc = 25;
            else if (normalizedCert.includes('متوسطة') || normalizedCert.includes('ابتدائية') || normalizedCert.includes('يقرأ ويكتب') || normalizedCert.includes('امي')) expectedPerc = 15;

            if (certPerc !== expectedPerc && certText) {
                toast.error(`خطأ: شهادة "${certText}" نسبةها يجب أن تكون ${expectedPerc}%`);
                setLoading(false);
                return;
            }

            const { error: userError } = await supabase
                .from('profiles')
                .update({
                    full_name, job_number, username, password,
                    role: selectedEmployee.role,
                    admin_role: selectedEmployee.role === 'admin' ? (selectedEmployee.admin_role || 'developer') : null,
                    iban: selectedEmployee.iban,
                    department_id: selectedEmployee.department_id,
                    avatar: selectedEmployee.avatar_url || selectedEmployee.avatar,
                    updated_at: new Date().toISOString(),
                    last_modified_by: currentUser.id,
                    last_modified_by_name: currentUser.full_name,
                    last_modified_at: new Date().toISOString()
                })
                .eq('id', selectedEmployee.id);
            if (userError) throw userError;

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
                    }, { onConflict: 'user_id' });
                if (admError) throw admError;
            }

            if (yearlyData && yearlyData.length > 0) {
                const { error: yError } = await supabase
                    .from('yearly_records')
                    .upsert(yearlyData.map(r => ({ ...r, updated_at: new Date().toISOString() })));
                if (yError) throw yError;
            }

            const email = `${job_number}@inftele.com`;
            await supabase.rpc('rpc_sync_user_auth', {
                p_user_id: selectedEmployee.id, p_email: email, p_password: password
            });

            toast.success("تم حفظ التعديلات بنجاح");
        } catch (error: any) {
            toast.error(error.message || "فشل في حفظ التعديلات");
        } finally {
            setLoading(false);
        }
    };

    // Save New Employee
    const handleSaveEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.full_name || !formData.job_number || !formData.username || !formData.password) {
            toast.error("يرجى ملء جميع الحقول الأساسية");
            return;
        }

        setLoading(true);
        try {
            const { data: existingUsers } = await supabase
                .from('profiles')
                .select('job_number, username')
                .or(`job_number.eq.${formData.job_number}, username.eq.${formData.username}`);

            if (existingUsers && existingUsers.length > 0) {
                const existing = existingUsers[0];
                if (existing.job_number === formData.job_number) toast.error("هذا الرقم الوظيفي مستخدم بالفعل!");
                else toast.error("اسم المستخدم هذا موجود بالفعل!");
                return;
            }

            const email = `${formData.job_number}@inftele.com`;
            const newUserId = crypto.randomUUID();

            const { error: syncError } = await supabase.rpc('rpc_sync_user_auth', {
                p_user_id: newUserId, p_email: email, p_password: formData.password
            });
            if (syncError) throw syncError;

            const { data: user, error: userError } = await supabase
                .from('profiles')
                .insert([{ ...formData, id: newUserId, updated_at: new Date().toISOString() }])
                .select().single();
            if (userError) throw userError;

            await supabase.from('financial_records').insert([{ user_id: user.id, nominal_salary: 0 }]);

            toast.success("تم إضافة الموظف بنجاح، جارِ الانتقال...");
            setSearchJobNumber(formData.job_number);
            if (setActiveTab) setActiveTab('admin_manage');
            
            setSelectedEmployee(user);
            setFinancialData({ user_id: user.id, nominal_salary: 0 });

            setTimeout(() => {
                if (detailsRef?.current) detailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);

            setFormData({ username: "", password: "", full_name: "", job_number: "", iban: "", role: "user", admin_role: "developer", department_id: null });
        } catch (error: any) {
            toast.error("فشل إكمال العملية: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteEmployee = async () => {
        if (!selectedEmployee) return;
        if (selectedEmployee.job_number === '103130486' || selectedEmployee.full_name.includes('مسلم عقيل')) {
            toast.error("لا يمكن حذف حساب مدير النظام المطور!");
            return;
        }
        if (!currentUser?.full_name?.includes('مسلم عقيل') && !currentUser?.full_name?.includes('مسلم قيل')) {
            toast.error("عذراً، فقط مدير النظام يمكنه الحذف.");
            return;
        }

        const confirmDelete = window.confirm(`تأكيد حذف: ${selectedEmployee.full_name}؟`);
        if (!confirmDelete) return;

        const confirmJobNumber = window.prompt(`لتأكيد الحذف، اكتب الرقم الوظيفي (${selectedEmployee.job_number}):`);
        if (confirmJobNumber !== selectedEmployee.job_number) return;

        setLoading(true);
        try {
            await supabase.rpc('rpc_delete_user_auth', { p_user_id: selectedEmployee.id });
            await supabase.from('profiles').delete().eq('id', selectedEmployee.id);
            toast.success("تم حذف الموظف بنجاح");
            setSelectedEmployee(null); setFinancialData(null); setAdminData(null); setYearlyData([]); setSearchJobNumber('');
        } catch (error: any) {
            toast.error(error.message || "فشل في حذف الموظف");
        } finally {
            setLoading(false);
        }
    };

    // Five Year Leave Create
    const handleCreateFiveYearLeave = async () => {
        if (!newFiveYearLeave.order_number || !newFiveYearLeave.order_date || !newFiveYearLeave.start_date) {
            toast.error("يرجى ملء جميع حقلي الأمر وتاريخ الانفكاك."); return;
        }
        setLoading(true);
        try {
            await supabase.from('five_year_leaves').insert({
                user_id: selectedEmployee.id, ...newFiveYearLeave, status: 'active',
                created_by: currentUser?.id, created_by_name: currentUser?.full_name
            });
            if (financialData?.id) {
                await supabase.from('financial_records').update({
                    is_five_year_leave: true, leave_start_date: newFiveYearLeave.start_date, leave_end_date: newFiveYearLeave.end_date
                }).eq('id', financialData.id);
            }
            toast.success("تم تفعيل إجازة الخمس سنوات بنجاح.");
            await loadEmployeeData(selectedEmployee);
        } catch (e: any) {
            toast.error(e.message || "حدث خطأ أثناء تفعيل الإجازة.");
        } finally {
            setLoading(false);
        }
    };

    const handleNewFiveYearLeaveChange = (field: string, value: string) => {
        setNewFiveYearLeave((prev: any) => {
            const next = { ...prev, [field]: value };
            if (field === 'start_date' && value) {
                const date = new Date(value);
                date.setFullYear(date.getFullYear() + 5);
                next.end_date = date.toISOString().split('T')[0];
            }
            return next;
        });
    };

    const handleFiveYearLeaveChange = (checked: boolean) => {
        if (!financialData) return;
        setFinancialData({ ...financialData, is_five_year_leave: checked });
        toast.success(checked ? "تم تأشير الموظف بإجازة 5 سنوات" : "تم إزالة التأشير");
    };

    // Admin Records
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
            setAdminRecords({ thanks: thanks.data || [], committees: committees.data || [], penalties: penalties.data || [], leaves: leaves.data || [] });
        } catch (error) {
            toast.error("فشل جلب السجلات");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveRecord = async (type: 'thanks' | 'committees' | 'penalties' | 'leaves', data: any) => {
        if (!selectedEmployee || !currentUser?.id) return;
        const isNewRecord = !data.id;
        setLoading(true);
        try {
            await supabase.from(`${type}_details`).upsert([{
                ...data, user_id: selectedEmployee.id, year: selectedAdminYear,
                last_modified_by: currentUser.id, last_modified_by_name: currentUser.full_name, last_modified_at: new Date().toISOString()
            }]);

            if (isNewRecord) {
                const fieldsMap: any = { thanks: 'thanks_books_count', committees: 'committees_count', penalties: 'penalties_count', leaves: 'leaves_taken' };
                const field = fieldsMap[type];
                if (field) {
                    const yearRec = yearlyData.find(yr => yr.year === selectedAdminYear);
                    if (yearRec) await supabase.from('yearly_records').update({ [field]: (yearRec[field] || 0) + 1 }).eq('id', yearRec.id);
                    else await supabase.from('yearly_records').insert({ user_id: selectedEmployee.id, year: selectedAdminYear, [field]: 1 });
                    
                    const { data: yData } = await supabase.from('yearly_records').select('*').eq('user_id', selectedEmployee.id).order('year', { ascending: false });
                    setYearlyData(yData || []);
                }
            }
            toast.success(isNewRecord ? "تم إضافة السجل" : "تم تحديث السجل");
            fetchAdminRecords();
        } catch (error: any) {
            toast.error("فشل الحفظ: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRecord = async (type: 'thanks' | 'committees' | 'penalties' | 'leaves', id: string) => {
        if (!confirm("تأكيد حذف السجل؟")) return;
        setLoading(true);
        try {
            await supabase.from(`${type}_details`).delete().eq('id', id);
            
            const fieldsMap: any = { thanks: 'thanks_books_count', committees: 'committees_count', penalties: 'penalties_count', leaves: 'leaves_taken' };
            const field = fieldsMap[type];
            if (field) {
                const yearRec = yearlyData.find(yr => yr.year === selectedAdminYear);
                if (yearRec && (yearRec[field] || 0) > 0) {
                    await supabase.from('yearly_records').update({ [field]: (yearRec[field] || 0) - 1 }).eq('id', yearRec.id);
                }
                const { data: yData } = await supabase.from('yearly_records').select('*').eq('user_id', selectedEmployee.id).order('year', { ascending: false });
                setYearlyData(yData || []);
            }
            toast.success("تم الحذف");
            fetchAdminRecords();
        } catch (error: any) {
            toast.error("فشل الحذف: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Auto-search Suggestions (Debounced)
    useEffect(() => {
        const delaySearch = setTimeout(async () => {
            const query = searchJobNumber.trim();
            if (!query || !searchExpanded) { setSuggestions([]); setShowSuggestions(false); return; }
            try {
                const { data } = await supabase.from('profiles').select('id, full_name, job_number, username, role')
                    .or(`job_number.ilike.${query}%,full_name.ilike.${query}%,full_name.ilike.% ${query}%`).limit(50);
                setSuggestions(data || []); setShowSuggestions((data || []).length > 0);
            } catch (err) {
                setSuggestions([]); setShowSuggestions(false);
            }
        }, 300);
        return () => clearTimeout(delaySearch);
    }, [searchJobNumber, searchExpanded]);

    // ----------------------------
    // Financial Fields Definition
    // ----------------------------
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
            { key: 'salary_grade', label: 'الدرجة في سلم الرواتب', options: Array.from({ length: 10 }, (_, i) => (i + 1).toString()) },
            { key: 'salary_stage', label: 'المرحلة في الدرجة الوظيفية', options: Array.from({ length: 10 }, (_, i) => (i + 1).toString()) },
            { key: 'certificate_text', label: 'التحصيل الدراسي', options: ['دكتوراه', 'ماجستير', 'دبلوم عالي', 'بكالوريوس', 'دبلوم', 'الاعدادية', 'المتوسطة', 'الابتدائية', 'يقرأ ويكتب', 'أمي'] },
            { key: 'certificate_percentage', label: 'النسبة المستحقة للشهادة', suffix: '%', options: ['0', '15', '25', '35', '45', '55', '75', '85', '100', '125', '150'] },
            { key: 'nominal_salary', label: 'الراتب الاسمي', isMoney: true },
            { key: 'risk_percentage', label: 'الخطورة %', suffix: '%', options: Array.from({ length: 20 }, (_, i) => ((i + 1) * 5).toString()) },
        ],
        allowances: [
            { key: 'certificate_allowance', label: 'م. الشهادة', isMoney: true },
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
        let newData = { ...financialData, [key]: value };

        if (key === 'certificate_text') {
            let perc = 0;
            const t = value.trim();
            if (t.includes('دكتوراه')) perc = 150;
            else if (t.includes('ماجستير')) perc = 125;
            else if (t.includes('دبلوم عالي')) perc = 55;
            else if (t.includes('بكلوريوس') || t.includes('بكالوريوس')) perc = 45;
            else if (t.includes('دبلوم')) perc = 35;
            else if (t.includes('الاعدادية')) perc = 25;
            else if (t.includes('المتوسطة') || t.includes('الابتدائية') || t.includes('يقرأ ويكتب') || t.includes('أمي')) perc = 15;

            if (perc > 0 || t.includes('يقرأ') || t.includes('أمي')) newData.certificate_percentage = perc;
        }

        if (key === 'certificate_text' || key === 'certificate_percentage' || key === 'nominal_salary') {
            const nominal = parseFloat(String(newData.nominal_salary || '0').replace(/[^0-9.]/g, '') || '0');
            const certP = parseFloat(String(newData.certificate_percentage || '0') || '0');
            if (!isNaN(nominal) && !isNaN(certP) && nominal > 0) {
                newData.certificate_allowance = Math.round(nominal * (certP / 100));
            } else {
                newData.certificate_allowance = 0;
            }
        }

        if (key === 'risk_percentage' || key === 'nominal_salary') {
            const nominal = parseFloat(String(newData.nominal_salary || '0').replace(/[^0-9.]/g, '') || '0');
            const riskP = parseFloat(String(newData.risk_percentage || '0') || '0');
            if (!isNaN(nominal) && !isNaN(riskP)) {
                newData.risk_allowance = Math.round(nominal * (riskP / 100));
            } else {
                newData.risk_allowance = 0;
            }
        }

        setFinancialData(newData);
    };

    const isFieldReadOnly = (columnName: string) => {
        if (columnName === 'tab_requests') {
            const hasExplicitPermission = Boolean(currentUser?.can_view_requests);
            const isAllowedRole = currentUser?.admin_role === 'developer' ||
                currentUser?.admin_role === 'hr' ||
                currentUser?.full_name?.includes('مسلم عقيل') ||
                currentUser?.full_name?.includes('مسلم قيل');
            return !(isAllowedRole || hasExplicitPermission);
        }

        if (currentUser?.admin_role === 'developer' || currentUser?.admin_role === 'general' || currentUser?.full_name?.includes('مسلم عقيل') || currentUser?.full_name?.includes('مسلم قيل')) {
            return false;
        }

        const perm = fieldPermissions.find(p => p.column_name === columnName);
        const requiredLevel = perm ? perm.permission_level : 4;
        if (requiredLevel === 4) return false;

        let currentUserLevel = 4;
        switch (currentUser?.admin_role) {
            case 'finance': currentUserLevel = 1; break;
            case 'hr': currentUserLevel = 2; break;
            case 'media': currentUserLevel = 3; break;
            case 'general': default: currentUserLevel = 4; break;
        }

        return currentUserLevel !== requiredLevel;
    };

    return {
        loading, setLoading,
        formData, setFormData,
        searchJobNumber, setSearchJobNumber,
        suggestions, setSuggestions,
        showSuggestions, setShowSuggestions,
        searchExpanded, setSearchExpanded,
        selectedEmployee, setSelectedEmployee,
        financialData, setFinancialData,
        adminData, setAdminData,
        yearlyData, setYearlyData,
        activeFiveYearLeave, setActiveFiveYearLeave,
        showFiveYearLeaveModal, setShowFiveYearLeaveModal,
        showFiveYearLeaveHistoryModal, setShowFiveYearLeaveHistoryModal,
        newFiveYearLeave, setNewFiveYearLeave,
        selectedAdminYear, setSelectedAdminYear,
        adminRecords, setAdminRecords,
        fieldPermissions, fetchFieldPermissions,
        financialFields, 
        
        loadEmployeeData, handleSearch, handleUpdateEmployee, handleSaveEmployee, handleDeleteEmployee,
        handleCreateFiveYearLeave, handleNewFiveYearLeaveChange, handleFiveYearLeaveChange,
        fetchAdminRecords, handleSaveRecord, handleDeleteRecord, handleFinancialChange, isFieldReadOnly
    };
};
