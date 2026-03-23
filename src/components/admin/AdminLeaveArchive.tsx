import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Loader2, ChevronDown, ChevronUp, Printer, User } from 'lucide-react';
import { DateInput } from '../ui/DateInput';
import { EmployeeSearch } from '../shared/EmployeeSearch';
import type { LeaveRecord } from './AdminLeaveRequests';

interface AdminLeaveArchiveProps {
    employeeId?: string;
    employeeName?: string;
    onPrint: (record: LeaveRecord) => void;
}

export function AdminLeaveArchive({ employeeId, employeeName, onPrint }: AdminLeaveArchiveProps) {
    const [isArchiveExpanded, setIsArchiveExpanded] = useState(false);
    
    // Archive search state
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isLoadingArchive, setIsLoadingArchive] = useState(false);
    const [archiveRecords, setArchiveRecords] = useState<LeaveRecord[]>([]);
    const [hasSearched, setHasSearched] = useState(false);

    // Internal employee search state
    const [localEmployeeId, setLocalEmployeeId] = useState<string | undefined>(employeeId);
    const [localEmployeeName, setLocalEmployeeName] = useState<string | undefined>(employeeName);

    // Sync local employee with props
    useEffect(() => {
        setLocalEmployeeId(employeeId);
        setLocalEmployeeName(employeeName);
        setArchiveRecords([]);
        setHasSearched(false);
    }, [employeeId, employeeName]);

    const handleSelectArchiveEmployee = (user: any) => {
        setLocalEmployeeId(user.id);
        setLocalEmployeeName(user.full_name);
        setArchiveRecords([]);
        setHasSearched(false);
    };

    // Populate supervisor and employee info for records (used by Search Archive)
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

    return (
        <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-slate-700 animate-in fade-in duration-500 transition-all">
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
                    <div className="mb-6">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">بحث عن موظف</label>
                        <EmployeeSearch
                            onSelect={handleSelectArchiveEmployee}
                            placeholder="الرقم الوظيفي أو الاسم..."
                            className=""
                            inputClassName="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-gray-50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all"
                        />
                    </div>

                    {localEmployeeId ? (
                        <>
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
                                                                    onClick={() => onPrint(record)}
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
    );
}
