import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Loader2, ChevronDown, ChevronUp, Printer, CheckCircle, User } from 'lucide-react';
import { DateInput } from '../ui/DateInput';

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
    supervisor: {
        full_name: string;
        job_title?: string;
    } | null;
}

export const AdminLeaveRequests = ({ employeeId, employeeName }: AdminLeaveRequestsProps) => {
    const [isArchiveExpanded, setIsArchiveExpanded] = useState(false);

    // Approved requests state (all employees)
    const [isLoadingApproved, setIsLoadingApproved] = useState(true);
    const [approvedRecords, setApprovedRecords] = useState<LeaveRecord[]>([]);

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
    const [printingRecord, setPrintingRecord] = useState<LeaveRecord | null>(null);
    const [directorateManager, setDirectorateManager] = useState<{ full_name: string, job_title: string } | null>(null);

    // Fetch all approved requests for all employees
    useEffect(() => {
        fetchAllApprovedRequests();
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
                .select('id, user_id, start_date, end_date, status, days_count, reason, supervisor_id, created_at')
                .eq('status', 'approved')
                .order('created_at', { ascending: false });

            if (data && data.length > 0) {
                const userIds = [...new Set(data.map(r => r.user_id).filter(Boolean))];
                const supervisorIds = [...new Set(data.map(r => r.supervisor_id).filter(Boolean))];
                const allIds = [...new Set([...userIds, ...supervisorIds])];

                let profileMap: Record<string, { full_name: string; job_title?: string; job_number?: string; department_id?: string }> = {};
                let deptMap: Record<string, string> = {};

                if (allIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, full_name, job_number, department_id')
                        .in('id', allIds);
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
                        ? { full_name: profileMap[item.supervisor_id].full_name, job_title: '' }
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

    // Resolve directorate manager for print
    const resolveDirectorateManager = async (userId: string) => {
        try {
            const { data: profile } = await supabase.from('profiles').select('department_id').eq('id', userId).single();
            if (!profile?.department_id) return;

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
                }
            }
        } catch (err) {
            console.error("Error resolving directorate manager", err);
        }
    };

    // Populate supervisor info for records
    const populateSupervisors = async (data: any[]) => {
        const supIds = [...new Set(data.map(r => r.supervisor_id).filter(Boolean))];
        let supMap: Record<string, { full_name: string; job_title?: string }> = {};

        if (supIds.length > 0) {
            const { data: sups } = await supabase.from('profiles').select('id, full_name').in('id', supIds);
            if (sups) sups.forEach(s => { supMap[s.id] = { ...s, job_title: '' }; });
        }

        return data.map(item => ({
            ...item,
            employee_name: localEmployeeName || '',
            supervisor: item.supervisor_id && supMap[item.supervisor_id]
                ? supMap[item.supervisor_id]
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
                .select('id, user_id, start_date, end_date, status, days_count, reason, supervisor_id, created_at')
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
        await resolveDirectorateManager(record.user_id);
        setPrintingRecord(record);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                window.print();
                requestAnimationFrame(() => setPrintingRecord(null));
            });
        });
    };

    return (
        <div className="space-y-6">
            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 0; }
                    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: white !important; }
                    body * { visibility: hidden; }
                    #print-section {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100vw;
                        height: 100vh;
                        visibility: visible !important;
                        background: white;
                    }
                    #print-section * { visibility: visible !important; }
                }
            `}</style>

            {/* Hidden Print Layout */}
            {printingRecord && (
                <div id="print-section" className="hidden print:block w-[210mm] h-[297mm] mx-auto bg-white text-black py-4 px-12 relative font-sans" dir="rtl">
                    {/* Header Section */}
                    <div className="flex justify-between items-start mb-8">
                        {/* Top Right: Directorate Info */}
                        <div className="text-center w-80 leading-relaxed text-sm">
                            <p className="font-bold mb-1">مديرية اتصالات ومعلوماتية</p>
                            <p className="text-lg font-black mb-2">كربلاء المقدسة</p>
                            <p className="font-bold text-xs mb-1">نظام الإدارة الموحد</p>
                            <p className="text-xs font-semibold">طبعت : {new Date().toLocaleDateString('en-GB')}</p>
                        </div>

                        {/* Top Left: Approval Seal */}
                        <div className="text-center mt-2">
                            <div className="border-[2px] border-green-700/80 rounded-full px-4 py-1.5 mb-2 inline-block">
                                <p className="text-green-700 font-bold text-sm tracking-wide">حاصل على موافقة المسؤول المباشر</p>
                            </div>
                            <p className="text-xs font-bold text-gray-800">{new Date(printingRecord.created_at).toLocaleDateString('en-GB')}</p>
                        </div>
                    </div>

                    {/* Title */}
                    <div className="text-center mb-10">
                        <h1 className="text-xl font-black tracking-wider">استمارة الاجازة الاعتيادية</h1>
                    </div>

                    {/* Body content */}
                    <div className="text-lg leading-[3rem] font-bold px-4 mb-20 relative">
                        <div className="flex flex-wrap items-center">
                            <span className="ml-2">يرجى الموافقة على منحي إجازة اعتيادية لمدة</span>
                            <span className="inline-block px-4 mx-2 min-w-[80px] text-center font-mono">
                                {printingRecord.days_count} يوم
                            </span>
                            <span className="mr-8">اعتبارا من</span>
                        </div>
                        <div className="flex items-center mt-4">
                            <span className="ml-2 w-16">تأريخ</span>
                            <span className="inline-block px-4 mx-2 text-center font-mono">
                                {printingRecord.start_date}
                            </span>
                            <span className="ml-4 mr-4 text-nowrap">. وذلك لأغراض</span>
                            <span className="inline-block px-4 min-w-[200px] text-center flex-1 break-words leading-relaxed overflow-hidden" style={{ maxHeight: '12rem' }}>
                                {printingRecord.reason || '-'}
                            </span>
                        </div>

                        {/* Employee Name floating middle left (2 empty lines below text) */}
                        <div className="absolute left-8 mt-16 text-center min-w-[200px]">
                            <p className="text-lg font-bold px-4 pb-1 inline-block">{printingRecord.employee_name}</p>
                        </div>
                    </div>

                    {/* Bottom Section */}
                    {/* Positioned higher up from bottom to reduce space from employee name */}
                    <div className="absolute w-full top-[16rem] mt-48 left-0 right-0 flex justify-between px-16 items-start text-base text-center">
                        {/* Bottom Right: Supervisor */}
                        <div className="w-1/3 pt-4">
                            <p className="font-bold mb-4">{printingRecord.supervisor?.full_name}</p>
                        </div>

                        {/* Bottom Left: Manager */}
                        <div className="w-1/3 pt-4">
                            <p className="font-bold mb-4">{directorateManager?.full_name || 'علي عباس جاسم الصباغ'}</p>
                        </div>
                    </div>
                </div>
            )}


            {/* 1. Approved Requests — All Employees */}
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
                                    </div>
                                </div>
                                <button
                                    onClick={() => handlePrint(record)}
                                    className="mt-4 w-full bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white py-2.5 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition shadow-md"
                                >
                                    <Printer size={16} /> طباعة استمارة الإجازة PDF
                                </button>
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
                                <p className="text-sm mt-1">استخدم حقل البحث أعلاه للبحث عن الموظف المراد عرض أرشيف إجازاته</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
