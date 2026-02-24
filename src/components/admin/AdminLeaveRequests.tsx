import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Search, Loader2 } from 'lucide-react';
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
    supervisor: {
        full_name: string;
    } | null;
}

export const AdminLeaveRequests = ({ employeeId, employeeName }: AdminLeaveRequestsProps) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [records, setRecords] = useState<LeaveRecord[]>([]);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async () => {
        setIsLoading(true);
        setHasSearched(true);

        try {
            let query = supabase
                .from('leave_requests')
                .select(`
                    id,
                    start_date,
                    end_date,
                    status,
                    days_count,
                    supervisor:profiles!leave_requests_supervisor_id_fkey(full_name)
                `)
                .eq('user_id', employeeId);

            if (startDate) {
                query = query.gte('start_date', startDate);
            }
            if (endDate) {
                query = query.lte('end_date', endDate);
            }

            // Optional: Order by most recent
            query = query.order('start_date', { ascending: false });

            const { data, error } = await query;

            if (error) {
                console.error("Error fetching leaves:", error);
            } else {
                // Formatting the supervisor data because Supabase joins return it as an array or object depending on relation
                const formattedData = (data || []).map(item => ({
                    ...item,
                    supervisor: Array.isArray(item.supervisor) ? item.supervisor[0] : item.supervisor
                })) as LeaveRecord[];

                setRecords(formattedData);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-5 duration-500">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                    <Calendar size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold">استمارة الإجازات</h2>
                    <p className="text-sm text-muted-foreground">للموظف: <span className="font-bold text-foreground">{employeeName}</span></p>
                </div>
            </div>

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
                        disabled={isLoading}
                        className="w-full h-[42px] bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                        بحث وتأكيد
                    </button>
                </div>
            </div>

            {/* Results Table */}
            {hasSearched && (
                <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-slate-700">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-gray-50 dark:bg-slate-900/80 text-gray-600 dark:text-gray-300 font-bold border-b border-gray-100 dark:border-slate-700">
                            <tr>
                                <th className="px-4 py-4 whitespace-nowrap">اسم الموظف</th>
                                <th className="px-4 py-4 whitespace-nowrap">الإجازة من</th>
                                <th className="px-4 py-4 whitespace-nowrap">إلى</th>
                                <th className="px-4 py-4 whitespace-nowrap">الموافقة</th>
                                <th className="px-4 py-4 whitespace-nowrap text-center">عدد الأيام التي تمتع بها</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                            {records.length > 0 ? (
                                records.map((record) => (
                                    <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-4 py-4 font-bold text-gray-900 dark:text-white">{employeeName}</td>
                                        <td className="px-4 py-4 text-gray-600 dark:text-gray-300 dir-ltr text-right">{record.start_date}</td>
                                        <td className="px-4 py-4 text-gray-600 dark:text-gray-300 dir-ltr text-right">{record.end_date}</td>
                                        <td className="px-4 py-4">
                                            {record.status === 'approved' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/50">
                                                    تمت الموافقة ({record.supervisor?.full_name || 'غير معروف'})
                                                </span>
                                            ) : record.status === 'rejected' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50">
                                                    التطبيق مرفوض
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800/50">
                                                    قيد الانتظار
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            {/* Placeholder for future update as requested by user */}
                                            <div className="inline-flex items-center justify-center min-w-[32px] h-8 px-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-500 font-bold border border-gray-200 dark:border-slate-600">
                                                -
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                                        لا توجد إجازات مسجلة لهذه الفترة.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
