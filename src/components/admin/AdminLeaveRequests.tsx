import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { generateLeavePDF } from '../../utils/pdfGenerator';
import { LeavePrintTemplate } from './LeavePrintTemplate';
import { PendingCutApprovalsCard } from './PendingCutApprovalsCard';
import { ApprovedRequestsCard } from './ApprovedRequestsCard';
import { AdminLeaveArchive } from './AdminLeaveArchive';

interface AdminLeaveRequestsProps {
    employeeId?: string;
    employeeName?: string;
    highlightRequestId?: string | null;
}

export interface LeaveRecord {
    id: string;
    user_id: string;
    start_date: string;
    end_date: string;
    status: string;
    days_count: number;
    reason: string;
    supervisor_id: string;
    created_at: string;
    employee_name?: string;
    employee_job_number?: string;
    employee_job_title?: string;
    employee_department?: string;
    employee_balance?: number;
    cut_status?: string;
    hr_cut_status?: string;
    is_archived?: boolean;
    cut_date?: string;
    supervisor: {
        full_name: string;
        job_title?: string;
        engineering_allowance?: number;
    } | null;
    unpaid_days?: number;
    cancellation_status?: string;
}

export const AdminLeaveRequests = ({ employeeId, employeeName, highlightRequestId }: AdminLeaveRequestsProps) => {


    // Internal employee search state (mirrors top search bar)
    const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);

    // Approved requests state (all employees)
    const [isLoadingApproved, setIsLoadingApproved] = useState(true);
    const [approvedRecords, setApprovedRecords] = useState<LeaveRecord[]>([]);

    // HR Cut requests state
    const [isLoadingCutApprovals, setIsLoadingCutApprovals] = useState(true);
    const [cutApprovalRecords, setCutApprovalRecords] = useState<LeaveRecord[]>([]);

    // Print state
    // @ts-ignore
    const [printingRecord, setPrintingRecord] = useState<LeaveRecord | null>(null);
    const [directorateManager, setDirectorateManager] = useState<{ full_name: string, job_title: string } | null>(null);
    const [isPrintingPdf, setIsPrintingPdf] = useState(false);

    // Fetch all approved requests for all employees
    useEffect(() => {
        fetchAllApprovedRequests();
        fetchPendingCutApprovals();
    }, []);



    // Refresh data when a new highlight is requested
    useEffect(() => {
        if (highlightRequestId) {
            fetchAllApprovedRequests();
            fetchPendingCutApprovals();
        }
    }, [highlightRequestId]);

    // Highlight and Scroll effect logic - robust version
    useEffect(() => {
        let timeoutId: any;
        let clearId: any;

        if (highlightRequestId && !isLoadingApproved && !isLoadingCutApprovals) {
            setActiveHighlightId(highlightRequestId);
            
            // Give the DOM a moment to render the new records
            timeoutId = setTimeout(() => {
                const element = document.getElementById(`request-${highlightRequestId}`);
                if (element) {
                    console.log("🎯 AdminLeaveRequests: Scrolling to element", highlightRequestId);
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // Clear the highlight after 5 seconds of visibility
                    clearId = setTimeout(() => {
                        setActiveHighlightId(null);
                    }, 5000);
                } else {
                    console.error("❌ AdminLeaveRequests: Element not found for ID:", highlightRequestId);
                }
            }, 50); // Reduced for instant feel
        }

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            if (clearId) clearTimeout(clearId);
        };
    }, [highlightRequestId, isLoadingApproved, isLoadingCutApprovals, approvedRecords, cutApprovalRecords]);




    const fetchAllApprovedRequests = async () => {
        setIsLoadingApproved(true);
        try {
            const { data } = await supabase
                .from('leave_requests')
                .select('id, user_id, start_date, end_date, status, days_count, reason, supervisor_id, created_at, is_archived, unpaid_days, cancellation_status')
                .eq('status', 'approved')
                .eq('is_archived', false) // Only fetch unarchived for the pending queue
                .order('created_at', { ascending: false });

            if (data && data.length > 0) {
                const userIds = [...new Set(data.map(r => r.user_id).filter(Boolean))];
                const supervisorIds = [...new Set(data.map(r => r.supervisor_id).filter(Boolean))];
                const allIds = [...new Set([...userIds, ...supervisorIds])];

                let profileMap: Record<string, { full_name: string; job_title?: string; job_number?: string; department_id?: string; engineering_allowance?: number }> = {};
                let deptMap: Record<string, string> = {};
                let engMap: Record<string, number> = {};

                if (allIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, full_name, job_number, department_id')
                        .in('id', allIds);

                    const { data: finData } = await supabase
                        .from('financial_records')
                        .select('user_id, engineering_allowance')
                        .in('user_id', allIds);
                    if (finData) {
                        finData.forEach(f => {
                            engMap[f.user_id] = f.engineering_allowance || 0;
                        });
                    }
                    if (profiles) {
                        profiles.forEach(p => { profileMap[p.id] = p; });
                        const deptIds = [...new Set(profiles.map(p => p.department_id).filter(Boolean))];
                        if (deptIds.length > 0) {
                            const { data: depts } = await supabase.from('departments').select('id, name').in('id', deptIds);
                            if (depts) depts.forEach(d => { deptMap[d.id] = d.name; });
                        }
                    }
                }

                const formatted = data.map(item => ({
                    ...item,
                    employee_name: profileMap[item.user_id]?.full_name || 'غير معروف',
                    employee_job_number: profileMap[item.user_id]?.job_number || '',
                    employee_job_title: profileMap[item.user_id]?.job_title || '',
                    employee_department: profileMap[item.user_id]?.department_id
                        ? deptMap[profileMap[item.user_id].department_id!] || ''
                        : '',
                    supervisor: item.supervisor_id && profileMap[item.supervisor_id]
                        ? {
                            full_name: profileMap[item.supervisor_id].full_name,
                            job_title: '',
                            engineering_allowance: engMap[item.supervisor_id] || 0
                        }
                        : null
                })) as LeaveRecord[];

                setApprovedRecords(formatted);
            } else {
                setApprovedRecords([]);
            }
        } catch (err) {
            console.error("Error fetching approved requests", err);
        } finally {
            setIsLoadingApproved(false);
        }
    };

    const fetchPendingCutApprovals = async () => {
        setIsLoadingCutApprovals(true);
        try {
            const { data } = await supabase
                .from('leave_requests')
                .select('id, user_id, start_date, end_date, status, days_count, reason, supervisor_id, created_at, cut_status, hr_cut_status, cut_date')
                .eq('cut_status', 'approved')
                .eq('hr_cut_status', 'pending')
                .order('created_at', { ascending: false });

            if (data && data.length > 0) {
                const userIds = [...new Set(data.map(r => r.user_id).filter(Boolean))];
                const supervisorIds = [...new Set(data.map(r => r.supervisor_id).filter(Boolean))];
                const allIds = [...new Set([...userIds, ...supervisorIds])];

                let profileMap: Record<string, any> = {};
                let engMap: Record<string, number> = {};

                if (allIds.length > 0) {
                    const { data: profiles } = await supabase.from('profiles').select('id, full_name, job_number').in('id', allIds);
                    const { data: finData } = await supabase.from('financial_records').select('user_id, engineering_allowance').in('user_id', allIds);
                    if (finData) finData.forEach(f => { engMap[f.user_id] = f.engineering_allowance || 0; });
                    if (profiles) profiles.forEach(p => { profileMap[p.id] = p; });
                }

                const formatted = data.map(item => ({
                    ...item,
                    employee_name: profileMap[item.user_id]?.full_name || 'غير معروف',
                    employee_job_number: profileMap[item.user_id]?.job_number || '',
                    supervisor: item.supervisor_id && profileMap[item.supervisor_id]
                        ? {
                            full_name: profileMap[item.supervisor_id].full_name,
                            job_title: '',
                            engineering_allowance: engMap[item.supervisor_id] || 0
                        }
                        : null
                })) as LeaveRecord[];

                setCutApprovalRecords(formatted);
            } else {
                setCutApprovalRecords([]);
            }
        } catch (err) {
            console.error("Error fetching HR cut approvals", err);
        } finally {
            setIsLoadingCutApprovals(false);
        }
    };

    // Resolve directorate manager for print
    const resolveDirectorateManager = async (userId: string) => {
        try {
            const { data: profile } = await supabase.from('profiles').select('department_id').eq('id', userId).single();
            if (!profile?.department_id) return 'علي عباس جاسم الصباغ';

            let currentDeptId = profile.department_id;
            let lastManagerId: string | null = null;

            while (currentDeptId) {
                const { data: dept } = await supabase.from('departments').select('*').eq('id', currentDeptId).single();
                if (!dept) break;
                if (dept.manager_id) lastManagerId = dept.manager_id;
                if (!dept.parent_id) break;
                currentDeptId = dept.parent_id;
            }

            if (lastManagerId) {
                const { data: mgrProfile } = await supabase.from('profiles').select('full_name').eq('id', lastManagerId).single();
                if (mgrProfile) {
                    setDirectorateManager({
                        full_name: mgrProfile.full_name,
                        job_title: 'مدير المديرية'
                    });
                    return mgrProfile.full_name;
                }
            }
        } catch (err) {
            console.error("Error resolving directorate manager", err);
        }
        return 'علي عباس جاسم الصباغ';
    };



    const handlePrint = async (record: LeaveRecord) => {
        setIsPrintingPdf(true);

        try {
            // Real-time guard: Check if the leave was cancelled by the employee right before printing
            const { data: latestRecord, error: checkError } = await supabase
                .from('leave_requests')
                .select('cancellation_status')
                .eq('id', record.id)
                .single();

            if (checkError) {
                console.error("Error checking latest status:", checkError);
                throw new Error("فشل في التحقق من حالة الإجازة");
            }

            if (latestRecord && latestRecord.cancellation_status === 'approved') {
                alert('لقد تم الغاء الاجازة من قبل الموظف واعتمدها المسؤول');
                setIsPrintingPdf(false);
                fetchAllApprovedRequests(); // Refresh the list
                return; // Stop printing
            }

            const defaultManagerName = await resolveDirectorateManager(record.user_id) || 'علي عباس جاسم الصباغ';

            let balance = 0;
            // 1. Try to fetch the balance exactly at the time the leave was approved
            const { data: historyData, error: historyError } = await supabase
                .from('leave_history')
                .select('new_balance')
                .eq('leave_request_id', record.id)
                .eq('action_type', 'leave_approved')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (!historyError && historyData && historyData.new_balance !== null) {
                balance = historyData.new_balance;
            } else {
                // 2. Fallback to current live balance for very old records
                const { data: finData } = await supabase
                    .from('financial_records')
                    .select('remaining_leaves_balance')
                    .eq('user_id', record.user_id)
                    .single();
                if (finData) balance = finData.remaining_leaves_balance || 0;
            }

            const formData = {
                full_name: record.employee_name || '',
                id: record.id,
                balance: balance,
                reason: record.reason || '-',
                start_date: record.start_date,
                days: record.days_count,
                approval_date: new Date(record.created_at).toLocaleDateString('en-GB'),
                manager_name: record.supervisor?.full_name || defaultManagerName,
                supervisor_name: record.supervisor?.full_name || ''
            };

            const url = await generateLeavePDF({
                ...formData,
                unpaid_days: record.unpaid_days || 0
            } as any);

            window.open(url, '_blank');
            setIsPrintingPdf(false);

        } catch (error) {
            console.error("Error in print flow:", error);
            setIsPrintingPdf(false);
            alert('حدث خطأ أثناء تحضير ملف الإجازة.');
        }
    };

    return (
        <div className="space-y-6">
            <LeavePrintTemplate printingRecord={printingRecord as any} directorateManager={directorateManager} />

            {/* 1. Pending HR Cut Approvals */}
            <PendingCutApprovalsCard
                records={cutApprovalRecords}
                isLoading={isLoadingCutApprovals}
                onRefresh={() => {
                    fetchPendingCutApprovals();
                    fetchAllApprovedRequests();
                }}
                activeHighlightId={activeHighlightId}
            />

            {/* 2. Approved Requests — All Employees */}
            <ApprovedRequestsCard
                records={approvedRecords}
                isLoading={isLoadingApproved}
                onRefresh={fetchAllApprovedRequests}
                activeHighlightId={activeHighlightId}
                onPrint={handlePrint}
            />

            {/* 3. Archive / Search Section (Collapsible) */}
            <AdminLeaveArchive
                employeeId={employeeId}
                employeeName={employeeName}
                onPrint={handlePrint}
            />

            {/* Modal for PDF Generation overlay */}
            {isPrintingPdf && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden text-center flex flex-col items-center justify-center p-8">
                        <div className="w-16 h-16 border-4 border-slate-200 border-t-brand-600 rounded-full animate-spin mb-6"></div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">جاري تحضير الاستمارة...</h3>
                        <p className="text-slate-500">يرجى الانتظار بينما نقوم بإنشاء ملف الـ PDF.</p>
                    </div>
                </div>
            )}
        </div >
    );
}
