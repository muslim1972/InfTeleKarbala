import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Loader2, ChevronDown, ChevronUp, Printer, CheckCircle, User, Archive } from 'lucide-react';
import { DateInput } from '../ui/DateInput';
import { generateLeavePDF } from '../../utils/pdfGenerator';

interface AdminLeaveRequestsProps {
    employeeId?: string;
    employeeName?: string;
}

interface LeaveRecord {
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
}

export const AdminLeaveRequests = ({ employeeId, employeeName }: AdminLeaveRequestsProps) => {
    const [isArchiveExpanded, setIsArchiveExpanded] = useState(false);

    // Approved requests state (all employees)
    const [isLoadingApproved, setIsLoadingApproved] = useState(true);
    const [approvedRecords, setApprovedRecords] = useState<LeaveRecord[]>([]);

    // HR Cut requests state
    const [isLoadingCutApprovals, setIsLoadingCutApprovals] = useState(true);
    const [cutApprovalRecords, setCutApprovalRecords] = useState<LeaveRecord[]>([]);

    // Archive search state
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isLoadingArchive, setIsLoadingArchive] = useState(false);
    const [archiveRecords, setArchiveRecords] = useState<LeaveRecord[]>([]);
    const [hasSearched, setHasSearched] = useState(false);

    // Internal employee search state (mirrors top search bar)
    const [archiveSearchQuery, setArchiveSearchQuery] = useState('');
    const [archiveSuggestions, setArchiveSuggestions] = useState<any[]>([]);
    const [showArchiveSuggestions, setShowArchiveSuggestions] = useState(false);
    const [isArchiveSearching, setIsArchiveSearching] = useState(false);
    const [localEmployeeId, setLocalEmployeeId] = useState<string | undefined>(employeeId);
    const [localEmployeeName, setLocalEmployeeName] = useState<string | undefined>(employeeName);
    const archiveSearchRef = useRef<HTMLDivElement>(null);

    // Print state
    // @ts-ignore
    const [printingRecord, setPrintingRecord] = useState<LeaveRecord | null>(null);
    const [directorateManager, setDirectorateManager] = useState<{ full_name: string, job_title: string } | null>(null);

    // Fetch all approved requests for all employees
    useEffect(() => {
        fetchAllApprovedRequests();
        fetchPendingCutApprovals();
    }, []);

    // Sync local employee with props
    useEffect(() => {
        setLocalEmployeeId(employeeId);
        setLocalEmployeeName(employeeName);
        setArchiveRecords([]);
        setHasSearched(false);
    }, [employeeId, employeeName]);

    // Debounced search for archive section
    useEffect(() => {
        const delaySearch = setTimeout(async () => {
            const query = archiveSearchQuery.trim();
            if (!query) {
                setArchiveSuggestions([]);
                setShowArchiveSuggestions(false);
                return;
            }
            setIsArchiveSearching(true);
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, full_name, job_number, role')
                    .or(`job_number.ilike.%${query}%,full_name.ilike.%${query}%`)
                    .limit(50);
                if (error) {
                    setArchiveSuggestions([]);
                    setShowArchiveSuggestions(false);
                } else {
                    setArchiveSuggestions(data || []);
                    setShowArchiveSuggestions((data || []).length > 0);
                }
            } catch {
                setArchiveSuggestions([]);
                setShowArchiveSuggestions(false);
            } finally {
                setIsArchiveSearching(false);
            }
        }, 300);
        return () => clearTimeout(delaySearch);
    }, [archiveSearchQuery]);

    // Close suggestions on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (archiveSearchRef.current && !archiveSearchRef.current.contains(e.target as Node)) {
                setShowArchiveSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectArchiveEmployee = (user: any) => {
        setLocalEmployeeId(user.id);
        setLocalEmployeeName(user.full_name);
        setArchiveSearchQuery('');
        setShowArchiveSuggestions(false);
        setArchiveSuggestions([]);
        setArchiveRecords([]);
        setHasSearched(false);
    };

    const fetchAllApprovedRequests = async () => {
        setIsLoadingApproved(true);
        try {
            const { data } = await supabase
                .from('leave_requests')
                .select('id, user_id, start_date, end_date, status, days_count, reason, supervisor_id, created_at, is_archived, unpaid_days')
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

    // Populate supervisor and employee info for records (used by Search Archive and others)
    const populateSupervisors = async (data: any[]) => {
        const userIds = [...new Set(data.map(r => r.user_id).filter(id => id && id.trim() !== ''))];
        const supIds = [...new Set(data.map(r => r.supervisor_id).filter(id => id && id.trim() !== ''))];
        const allIds = [...new Set([...userIds, ...supIds])];

        let profileMap: Record<string, any> = {};
        let engMap: Record<string, number> = {};
        let deptMap: Record<string, string> = {};

        if (allIds.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('id, full_name, job_number, department_id').in('id', allIds);
            const { data: finData } = await supabase.from('financial_records').select('user_id, engineering_allowance').in('user_id', allIds);

            if (finData) finData.forEach(f => { engMap[f.user_id] = f.engineering_allowance || 0; });

            if (profiles) {
                profiles.forEach(p => { profileMap[p.id] = p; });
                const deptIds = [...new Set(profiles.map(p => p.department_id).filter(Boolean))];
                if (deptIds.length > 0) {
                    const { data: depts } = await supabase.from('departments').select('id, name').in('id', deptIds);
                    if (depts) depts.forEach(d => { deptMap[d.id] = d.name; });
                }
            }
        }
        return data.map(item => ({
            ...item,
            employee_name: profileMap[item.user_id]?.full_name || localEmployeeName || 'غير معروف',
            employee_job_number: profileMap[item.user_id]?.job_number || '',
            employee_job_title: profileMap[item.user_id]?.job_title || '',
            employee_department: profileMap[item.user_id]?.department_id
                ? deptMap[profileMap[item.user_id].department_id] || ''
                : '',
            supervisor: item.supervisor_id && profileMap[item.supervisor_id]
                ? {
                    full_name: profileMap[item.supervisor_id].full_name,
                    job_title: profileMap[item.supervisor_id].job_title || '',
                    engineering_allowance: engMap[item.supervisor_id] || 0
                }
                : null
        })) as LeaveRecord[];
    };

    const handleArchiveSearch = async () => {
        if (!localEmployeeId) return;
        setIsLoadingArchive(true);
        setHasSearched(true);

        try {
            let query = supabase
                .from('leave_requests')
                .select('id, user_id, start_date, end_date, status, days_count, reason, supervisor_id, created_at, is_archived')
                .eq('user_id', localEmployeeId);

            if (startDate) query = query.gte('start_date', startDate);
            if (endDate) query = query.lte('end_date', endDate);
            query = query.order('start_date', { ascending: false });

            const { data, error } = await query;

            if (error) {
                console.error("Error fetching leaves:", error);
            } else if (data && data.length > 0) {
                const formatted = await populateSupervisors(data);
                setArchiveRecords(formatted);
            } else {
                setArchiveRecords([]);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoadingArchive(false);
        }
    };

    const handlePrint = async (record: LeaveRecord) => {
        // Pre-open window SYNCHRONOUSLY to bypass popup blocker
        const pdfWindow = window.open('about:blank', '_blank');
        // Show loading page while PDF is being generated
        if (pdfWindow) {
            pdfWindow.document.write(`
                <html dir="rtl"><head>
                    <title>جاري التحضير...</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:Arial,sans-serif;background:#f8fafc">
                    <div style="text-align:center">
                        <div style="width:40px;height:40px;border:4px solid #e2e8f0;border-top-color:#3b82f6;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px"></div>
                        <p style="color:#475569;font-size:16px;font-weight:bold">جاري تحضير استمارة الإجازة...</p>
                    </div>
                    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
                </body></html>
            `);
            pdfWindow.document.close();
        }
        const defaultManagerName = await resolveDirectorateManager(record.user_id) || 'علي عباس جاسم الصباغ';

        let balance = 0;
        try {
            const { data } = await supabase
                .from('financial_records')
                .select('remaining_leaves_balance')
                .eq('user_id', record.user_id)
                .single();
            if (data) balance = data.remaining_leaves_balance || 0;
        } catch (e) {
            console.error("Error fetching balance:", e);
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

        await generateLeavePDF({
            ...formData,
            unpaid_days: record.unpaid_days || 0
        } as any, pdfWindow);
    };

    return (
        <div className="space-y-6">
            <style>{`
                .print-only {
                    visibility: hidden;
                    position: absolute;
                    top: -9999px;
                    left: -9999px;
                    height: 0;
                    overflow: hidden;
                }
                @media print {
                    @page { size: A4 portrait; margin: 0; }
                    html, body {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        height: 100vh !important;
                        overflow: hidden !important;
                    }
                    body * { visibility: hidden !important; }
                    #print-section {
                        visibility: visible !important;
                        position: fixed !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 210mm !important;
                        height: auto !important;
                        background: white !important;
                        overflow: visible !important;
                        z-index: 9999 !important;
                    }
                    #print-section * { visibility: visible !important; }
                }
            `}</style>

            {/* Hidden Print Layout */}
            {printingRecord && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1, pointerEvents: 'none', background: 'white' }}>
                    <div id="print-section" className="print-only" dir="rtl" style={{
                        width: '210mm',
                        minHeight: '297mm', /* Standard A4 height */
                        padding: '24mm 16mm 10mm 16mm',
                        boxSizing: 'border-box',
                        display: 'flex',
                        flexDirection: 'column',
                        backgroundColor: 'white',
                        fontFamily: 'Arial, sans-serif',
                        color: '#000',
                    }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8mm' }}>
                            <div style={{ textAlign: 'center', lineHeight: '1.6' }}>
                                <p style={{ fontWeight: 'bold', fontSize: '11pt', margin: '0 0 2px 0' }}>مديرية اتصالات ومعلوماتية</p>
                                <p style={{ fontWeight: '900', fontSize: '14pt', margin: '0 0 2px 0' }}>كربلاء المقدسة</p>
                                <p style={{ fontWeight: 'bold', fontSize: '9pt', margin: '0 0 2px 0' }}>نظام الإدارة الموحد</p>
                                <p style={{ fontSize: '8pt', margin: '4px 0 0 0' }}>طبعت : {new Date().toLocaleDateString('en-GB')}</p>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ border: '2px solid #166534', borderRadius: '50px', padding: '4px 14px', display: 'inline-block' }}>
                                    <p style={{ color: '#166534', fontWeight: 'bold', fontSize: '10pt', margin: 0 }}>حاصل على موافقة المسؤول المباشر</p>
                                </div>
                                <p style={{ fontSize: '8pt', fontWeight: 'bold', margin: '4px 0 0 0' }}>{new Date(printingRecord.created_at).toLocaleDateString('en-GB')}</p>
                            </div>
                        </div>

                        {/* Title */}
                        <div style={{ textAlign: 'center', marginBottom: '7mm' }}>
                            <h1 style={{ fontSize: '15pt', fontWeight: '900', margin: 0, letterSpacing: '1px' }}>استمارة الاجازة الاعتيادية</h1>
                        </div>

                        {/* Body */}
                        <div style={{ fontSize: '15pt', fontWeight: 'bold', lineHeight: '2.5', paddingRight: '5mm', paddingLeft: '5mm' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span>تمت الموافقة الالكترونية من المسؤول المخول بمنح إجازة اعتيادية لمدة</span>
                                <span style={{ marginRight: '8px', marginLeft: '8px', textAlign: 'center' }}>
                                    ( {printingRecord.days_count} يوم )
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: '12px' }}>
                                <span style={{ marginLeft: '8px', width: '130px' }}>من تأريخ :</span>
                                <span style={{ marginRight: '8px', textAlign: 'center' }}>
                                    ( {printingRecord.start_date} )
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: '20px' }}>
                                <span style={{ marginLeft: '8px', width: '130px' }}>لغرض</span>
                                <span style={{ marginRight: '8px', textAlign: 'center' }}>
                                    {printingRecord.reason || '-'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: '20px' }}>
                                <span style={{ marginLeft: '8px', width: '130px' }}>الرصيد المتبقي</span>
                                <span style={{ marginRight: '8px', textAlign: 'center' }}>
                                    {printingRecord.employee_balance !== undefined ? printingRecord.employee_balance : 'غير مقروء'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: '20px' }}>
                                <span style={{ marginLeft: '8px', width: '130px' }}>كود الطلب</span>
                                <span style={{ marginRight: '8px', textAlign: 'center', fontSize: '11pt', fontFamily: 'monospace' }}>
                                    {printingRecord.id}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: '20px' }}>
                                <span style={{ marginLeft: '8px', width: '150px' }}>اسم صاحب الطلب :</span>
                                <span style={{ marginRight: '8px', textAlign: 'center' }}>
                                    {printingRecord.employee_name}
                                </span>
                            </div>
                        </div>

                        {/* Spacer to push signatures up slightly so they don't get cut off by printer margins */}
                        <div style={{ height: '15mm', flexShrink: 0 }}></div>

                        {/* Signatures */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '15mm', paddingLeft: '15mm', textAlign: 'center' }}>
                            <div style={{ width: '40%' }}>
                                {printingRecord.supervisor?.engineering_allowance && printingRecord.supervisor.engineering_allowance > 0 && (
                                    <p style={{ fontWeight: 'bold', fontSize: '13pt', margin: '0 0 4px 0' }}>المهندس</p>
                                )}
                                <p style={{ fontWeight: 'bold', fontSize: '13pt', margin: 0 }}>{printingRecord.supervisor?.full_name}</p>
                            </div>
                            <div style={{ width: '40%' }}>
                                <p style={{ fontWeight: 'bold', fontSize: '13pt', margin: '0 0 4px 0' }}>الدكتور</p>
                                <p style={{ fontWeight: 'bold', fontSize: '13pt', margin: 0 }}>{directorateManager?.full_name || 'علي عباس جاسم الصباغ'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 1. Pending HR Cut Approvals */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-slate-700 animate-in fade-in duration-500 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-2 h-full bg-amber-500"></div>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <CheckCircle className="text-amber-500" />
                            طلبات قطع الإجازة (بانتظار اعتماد الذاتية)
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            طلبات قطع تمت الموافقة عليها من قبل المسؤول المباشر وتحتاج إلى اعتمادك لإرجاع الرصيد.
                        </p>
                    </div>
                    <button
                        onClick={fetchPendingCutApprovals}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-bold"
                    >
                        تحديث
                    </button>
                </div>

                {isLoadingCutApprovals ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin text-amber-500" size={28} /></div>
                ) : cutApprovalRecords.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {cutApprovalRecords.map(record => (
                            <div key={record.id} className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700 flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                                <User size={14} className="text-amber-600" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-gray-900 dark:text-white">{record.employee_name}</p>
                                                {record.employee_job_number && (
                                                    <p className="text-[10px] text-gray-500 font-mono">{record.employee_job_number}</p>
                                                )}
                                            </div>
                                        </div>
                                        <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold ring-1 ring-amber-500/30">بانتظار اعتماد الذاتية</span>
                                    </div>
                                    <div className="space-y-1 text-sm">
                                        <p>الإجازة الأصلية: من <span className="font-bold dir-ltr inline-block font-mono">{record.start_date}</span> إلى <span className="font-bold dir-ltr inline-block font-mono">{record.end_date}</span> (المدة: {record.days_count} يوم)</p>
                                        <p className="text-rose-600 dark:text-rose-400 font-bold">تاريخ المباشرة (القطع): <span className="font-mono">{record.cut_date || 'غير محدد'}</span></p>
                                    </div>
                                </div>
                                <div className="mt-4 flex flex-col gap-2">
                                    <button
                                        onClick={() => {
                                            const actualDaysStr = window.prompt(`الموظف (${record.employee_name}) قَطَع إجازته بتاريخ ${record.cut_date}.\nكم عدد الأيام الفعلية التي تمتع بها قبل القطع؟\n\n(مثلاً إذا قطعها بعد يومين، أدخل: 2. سيتم إعادة الباقي لرصيده)`, "0");
                                            if (actualDaysStr !== null) {
                                                const actualDays = parseInt(actualDaysStr, 10);
                                                if (isNaN(actualDays) || actualDays < 0 || actualDays >= record.days_count) {
                                                    alert("يرجى إدخال عدد أيام صحيح (أقل من الإجازة الأصلية).");
                                                } else {
                                                    if (window.confirm(`هل أنت متأكد أن الأيام الفعلية هي ${actualDays} أيام؟\nسيتم إرجاع ${record.days_count - actualDays} يوم للموظف.`)) {
                                                        const processCut = async () => {
                                                            try {
                                                                const { data, error } = await supabase.rpc('process_hr_leave_cut', {
                                                                    p_request_id: record.id,
                                                                    p_actual_days: actualDays
                                                                });
                                                                if (error) throw error;
                                                                alert((data as any).message);
                                                                fetchPendingCutApprovals();
                                                                fetchAllApprovedRequests();
                                                            } catch (err: any) {
                                                                alert("حدث خطأ أثناء اعتماد القطع: " + err.message);
                                                            }
                                                        };
                                                        processCut();
                                                    }
                                                }
                                            }
                                        }}
                                        className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition shadow-md"
                                    >
                                        اعتماد قطع الإجازة وإرجاع الرصيد
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10 text-gray-500 bg-gray-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-gray-300 dark:border-slate-700">
                        لا توجد طلبات قطع إجازة بانتظار الاعتماد
                    </div>
                )}
            </div>

            {/* 2. Approved Requests — All Employees */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-slate-700 animate-in fade-in duration-500 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-2 h-full bg-green-500"></div>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <CheckCircle className="text-green-500" />
                            طلبات الإجازة المعتمدة
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            جميع الطلبات التي تمت الموافقة عليها بانتظار الطباعة والمعالجة
                        </p>
                    </div>
                    <button
                        onClick={fetchAllApprovedRequests}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-bold"
                    >
                        تحديث
                    </button>
                </div>

                {isLoadingApproved ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin text-green-500" size={28} /></div>
                ) : approvedRecords.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {approvedRecords.map(record => (
                            <div key={record.id} className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700 flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                                <User size={14} className="text-green-600" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-gray-900 dark:text-white">{record.employee_name}</p>
                                                {record.employee_job_number && (
                                                    <p className="text-[10px] text-gray-500 font-mono">{record.employee_job_number}</p>
                                                )}
                                            </div>
                                        </div>
                                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold ring-1 ring-green-500/30">معتمد</span>
                                    </div>
                                    <div className="space-y-1 text-sm">
                                        <p>من <span className="font-bold dir-ltr inline-block font-mono">{record.start_date}</span> إلى <span className="font-bold dir-ltr inline-block font-mono">{record.end_date}</span></p>
                                        <p className="text-gray-500">المدة: <span className="font-bold">{record.days_count} يوم</span> — المسؤول: <span className="font-bold">{record.supervisor?.full_name || '-'}</span></p>
                                        {(record.unpaid_days ?? 0) > 0 && (
                                            <p className="text-amber-600 dark:text-amber-400 font-bold text-xs mt-1">⚠️ ملاحظة: منها ({record.unpaid_days}) أيام كإجازة بدون راتب</p>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-4 flex flex-col gap-2">
                                    <button
                                        onClick={() => handlePrint(record)}
                                        className="w-full bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition shadow-md"
                                    >
                                        <Printer size={16} /> طباعة استمارة الإجازة PDF
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (window.confirm('هل أنت متأكد من حفظ (أرشفة) هذه الإجازة لتختفي من قائمة "بانتظار الطباعة"؟')) {
                                                const { error } = await supabase.from('leave_requests').update({ is_archived: true }).eq('id', record.id);
                                                if (!error) {
                                                    fetchAllApprovedRequests();
                                                } else {
                                                    alert("حدث خطأ أثناء أرشفة الإجازة.");
                                                }
                                            }
                                        }}
                                        className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2.5 rounded-lg text-sm font-bold transition flex justify-center items-center gap-2"
                                    >
                                        <Archive size={16} /> حفظ (أرشفة الاستمارة)
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10 text-gray-500 bg-gray-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-gray-300 dark:border-slate-700">
                        لا توجد طلبات معتمدة بانتظار المعالجة
                    </div>
                )}
            </div>

            {/* 2. Archive / Search Section (Collapsible) — with built-in employee search */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-slate-700 animate-in fade-in duration-500 transition-all">
                <button
                    onClick={() => setIsArchiveExpanded(!isArchiveExpanded)}
                    className="w-full flex items-center justify-between focus:outline-none"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                            <Search size={20} />
                        </div>
                        <div className="text-right">
                            <h2 className="text-lg font-bold">الأرشيف وبحث الاستمارات</h2>
                            <p className="text-sm text-gray-500">ابحث عن موظف بالاسم أو الرقم الوظيفي ثم ابحث في إجازاته</p>
                        </div>
                    </div>
                    <div className="p-2 bg-gray-100 dark:bg-slate-700 rounded-full text-gray-600 dark:text-gray-300">
                        {isArchiveExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                </button>

                {isArchiveExpanded && (
                    <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-700 animate-in slide-in-from-top-4 duration-300">
                        {/* Employee Search Field */}
                        <div className="mb-6" ref={archiveSearchRef}>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">بحث عن موظف</label>
                            <div className="relative">
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="الرقم الوظيفي أو الاسم..."
                                        value={archiveSearchQuery}
                                        onChange={e => setArchiveSearchQuery(e.target.value)}
                                        onFocus={() => { if (archiveSuggestions.length > 0) setShowArchiveSuggestions(true); }}
                                        className="w-full border rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-gray-50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                        {isArchiveSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                                    </div>
                                </div>

                                {/* Suggestions Dropdown */}
                                {showArchiveSuggestions && archiveSuggestions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[200px] overflow-y-auto">
                                        {archiveSuggestions.map((user, idx) => (
                                            <button
                                                key={user.id || idx}
                                                type="button"
                                                onMouseDown={e => e.preventDefault()}
                                                onClick={() => handleSelectArchiveEmployee(user)}
                                                className="w-full text-right px-4 py-3 border-b last:border-0 border-gray-100 dark:border-slate-700 flex items-center justify-between group hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                                        <User size={14} className="text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{user.full_name}</div>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">{user.job_number}</div>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] px-2 py-1 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 font-bold">
                                                    {user.role === 'admin' ? 'مدير' : 'موظف'}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {localEmployeeId ? (
                            <>
                                {/* Selected employee info */}
                                <div className="mb-6 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 px-4 py-3 rounded-xl text-sm border border-blue-200 dark:border-blue-800/50">
                                    <div className="flex items-center gap-2">
                                        <User size={16} className="text-blue-600" />
                                        <span className="font-bold text-blue-800 dark:text-blue-300">{localEmployeeName}</span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setLocalEmployeeId(undefined);
                                            setLocalEmployeeName(undefined);
                                            setArchiveRecords([]);
                                            setHasSearched(false);
                                        }}
                                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-bold transition-colors"
                                    >
                                        تغيير
                                    </button>
                                </div>

                                {/* Date Filters + Search Button */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 bg-gray-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-gray-100 dark:border-slate-700">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">من تاريخ</label>
                                        <DateInput
                                            value={startDate}
                                            onChange={setStartDate}
                                            className="w-full bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 rounded-xl"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">إلى تاريخ</label>
                                        <DateInput
                                            value={endDate}
                                            onChange={setEndDate}
                                            className="w-full bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 rounded-xl"
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <button
                                            onClick={handleArchiveSearch}
                                            disabled={isLoadingArchive}
                                            className="w-full h-[42px] bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50"
                                        >
                                            {isLoadingArchive ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                                            بحث في الأرشيف
                                        </button>
                                    </div>
                                </div>

                                {/* Results Table */}
                                {hasSearched && (
                                    <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-slate-700 shadow-inner">
                                        <table className="w-full text-sm text-right">
                                            <thead className="bg-gray-100 dark:bg-slate-900 text-gray-600 dark:text-gray-300 font-bold border-b border-gray-200 dark:border-slate-700">
                                                <tr>
                                                    <th className="px-4 py-4 whitespace-nowrap">الإجازة من</th>
                                                    <th className="px-4 py-4 whitespace-nowrap">إلى</th>
                                                    <th className="px-4 py-4 whitespace-nowrap text-center">المدة</th>
                                                    <th className="px-4 py-4 whitespace-nowrap">الحالة</th>
                                                    <th className="px-4 py-4 whitespace-nowrap text-center">إجراء</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                                {archiveRecords.length > 0 ? (
                                                    archiveRecords.map((record) => (
                                                        <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                                                            <td className="px-4 py-4 text-gray-600 dark:text-gray-300 dir-ltr text-right">{record.start_date}</td>
                                                            <td className="px-4 py-4 text-gray-600 dark:text-gray-300 dir-ltr text-right">{record.end_date}</td>
                                                            <td className="px-4 py-4 text-center font-bold">{record.days_count} يوم</td>
                                                            <td className="px-4 py-4">
                                                                {record.status === 'approved' ? (
                                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">موافق عليه</span>
                                                                ) : record.status === 'rejected' ? (
                                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">مرفوض</span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                                                                        {record.status === 'pending' ? 'قيد الانتظار' : record.status}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-4 text-center">
                                                                {record.status === 'approved' && (
                                                                    <button
                                                                        onClick={() => handlePrint(record)}
                                                                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-2 rounded-lg transition"
                                                                        title="طباعة"
                                                                    >
                                                                        <Printer size={18} />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={5} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400 font-medium">
                                                            لا توجد إجازات مطابقة لخيارات البحث
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-10 text-gray-500 bg-gray-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-gray-300 dark:border-slate-700">
                                <Search size={32} className="mx-auto mb-3 text-gray-400" />
                                <p className="font-bold">اختر موظفاً أولاً</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div >
    );
}
