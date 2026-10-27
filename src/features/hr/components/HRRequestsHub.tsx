import { useState, useEffect, useCallback } from 'react';
import {
    Inbox,
    FileText,
    Calendar,
    Layers,
    CheckCircle2,
    RefreshCw,
    Building,
    Scissors,
    ArrowRight
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../../context/ThemeContext';
import { cn } from '../../../lib/utils';
import { toast } from 'react-hot-toast';

// Existing leave components
import type { LeaveRecord } from '../../../components/admin/AdminLeaveRequests';
import { ApprovedRequestsCard } from '../../../components/admin/ApprovedRequestsCard';
import { CanceledRequestsCard } from '../../../components/admin/CanceledRequestsCard';
import { AdminLeaveArchive } from '../../../components/admin/AdminLeaveArchive';
import { LeavePrintTemplate } from '../../../components/admin/LeavePrintTemplate';
import { generateLeavePDF } from '../../../utils/pdfGenerator';

// New HR Hub Components
import { ServiceContinuityProcessModal, type ContinuityRequestItem } from './ServiceContinuityProcessModal';
import { IssuedContinuityCard } from './IssuedContinuityCard';
import { AdministrativeRequestsCard } from './AdministrativeRequestsCard';

interface HRRequestsHubProps {
    highlightRequestId?: string | null;
}

type RequestCategory = 'all' | 'leaves' | 'continuity' | 'administrative';

export const HRRequestsHub = ({ highlightRequestId }: HRRequestsHubProps) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    // ── Active Category Tab ──────────────────────────────────────────────────
    const [activeCategory, setActiveCategory] = useState<RequestCategory>('all');

    // ── Leave Requests State ─────────────────────────────────────────────────
    const [isLoadingLeaves, setIsLoadingLeaves] = useState(true);
    const [approvedRecords, setApprovedRecords] = useState<LeaveRecord[]>([]);
    const [cutApprovalRecords, setCutApprovalRecords] = useState<LeaveRecord[]>([]);
    const [canceledRecords, setCanceledRecords] = useState<LeaveRecord[]>([]);
    const [expandedLeaveSection, setExpandedLeaveSection] = useState<'approved' | 'canceled' | 'archive' | null>(null);

    // ── Continuity Requests State ────────────────────────────────────────────
    const [isLoadingContinuity, setIsLoadingContinuity] = useState(true);
    const [pendingContinuity, setPendingContinuity] = useState<ContinuityRequestItem[]>([]);
    const [issuedContinuity, setIssuedContinuity] = useState<ContinuityRequestItem[]>([]);
    const [isIssuedContinuityExpanded, setIsIssuedContinuityExpanded] = useState(false);
    const [selectedContinuityReq, setSelectedContinuityReq] = useState<ContinuityRequestItem | null>(null);

    // ── Administrative Requests State ────────────────────────────────────────
    const [isAdminExpanded, setIsAdminExpanded] = useState(false);

    // ── Leave Cut Modal State ────────────────────────────────────────────────
    const [selectedCutRequest, setSelectedCutRequest] = useState<LeaveRecord | null>(null);
    const [actualCutDays, setActualCutDays] = useState<number>(0);
    const [isProcessingCut, setIsProcessingCut] = useState(false);

    // ── Print & PDF State ────────────────────────────────────────────────────
    const [printingRecord, setPrintingRecord] = useState<LeaveRecord | null>(null);
    const [directorateManager, setDirectorateManager] = useState<{ full_name: string; job_title: string } | null>(null);
    const [isPrintingPdf, setIsPrintingPdf] = useState(false);

    // ── Fetch Directorate Manager for Leave Prints ───────────────────────────
    useEffect(() => {
        const fetchManager = async () => {
            try {
                const { data } = await supabase
                    .from('profiles')
                    .select('full_name, job_title')
                    .eq('admin_role', 'general')
                    .limit(1)
                    .single();
                if (data) {
                    setDirectorateManager(data);
                } else {
                    setDirectorateManager({
                        full_name: 'د. علي عباس جاسم الصباغ',
                        job_title: 'مدير المديرية'
                    });
                }
            } catch {
                setDirectorateManager({
                    full_name: 'د. علي عباس جاسم الصباغ',
                    job_title: 'مدير المديرية'
                });
            }
        };
        fetchManager();
    }, []);

    // ── 1. Fetch Continuity Requests ────────────────────────────────────────
    const fetchContinuityRequests = useCallback(async () => {
        setIsLoadingContinuity(true);
        try {
            const { data, error } = await supabase
                .from('service_continuity_requests')
                .select(`
                    *,
                    employee:profiles!service_continuity_requests_user_id_fkey(
                        full_name,
                        job_number,
                        job_title,
                        department
                    ),
                    supervisor:profiles!service_continuity_requests_supervisor_id_fkey(
                        full_name
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Continuity join error, trying fallback:', error);
                // Fallback query if joins have issues
                const { data: rawData } = await supabase
                    .from('service_continuity_requests')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (rawData) {
                    const uids = [...new Set(rawData.map((r: any) => r.user_id).filter(Boolean))];
                    const { data: profs } = await supabase
                        .from('profiles')
                        .select('id, full_name, job_number, job_title, department')
                        .in('id', uids);

                    const pMap: Record<string, any> = {};
                    if (profs) profs.forEach((p: any) => { pMap[p.id] = p; });

                    const mapped = rawData.map((r: any) => ({
                        ...r,
                        employee: pMap[r.user_id] || null
                    }));

                    setPendingContinuity(mapped.filter((r: any) => r.status === 'pending_hr'));
                    setIssuedContinuity(mapped.filter((r: any) => r.status === 'issued_and_dispatched'));
                }
            } else if (data) {
                setPendingContinuity(data.filter((r: any) => r.status === 'pending_hr') as any);
                setIssuedContinuity(data.filter((r: any) => r.status === 'issued_and_dispatched') as any);
            }
        } catch (err) {
            console.error('Error fetching continuity:', err);
        } finally {
            setIsLoadingContinuity(false);
        }
    }, []);

    // ── 2. Fetch Leave Cut Approvals ─────────────────────────────────────────
    const fetchPendingCutApprovals = useCallback(async () => {
        try {
            const { data } = await supabase
                .from('leave_requests')
                .select('id, user_id, start_date, end_date, status, days_count, reason, supervisor_id, created_at, cut_status, hr_cut_status, cut_date, leave_type, destination, time_duration_minutes, unpaid_days, time_off_subtype, is_mandatory')
                .eq('cut_status', 'approved')
                .eq('hr_cut_status', 'pending')
                .order('created_at', { ascending: false });

            if (data && data.length > 0) {
                const userIds = [...new Set(data.map(r => r.user_id).filter(Boolean))];
                const allIds = [...new Set([...userIds])];

                const profileMap: Record<string, any> = {};
                if (allIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('available_profiles')
                        .select('id, full_name, job_number')
                        .in('id', allIds);
                    if (profiles) profiles.forEach(p => { profileMap[p.id] = p; });
                }

                const formatted = data.map(item => ({
                    ...item,
                    employee_name: profileMap[item.user_id]?.full_name || 'غير معروف',
                    employee_job_number: profileMap[item.user_id]?.job_number || '',
                    supervisor: null
                })) as LeaveRecord[];

                setCutApprovalRecords(formatted);
            } else {
                setCutApprovalRecords([]);
            }
        } catch (e) {
            console.error('Error fetching cut approvals:', e);
        }
    }, []);

    // ── 3. Fetch Approved Leaves ─────────────────────────────────────────────
    const fetchAllApprovedRequests = useCallback(async () => {
        setIsLoadingLeaves(true);
        try {
            const { data } = await supabase
                .from('leave_requests')
                .select('id, user_id, start_date, end_date, status, days_count, reason, supervisor_id, created_at, is_archived, unpaid_days, cancellation_status, leave_type, destination, time_duration_minutes, time_off_subtype, is_mandatory')
                .eq('status', 'approved')
                .eq('is_archived', false)
                .order('created_at', { ascending: false });

            if (data && data.length > 0) {
                const userIds = [...new Set(data.map(r => r.user_id).filter(Boolean))];
                const supervisorIds = [...new Set(data.map(r => r.supervisor_id).filter(Boolean))];
                const allIds = [...new Set([...userIds, ...supervisorIds])];

                const profileMap: Record<string, any> = {};
                const deptMap: Record<string, string> = {};
                const engMap: Record<string, number> = {};

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
                        finData.forEach(f => { engMap[f.user_id] = f.engineering_allowance || 0; });
                    }

                    if (profiles) {
                        profiles.forEach(p => { profileMap[p.id] = p; });
                        const deptIds = [...new Set(profiles.map(p => p.department_id).filter(Boolean))];
                        if (deptIds.length > 0) {
                            const { data: depts } = await supabase.rpc('get_departments_bypass_rls').select('id, name').in('id', deptIds);
                            if (depts) (depts as any[]).forEach((d: any) => { deptMap[d.id] = d.name; });
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
            console.error('Error fetching approved requests:', err);
        } finally {
            setIsLoadingLeaves(false);
        }
    }, []);

    // ── 4. Fetch Canceled Leaves ─────────────────────────────────────────────
    const fetchCanceledRequests = useCallback(async () => {
        try {
            const { data } = await supabase
                .from('leave_requests')
                .select('id, user_id, start_date, end_date, status, days_count, reason, supervisor_id, created_at, is_archived, unpaid_days, cancellation_status, leave_type, destination, time_duration_minutes, time_off_subtype, is_mandatory')
                .eq('cancellation_status', 'approved')
                .eq('is_archived', false)
                .order('created_at', { ascending: false });

            if (data && data.length > 0) {
                const userIds = [...new Set(data.map(r => r.user_id).filter(Boolean))];
                const allIds = [...new Set([...userIds])];

                const profileMap: Record<string, any> = {};
                if (allIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, full_name, job_number')
                        .in('id', allIds);
                    if (profiles) profiles.forEach(p => { profileMap[p.id] = p; });
                }

                const formatted = data.map(item => ({
                    ...item,
                    employee_name: profileMap[item.user_id]?.full_name || 'غير معروف',
                    employee_job_number: profileMap[item.user_id]?.job_number || '',
                    supervisor: null
                })) as LeaveRecord[];

                setCanceledRecords(formatted);
            } else {
                setCanceledRecords([]);
            }
        } catch (e) {
            console.error('Error fetching canceled requests:', e);
        }
    }, []);

    // ── Master Refresh ───────────────────────────────────────────────────────
    const refreshAll = useCallback(() => {
        fetchAllApprovedRequests();
        fetchPendingCutApprovals();
        fetchCanceledRequests();
        fetchContinuityRequests();
    }, [fetchAllApprovedRequests, fetchPendingCutApprovals, fetchCanceledRequests, fetchContinuityRequests]);

    useEffect(() => {
        refreshAll();
    }, [refreshAll]);

    // Handle Cut Confirmation Modal
    const handleOpenCutModal = (record: LeaveRecord) => {
        let suggested = 0;
        if (record.cut_date && record.start_date) {
            const start = new Date(record.start_date);
            const cut = new Date(record.cut_date);
            suggested = Math.ceil((cut.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            if (suggested < 0) suggested = 0;
            if (suggested > record.days_count) suggested = record.days_count;
        }
        setActualCutDays(suggested);
        setSelectedCutRequest(record);
    };

    const handleConfirmCut = async () => {
        if (!selectedCutRequest) return;
        if (isNaN(actualCutDays) || actualCutDays < 0 || actualCutDays > selectedCutRequest.days_count) {
            toast.error('يرجى إدخال عدد أيام صحيح (أقل من أو يساوي الإجازة الأصلية).');
            return;
        }

        try {
            setIsProcessingCut(true);
            const { error } = await supabase.rpc('process_leave_cut_hr', {
                p_request_id: selectedCutRequest.id,
                p_actual_days: actualCutDays
            });

            if (error) throw error;
            toast.success('تم اعتماد قطع الإجازة وتحديث رصيد الموظف بنجاح');
            setSelectedCutRequest(null);
            fetchPendingCutApprovals();
            fetchAllApprovedRequests();
        } catch (err: any) {
            console.error('Error confirming cut:', err);
            toast.error(err?.message || 'فشل اعتماد قطع الإجازة');
        } finally {
            setIsProcessingCut(false);
        }
    };

    // Handle Leave Print Flow
    const handlePrintLeave = async (record: LeaveRecord) => {
        setPrintingRecord(record);
        try {
            setIsPrintingPdf(true);
            const formData = {
                employee_name: record.employee_name || '',
                employee_job_number: record.employee_job_number || '',
                employee_job_title: record.employee_job_title || '',
                employee_department: record.employee_department || '',
                leave_type: record.leave_type || 'regular',
                start_date: record.start_date,
                end_date: record.end_date,
                days_count: record.days_count,
                reason: record.reason || '',
                cut_date: record.cut_date,
                cut_days: record.cut_status === 'approved' ? record.days_count : undefined,
                destination: record.destination || '',
                time_duration_minutes: record.time_duration_minutes,
                time_off_subtype: record.time_off_subtype,
                is_mandatory: record.is_mandatory,
                supervisor_name: record.supervisor?.full_name || ''
            };

            const url = await generateLeavePDF({
                ...formData,
                unpaid_days: record.unpaid_days || 0,
                is_canceled: record.cancellation_status === 'approved',
                cancellation_date: record.cancellation_status === 'approved' ? new Date().toLocaleDateString('en-GB') : undefined
            } as any);

            window.open(url, '_blank');
            setIsPrintingPdf(false);
        } catch (error) {
            console.error('Error in print flow:', error);
            setIsPrintingPdf(false);
            toast.error('حدث خطأ أثناء تحضير ملف الإجازة.');
        }
    };

    // Calculate pending totals for badges
    const totalPendingLeaves = cutApprovalRecords.length;
    const totalPendingContinuity = pendingContinuity.length;
    const totalPending = totalPendingLeaves + totalPendingContinuity;

    return (
        <div className="space-y-5 animate-in fade-in duration-300">
            {/* Hidden Leave Print Template */}
            <LeavePrintTemplate printingRecord={printingRecord as any} directorateManager={directorateManager} />

            {/* Top Toolbar / Category Filter Pills */}
            <div className={cn(
                "p-3 rounded-2xl border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-sm",
                isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200"
            )}>
                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveCategory('all')}
                        className={cn(
                            "px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all",
                            activeCategory === 'all'
                                ? "bg-rose-600 text-white shadow-md shadow-rose-600/20"
                                : isDark ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        )}
                    >
                        <Inbox className="w-3.5 h-3.5" />
                        <span>كافة المعاملات والطلبات</span>
                        {totalPending > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/20 text-white font-bold">
                                {totalPending}
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveCategory('leaves')}
                        className={cn(
                            "px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all",
                            activeCategory === 'leaves'
                                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                                : isDark ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        )}
                    >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>الإجازات والانقطاعات</span>
                        {totalPendingLeaves > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-500 text-white font-bold">
                                {totalPendingLeaves}
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveCategory('continuity')}
                        className={cn(
                            "px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all",
                            activeCategory === 'continuity'
                                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                                : isDark ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        )}
                    >
                        <FileText className="w-3.5 h-3.5" />
                        <span>تأييدات الاستمرارية والوثائق</span>
                        {totalPendingContinuity > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-blue-500 text-white font-bold animate-pulse">
                                {totalPendingContinuity}
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveCategory('administrative')}
                        className={cn(
                            "px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all",
                            activeCategory === 'administrative'
                                ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                                : isDark ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        )}
                    >
                        <Layers className="w-3.5 h-3.5" />
                        <span>الخدمات والطلبات الإدارية</span>
                    </button>
                </div>

                {/* Refresh button */}
                <button
                    type="button"
                    onClick={refreshAll}
                    title="تحديث البيانات لحظياً"
                    className={cn(
                        "p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all self-end sm:self-auto",
                        isDark ? "border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300" : "border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700"
                    )}
                >
                    <RefreshCw className={cn("w-3.5 h-3.5 text-rose-500", (isLoadingLeaves || isLoadingContinuity) && "animate-spin")} />
                    <span className="text-[11px] hidden sm:inline">تحديث</span>
                </button>
            </div>

            {/* ── 1. The Action-Required Triage Section (الوعاء الساخن الفوري) ──── */}
            {totalPending > 0 ? (
                <div className={cn(
                    "p-4 rounded-2xl border-2 border-amber-500/40 shadow-lg space-y-3",
                    isDark ? "bg-amber-500/5 shadow-amber-500/5" : "bg-amber-50/70 border-amber-300"
                )}>
                    <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-amber-500 animate-ping" />
                            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                                <span>الطلبات بانتظار إجراء واعتماد الموارد البشرية (يحتاج تدخلاً)</span>
                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white font-mono shadow-sm">
                                    {totalPending} معاملة معلقة
                                </span>
                            </h3>
                        </div>
                        <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline">
                            موافق عليها من المسؤول المباشر وبانتظار قرار الشعبة
                        </span>
                    </div>

                    <div className="space-y-2.5">
                        {/* Pending Continuity Requests */}
                        {(activeCategory === 'all' || activeCategory === 'continuity') && pendingContinuity.map(req => (
                            <div
                                key={req.id}
                                className={cn(
                                    "p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all",
                                    isDark ? "bg-slate-900 border-slate-700 hover:border-blue-500/50" : "bg-white border-slate-200 hover:border-blue-400 shadow-sm"
                                )}
                            >
                                <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                            تأييد استمرارية بالخدمة
                                        </span>
                                        <span className="font-bold text-xs text-foreground">
                                            {req.employee?.full_name || 'موظف'}
                                        </span>
                                        <span className="text-[11px] text-muted-foreground font-mono">
                                            رقم: {req.employee?.job_number || '—'}
                                        </span>
                                        <span className="text-[11px] text-muted-foreground">
                                            ({req.employee?.department || 'المديرية'})
                                        </span>
                                    </div>
                                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                                        <span className="flex items-center gap-1 text-foreground/80">
                                            <Building className="w-3.5 h-3.5 text-emerald-500" />
                                            معنون إلى: <b className="text-foreground">{req.destination_entity}</b>
                                        </span>
                                        <span className="text-muted-foreground/40">•</span>
                                        <span className="text-[11px]">
                                            تاريخ الطلب: <b className="font-mono">{new Date(req.created_at).toLocaleDateString('ar-IQ')}</b>
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedContinuityReq(req)}
                                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all active:scale-95"
                                    >
                                        <FileText className="w-3.5 h-3.5" />
                                        <span>معالجة وإصدار الكتاب الرسمي</span>
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Pending Leave Cut Requests */}
                        {(activeCategory === 'all' || activeCategory === 'leaves') && cutApprovalRecords.map(record => (
                            <div
                                key={record.id}
                                className={cn(
                                    "p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all",
                                    isDark ? "bg-slate-900 border-slate-700 hover:border-amber-500/50" : "bg-white border-slate-200 hover:border-amber-400 shadow-sm"
                                )}
                            >
                                <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                            طلب قطع إجازة
                                        </span>
                                        <span className="font-bold text-xs text-foreground">
                                            {record.employee_name}
                                        </span>
                                        <span className="text-[11px] text-muted-foreground font-mono">
                                            رقم: {record.employee_job_number}
                                        </span>
                                    </div>
                                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                                        <span>
                                            مدة الإجازة الأصلية: <b className="text-foreground">{record.days_count} يوم</b>
                                        </span>
                                        <span className="text-muted-foreground/40">•</span>
                                        <span>
                                            تاريخ القطع المطلوب: <b className="text-foreground font-mono">{record.cut_date}</b>
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => handleOpenCutModal(record)}
                                        className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-600/20 transition-all active:scale-95"
                                    >
                                        <Scissors className="w-3.5 h-3.5" />
                                        <span>تدقيق واعتماد قطع الإجازة</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className={cn(
                    "p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs",
                    isDark ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" : "bg-emerald-50/80 border-emerald-200 text-emerald-800"
                )}>
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <span className="font-bold">
                            لا توجد طلبات معلقة بانتظار اعتماد الموارد البشرية حالياً — كافة الإجراءات المحالة منجزة بالكامل.
                        </span>
                    </div>
                    <span className="text-[11px] font-mono opacity-80 hidden sm:inline">
                        تمت المزامنة أصولياً
                    </span>
                </div>
            )}

            {/* ── 2. Category Sections ────────────────────────────────────────── */}

            {/* Section A: Leaves and Time-Off Requests */}
            {(activeCategory === 'all' || activeCategory === 'leaves') && (
                <div className="space-y-3">
                    {/* Approved Requests Card */}
                    <ApprovedRequestsCard
                        records={approvedRecords}
                        isLoading={isLoadingLeaves}
                        onRefresh={fetchAllApprovedRequests}
                        activeHighlightId={highlightRequestId || null}
                        onPrint={handlePrintLeave}
                        isExpanded={expandedLeaveSection === 'approved'}
                        onToggle={() => setExpandedLeaveSection(prev => prev === 'approved' ? null : 'approved')}
                    />

                    {/* Canceled Requests Card */}
                    <CanceledRequestsCard
                        records={canceledRecords}
                        isLoading={isLoadingLeaves}
                        onRefresh={fetchCanceledRequests}
                        activeHighlightId={highlightRequestId || null}
                        onPrint={handlePrintLeave}
                        isExpanded={expandedLeaveSection === 'canceled'}
                        onToggle={() => setExpandedLeaveSection(prev => prev === 'canceled' ? null : 'canceled')}
                    />

                    {/* Admin Leave Archive Card */}
                    <AdminLeaveArchive
                        onPrint={handlePrintLeave}
                        isExpanded={expandedLeaveSection === 'archive'}
                        onToggle={() => setExpandedLeaveSection(prev => prev === 'archive' ? null : 'archive')}
                    />
                </div>
            )}

            {/* Section B: Service Continuity Letters */}
            {(activeCategory === 'all' || activeCategory === 'continuity') && (
                <div className="space-y-3">
                    <IssuedContinuityCard
                        records={issuedContinuity}
                        isLoading={isLoadingContinuity}
                        onRefresh={fetchContinuityRequests}
                        onSelect={(req) => setSelectedContinuityReq(req)}
                        isExpanded={isIssuedContinuityExpanded}
                        onToggle={() => setIsIssuedContinuityExpanded(prev => !prev)}
                    />
                </div>
            )}

            {/* Section C: Administrative Requests (Fuel, ID, Transfer) */}
            {(activeCategory === 'all' || activeCategory === 'administrative') && (
                <div className="space-y-3">
                    <AdministrativeRequestsCard
                        isExpanded={isAdminExpanded}
                        onToggle={() => setIsAdminExpanded(prev => !prev)}
                    />
                </div>
            )}

            {/* ── 3. Modals ───────────────────────────────────────────────────── */}

            {/* Modal: Service Continuity Processing / Official Issue */}
            {selectedContinuityReq && (
                <ServiceContinuityProcessModal
                    request={selectedContinuityReq}
                    onClose={() => setSelectedContinuityReq(null)}
                    onSuccess={() => {
                        fetchContinuityRequests();
                    }}
                />
            )}

            {/* Modal: Confirm Leave Cut */}
            {selectedCutRequest && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pt-16 sm:pt-20 pb-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={cn(
                        "w-full max-w-md rounded-2xl border shadow-2xl p-5 relative max-h-[calc(100vh-5.5rem)] flex flex-col my-auto overflow-hidden",
                        isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
                    )}>
                        <div className="flex items-center justify-between pb-3 border-b border-border mb-3 shrink-0">
                            <h3 className="font-bold text-sm flex items-center gap-2">
                                <Scissors className="w-4 h-4 text-amber-500" />
                                <span>اعتماد قطع الإجازة واسترجاع الرصيد</span>
                            </h3>
                            <button
                                onClick={() => setSelectedCutRequest(null)}
                                className="p-1 rounded-lg hover:bg-secondary text-muted-foreground"
                            >
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs overflow-y-auto pr-1 flex-1">
                            <div className="p-3 rounded-xl bg-secondary/50 space-y-1">
                                <p>الموظف: <b>{selectedCutRequest.employee_name}</b></p>
                                <p>المدة الأصلية: <b>{selectedCutRequest.days_count} يوم</b></p>
                                <p>تاريخ القطع الفعلي: <b>{selectedCutRequest.cut_date}</b></p>
                            </div>

                            <div>
                                <label className="block font-bold mb-1">
                                    عدد أيام الإجازة الفعلية المستهلكة (التي تُخصم من الرصيد):
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    max={selectedCutRequest.days_count}
                                    value={actualCutDays}
                                    onChange={(e) => setActualCutDays(parseInt(e.target.value) || 0)}
                                    className={cn(
                                        "w-full p-2.5 rounded-xl border text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/30",
                                        isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-300 text-slate-900"
                                    )}
                                />
                                <span className="text-[11px] text-muted-foreground block mt-1">
                                    سيتم استرجاع <b>{selectedCutRequest.days_count - actualCutDays} يوم</b> لرصيد الموظف تلقائياً.
                                </span>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-border mt-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setSelectedCutRequest(null)}
                                className="px-3 py-1.5 rounded-xl border hover:bg-secondary text-xs font-bold"
                            >
                                إلغاء
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmCut}
                                disabled={isProcessingCut}
                                className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-600/20 disabled:opacity-50"
                            >
                                {isProcessingCut ? 'جاري الاعتماد...' : 'تأكيد واعتماد القطع'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Leave PDF Generation Overlay */}
            {isPrintingPdf && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
                    <div className={cn(
                        "p-6 rounded-2xl shadow-2xl border text-center flex flex-col items-center justify-center max-w-xs",
                        isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
                    )}>
                        <div className="w-10 h-10 border-4 border-slate-200 border-t-rose-600 rounded-full animate-spin mb-3" />
                        <h4 className="font-bold text-sm">جاري إنشاء استمارة الإجازة...</h4>
                        <p className="text-xs text-muted-foreground mt-1">يرجى الانتظار بينما نقوم بإنشاء ملف الـ PDF.</p>
                    </div>
                </div>
            )}
        </div>
    );
};
