import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Loader2, ChevronDown, ChevronUp, Printer, CheckCircle } from 'lucide-react';
import { DateInput } from '../ui/DateInput';

interface AdminLeaveRequestsProps {
    employeeId: string;
    employeeName: string;
}

interface LeaveRecord {
    id: string;
    start_date: string;
    end_date: string;
    status: string;
    days_count: number;
    reason: string;
    supervisor_id: string;
    created_at: string;
    supervisor: {
        full_name: string;
        job_title?: string;
    } | null;
}

export const AdminLeaveRequests = ({ employeeId, employeeName }: AdminLeaveRequestsProps) => {
    const [isArchiveExpanded, setIsArchiveExpanded] = useState(false);

    // Search state
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isLoadingArchive, setIsLoadingArchive] = useState(false);
    const [archiveRecords, setArchiveRecords] = useState<LeaveRecord[]>([]);
    const [hasSearched, setHasSearched] = useState(false);

    // New approved requests state
    const [isLoadingApproved, setIsLoadingApproved] = useState(true);
    const [approvedRecords, setApprovedRecords] = useState<LeaveRecord[]>([]);

    // Print state
    const [printingRecord, setPrintingRecord] = useState<LeaveRecord | null>(null);
    const [directorateManager, setDirectorateManager] = useState<{ full_name: string, job_title: string } | null>(null);
    const [employeeProfile, setEmployeeProfile] = useState<any>(null);

    // Fetch initial approved requests and hierarchy info
    useEffect(() => {
        const fetchInitialData = async () => {
            if (!employeeId) return;
            setIsLoadingApproved(true);

            try {
                // 1. Fetch employee profile and department
                const { data: profile } = await supabase.from('profiles').select('*, departments(id, name, parent_id, manager_id)').eq('id', employeeId).single();
                setEmployeeProfile(profile);

                // 2. Resolve directorate manager (root node)
                if (profile?.department_id) {
                    let currentDeptId = profile.department_id;
                    let lastManagerId = null;

                    while (currentDeptId) {
                        const { data: dept } = await supabase.from('departments').select('*').eq('id', currentDeptId).single();
                        if (!dept) break;

                        // We keep taking the manager, until we hit a node with no parent or it's the root.
                        if (dept.manager_id) {
                            lastManagerId = dept.manager_id;
                        }

                        if (!dept.parent_id) {
                            break; // Root found
                        }
                        currentDeptId = dept.parent_id;
                    }

                    if (lastManagerId) {
                        const { data: mgrProfile } = await supabase.from('profiles').select('full_name, job_title').eq('id', lastManagerId).single();
                        if (mgrProfile) {
                            setDirectorateManager({
                                full_name: mgrProfile.full_name,
                                job_title: mgrProfile.job_title || 'مدير المديرية'
                            });
                        }
                    }
                }

                // 3. Fetch approved requests (pending HR action)
                const { data: approvedData } = await supabase
                    .from('leave_requests')
                    .select('id, start_date, end_date, status, days_count, reason, supervisor_id, created_at')
                    .eq('user_id', employeeId)
                    .eq('status', 'approved')
                    .order('created_at', { ascending: false });

                if (approvedData && approvedData.length > 0) {
                    await populateSupervisors(approvedData, setApprovedRecords);
                } else {
                    setApprovedRecords([]);
                }

            } catch (err) {
                console.error("Error fetching initial data", err);
            } finally {
                setIsLoadingApproved(false);
            }
        };

        fetchInitialData();
    }, [employeeId]);

    const populateSupervisors = async (data: any[], setter: (val: LeaveRecord[]) => void) => {
        const validIds = data.map(r => r.supervisor_id).filter(Boolean);
        const supervisorIds = [...new Set(validIds)];
        let supervisorMap: Record<string, { full_name: string; job_title?: string }> = {};

        if (supervisorIds.length > 0) {
            const { data: supervisorsData } = await supabase
                .from('profiles')
                .select('id, full_name, job_title')
                .in('id', supervisorIds);

            if (supervisorsData) {
                supervisorsData.forEach(sup => {
                    supervisorMap[sup.id] = { full_name: sup.full_name, job_title: sup.job_title };
                });
            }
        }

        const formattedData = data.map(item => ({
            ...item,
            supervisor: item.supervisor_id && supervisorMap[item.supervisor_id]
                ? supervisorMap[item.supervisor_id]
                : null
        })) as LeaveRecord[];

        setter(formattedData);
    };

    const handleSearch = async () => {
        setIsLoadingArchive(true);
        setHasSearched(true);

        try {
            let query = supabase
                .from('leave_requests')
                .select('id, start_date, end_date, status, days_count, reason, supervisor_id, created_at')
                .eq('user_id', employeeId);

            if (startDate) query = query.gte('start_date', startDate);
            if (endDate) query = query.lte('end_date', endDate);

            query = query.order('start_date', { ascending: false });

            const { data, error } = await query;

            if (error) {
                console.error("Error fetching leaves:", error);
            } else if (data && data.length > 0) {
                await populateSupervisors(data, setArchiveRecords);
            } else {
                setArchiveRecords([]);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoadingArchive(false);
        }
    };

    const handlePrint = (record: LeaveRecord) => {
        setPrintingRecord(record);
        // Wait a tick for React to render the hidden print block, then print
        setTimeout(() => {
            window.print();
            // Clear printing record after 1s so the UI returns to normal
            setTimeout(() => setPrintingRecord(null), 1000);
        }, 500);
    };

    return (
        <div className="space-y-6">
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #print-section, #print-section * {
                        visibility: visible;
                    }
                    #print-section {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        background: white;
                        color: black;
                        padding: 40px;
                        font-family: inherit;
                        direction: rtl;
                    }
                    /* Ensure backgrounds and borders print correctly */
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>

            {/* Hidden Print Layout */}
            {printingRecord && (
                <div id="print-section" className="hidden">
                    <div className="border-4 border-double border-gray-900 mx-auto max-w-4xl min-h-[800px] p-10 relative bg-white">
                        <div className="text-center mb-10 pb-6 border-b-2 border-gray-300">
                            <h1 className="text-3xl font-black mb-2 text-black">استمارة طلب إجازة</h1>
                            <p className="text-lg text-gray-700 font-bold">وزارة الاتصالات - مديرية اتصالات ومعلوماتية كربلاء المقدسة</p>
                        </div>

                        <div className="grid grid-cols-2 gap-8 mb-10 text-lg text-black font-semibold">
                            <div className="flex bg-gray-50 p-3 border border-gray-200">
                                <span className="w-32 text-gray-600">اسم الموظف:</span>
                                <span>{employeeName}</span>
                            </div>
                            <div className="flex bg-gray-50 p-3 border border-gray-200">
                                <span className="w-32 text-gray-600">الرقم الوظيفي:</span>
                                <span>{employeeProfile?.job_number || '-'}</span>
                            </div>
                            <div className="flex bg-gray-50 p-3 border border-gray-200">
                                <span className="w-32 text-gray-600">القسم / الشعبة:</span>
                                <span>{employeeProfile?.departments?.name || '-'}</span>
                            </div>
                            <div className="flex bg-gray-50 p-3 border border-gray-200">
                                <span className="w-32 text-gray-600">العنوان الوظيفي:</span>
                                <span>{employeeProfile?.job_title || '-'}</span>
                            </div>
                        </div>

                        <div className="mb-10 p-6 border-2 border-gray-900 rounded-lg text-black bg-white">
                            <h2 className="text-xl font-black border-b border-gray-300 pb-3 mb-4">تفاصيل الإجازة</h2>
                            <div className="grid grid-cols-2 gap-y-6 text-lg">
                                <div><span className="font-bold text-gray-700 ml-2">تاريخ البدء:</span> <span className="font-mono">{printingRecord.start_date}</span></div>
                                <div><span className="font-bold text-gray-700 ml-2">تاريخ الانتهاء:</span> <span className="font-mono">{printingRecord.end_date}</span></div>
                                <div><span className="font-bold text-gray-700 ml-2">عدد الأيام:</span> {printingRecord.days_count} يوم</div>
                                <div className="col-span-2">
                                    <span className="font-bold text-gray-700 ml-2 block mb-2">السبب:</span>
                                    <div className="p-3 bg-gray-50 border border-gray-200 min-h-[60px] whitespace-pre-wrap rounded">
                                        {printingRecord.reason || 'لا يوجد'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="absolute bottom-16 left-10 right-10 flex justify-between px-10 items-end text-black text-center text-lg">
                            <div className="w-64">
                                <p className="font-bold mb-12">موافقة المسؤول المباشر</p>
                                <p className="font-semibold">{printingRecord.supervisor?.full_name}</p>
                                <p className="text-sm text-gray-600">{printingRecord.supervisor?.job_title || 'مسؤول'}</p>
                                <p className="text-xs text-gray-400 mt-2 font-mono">{new Date(printingRecord.created_at).toLocaleDateString()}</p>
                            </div>

                            <div className="w-64">
                                <p className="font-bold mb-12">موافقة مدير المديرية</p>
                                <p className="font-semibold">{directorateManager?.full_name || '.......................'}</p>
                                <p className="text-sm text-gray-600">{directorateManager?.job_title || '.......................'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* 1. Approved Requests Section (New) */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-slate-700 animate-in fade-in duration-500 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-2 h-full bg-green-500"></div>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <CheckCircle className="text-green-500" />
                            طلبات الإجازة المعتمدة
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            الطلبات التي تمت الموافقة عليها بانتظار الطباعة والمعالجة في الذاتية
                        </p>
                    </div>
                </div>

                {isLoadingApproved ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin text-green-500" /></div>
                ) : approvedRecords.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {approvedRecords.map(record => (
                            <div key={record.id} className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700 flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold ring-1 ring-green-500/30">معتمد</span>
                                        <span className="text-sm font-mono text-gray-500">{record.days_count} يوم</span>
                                    </div>
                                    <p className="text-sm">من <span className="font-bold dir-ltr inline-block font-mono">{record.start_date}</span> إلى <span className="font-bold dir-ltr inline-block font-mono">{record.end_date}</span></p>
                                    <p className="text-xs mt-2 text-gray-500">المسؤول: <span className="font-bold">{record.supervisor?.full_name}</span></p>
                                </div>
                                <button
                                    onClick={() => handlePrint(record)}
                                    className="mt-4 w-full bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white py-2 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition"
                                >
                                    <Printer size={16} /> استمارة الإجازة (طباعة PDF)
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-gray-300 dark:border-slate-700">
                        لا توجد طلبات معتمدة بانتظار المعالجة
                    </div>
                )}
            </div>

            {/* 2. Search / Archive Section (Collapsible) */}
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
                            <p className="text-sm text-gray-500">البحث في كافة الإجازات السابقة للموظف</p>
                        </div>
                    </div>
                    <div className="p-2 bg-gray-100 dark:bg-slate-700 rounded-full text-gray-600 dark:text-gray-300">
                        {isArchiveExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                </button>

                {isArchiveExpanded && (
                    <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-700 animate-in slide-in-from-top-4 duration-300">
                        {/* Filters */}
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
                                    onClick={handleSearch}
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
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                                                موافق عليه
                                                            </span>
                                                        ) : record.status === 'rejected' ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                                                                مرفوض
                                                            </span>
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
                    </div>
                )}
            </div>
        </div>
    );
};
