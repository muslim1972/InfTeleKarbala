import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export const useDashboardData = (activeTab: string) => {
    const { user } = useAuth();
    
    // Data State
    const [financialData, setFinancialData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [showIban, setShowIban] = useState(false);
    const [departmentInfo, setDepartmentInfo] = useState({ name: 'غير محدد', managerName: 'غير محدد' });

    // UI State for Collapsible Sections
    const [openSection, setOpenSection] = useState<string | null>(null);

    // Admin State
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [adminData, setAdminData] = useState<any>(null);
    const [yearlyData, setYearlyData] = useState<any[]>([]);

    // Detailed View State
    const [expandedDetail, setExpandedDetail] = useState<'thanks' | 'committees' | 'penalties' | 'leaves' | null>(null);
    const [detailItems, setDetailItems] = useState<any[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);

    // Leaves Specific State
    const [leavesList, setLeavesList] = useState<any[]>([]);
    const [selectedLeave, setSelectedLeave] = useState<any>(null);

    const toggleSection = (section: string) => {
        setOpenSection(prev => {
            const newState = prev === section ? null : section;

            // Auto-scroll when opening
            if (newState) {
                setTimeout(() => {
                    const element = document.getElementById(`financial-group-${section}`);
                    if (element) {
                        const y = element.getBoundingClientRect().top + window.scrollY - 180; // Adjusted offset
                        window.scrollTo({ top: y, behavior: 'smooth' });
                    }
                }, 100);
            }
            return newState;
        });
    };

    // Fetch Leaves for selected year
    useEffect(() => {
        const fetchLeaves = async () => {
            if (!user?.id) return;
            const { data } = await supabase
                .from('leaves_details')
                .select('*')
                .eq('user_id', user.id)
                .eq('year', selectedYear)
                .order('start_date', { ascending: false });

            if (data) setLeavesList(data);
        };
        fetchLeaves();
        setSelectedLeave(null); // Reset selection on year change
    }, [selectedYear, user?.id]);

    const handleDetailClick = async (type: 'thanks' | 'committees' | 'penalties' | 'leaves') => {
        if (expandedDetail === type) {
            setExpandedDetail(null);
            return;
        }

        setExpandedDetail(type);
        setDetailLoading(true);
        setDetailItems([]);

        try {
            let tableName = '';
            switch (type) {
                case 'thanks': tableName = 'thanks_details'; break;
                case 'committees': tableName = 'committees_details'; break;
                case 'penalties': tableName = 'penalties_details'; break;
                case 'leaves': tableName = 'leaves_details'; break;
            }

            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .eq('user_id', user?.id)
                .eq('year', selectedYear);

            if (error) {
                console.error("Supabase Error:", error);
                throw error;
            }

            setDetailItems(data || []);
        } catch (err) {
            console.error("Error fetching details:", err);
        } finally {
            setDetailLoading(false);
        }
    };

    // Computed Yearly Data
    const currentYearRecord = yearlyData.find(r => r.year === selectedYear) || {};

    // Fetch All Data in Parallel (محسّن للأداء)
    useEffect(() => {
        if (user?.id && (activeTab === 'financial' || activeTab === 'administrative')) {
            const fetchData = async () => {
                setLoading(true);
                try {
                    // جلب كل البيانات بالتوازي (أسرع بكثير)
                    const [financialResult, adminResult, yearlyResult, deptsResult] = await Promise.all([
                        supabase
                            .from('financial_records')
                            .select('*')
                            .eq('user_id', user.id)
                            .order('updated_at', { ascending: false })
                            .limit(1)
                            .maybeSingle(),

                        supabase
                            .from('administrative_summary')
                            .select('*')
                            .eq('user_id', user.id)
                            .maybeSingle(),

                        supabase
                            .from('yearly_records')
                            .select('*')
                            .eq('user_id', user.id),

                        supabase
                            .from('departments')
                            .select('*')
                    ]);

                    // تعيين البيانات مع حساب الإجماليات للعرض
                    if (financialResult.data) {
                        const data = financialResult.data;

                        const parseMoney = (val: any) => {
                            if (typeof val === 'number') return val;
                            if (!val) return 0;
                            const clean = String(val).replace(/,/g, '').replace(/[^\d.]/g, '');
                            const num = parseFloat(clean);
                            return isNaN(num) ? 0 : num;
                        };

                        const certAllow = parseMoney(data.certificate_allowance);
                        const posAllow = parseMoney(data.position_allowance);
                        const engAllow = parseMoney(data.engineering_allowance);
                        const riskAllow = parseMoney(data.risk_allowance);
                        const legalAllow = parseMoney(data.legal_allowance);
                        const add50Allow = parseMoney(data.additional_50_percent_allowance);
                        const transAllow = parseMoney(data.transport_allowance);
                        const maritalAllow = parseMoney(data.marital_allowance);
                        const childAllow = parseMoney(data.children_allowance);

                        const totalAllowances = certAllow + posAllow + engAllow + riskAllow + legalAllow + add50Allow + transAllow + maritalAllow + childAllow;

                        const taxDeduct = parseMoney(data.tax_deduction_amount);
                        const loanDeduct = parseMoney(data.loan_deduction);
                        const execDeduct = parseMoney(data.execution_deduction);
                        const retireDeduct = parseMoney(data.retirement_deduction);
                        const schoolDeduct = parseMoney(data.school_stamp_deduction);
                        const socialDeduct = parseMoney(data.social_security_deduction);
                        const otherDeduct = parseMoney(data.other_deductions);

                        const totalDeductions = taxDeduct + loanDeduct + execDeduct + retireDeduct + schoolDeduct + socialDeduct + otherDeduct;

                        const nominalSalary = parseMoney(data.nominal_salary);
                        const grossSalary = nominalSalary + totalAllowances;
                        const netSalary = grossSalary - totalDeductions;

                        setFinancialData({
                            ...data,
                            total_allowances: totalAllowances,
                            gross_salary: grossSalary,
                            total_deductions: totalDeductions,
                            net_salary: netSalary
                        });
                    } else {
                        setFinancialData({
                            user_id: user.id,
                            nominal_salary: 0
                        } as any);
                    }

                    if (adminResult.data) setAdminData(adminResult.data);
                    if (yearlyResult.data) setYearlyData(yearlyResult.data);

                    // Compute Department & Manager Details
                    const deptData = deptsResult?.data || [];
                    if (user.department_id) {
                        let currentDept = deptData.find((d: any) => d.id === user.department_id);
                        const originDeptName = currentDept?.name || 'غير محدد';
                        let nearestManagerId = null;

                        while (currentDept) {
                            if (currentDept.manager_id) {
                                nearestManagerId = currentDept.manager_id;
                                break;
                            }
                            currentDept = deptData.find((d: any) => d.id === currentDept.parent_id);
                        }

                        let managerName = 'لا يوجد مسؤول مباشر';
                        if (nearestManagerId) {
                            if (nearestManagerId === user.id && currentDept?.parent_id) {
                                const parentNode = deptData.find((d: any) => d.id === currentDept.parent_id);
                                if (parentNode && parentNode.manager_id) {
                                    nearestManagerId = parentNode.manager_id;
                                }
                            }

                            if (nearestManagerId !== user.id) { 
                                const { data: mgrProfile } = await supabase.from('profiles').select('full_name').eq('id', nearestManagerId).single();
                                if (mgrProfile) managerName = mgrProfile.full_name;
                            } else {
                                managerName = 'الإدارة العليا';
                            }
                        }

                        setDepartmentInfo({ name: originDeptName, managerName });
                    }
                } catch (error) {
                    console.error("Error fetching data:", error);
                } finally {
                    setLoading(false);
                }
            };
            fetchData();
        }
    }, [user?.id, activeTab]);

    // Reset details when year changes
    useEffect(() => {
        setExpandedDetail(null);
        setDetailItems([]);
    }, [selectedYear]);

    return {
        financialData, loading, showIban, setShowIban, departmentInfo,
        openSection, toggleSection,
        selectedYear, setSelectedYear, adminData, yearlyData, currentYearRecord,
        expandedDetail, setExpandedDetail, detailItems, detailLoading, handleDetailClick,
        leavesList, selectedLeave, setSelectedLeave
    };
};
