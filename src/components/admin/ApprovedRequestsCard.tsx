import { supabase } from '../../lib/supabase';
import { Loader2, CheckCircle, User, Printer, Archive, ChevronDown, ChevronUp } from 'lucide-react';
import type { LeaveRecord } from './AdminLeaveRequests';
import { LeaveTypeBadge } from './LeaveTypeBadge';
import { HRDocumentProcessingPanel } from './HRDocumentProcessingPanel';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';

interface ApprovedRequestsCardProps {
    records: LeaveRecord[];
    isLoading: boolean;
    onRefresh: () => void;
    activeHighlightId: string | null;
    onPrint: (record: LeaveRecord) => void;
    isExpanded: boolean;
    onToggle: () => void;
}

export function ApprovedRequestsCard({
    records,
    isLoading,
    onRefresh,
    activeHighlightId,
    onPrint,
    isExpanded,
    onToggle
}: ApprovedRequestsCardProps) {
    const { user } = useAuth();
    const [selectedRecordForHR, setSelectedRecordForHR] = useState<LeaveRecord | null>(null);
    const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);

    return (
        <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-slate-700 animate-in fade-in duration-500 relative">
            <div className="absolute top-0 right-0 w-2 h-full bg-green-500 rounded-r-3xl"></div>
            <button
                onClick={onToggle}
                className="w-full flex justify-between items-center mb-6 sticky top-20 z-20 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-gray-100/50 dark:border-slate-700/50 focus:outline-none"
            >
                <div className="flex-1 text-right">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <CheckCircle className="text-green-500" />
                        طلبات الإجازة المعتمدة
                        {records.length > 0 && (
                            <span className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 text-xs font-bold px-2 py-0.5 rounded-full mr-2">
                                {records.length}
                            </span>
                        )}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1 text-right">
                        جميع الطلبات التي تمت الموافقة عليها بانتظار الطباعة والمعالجة
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            onRefresh();
                        }}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-bold"
                    >
                        تحديث
                    </div>
                    <div className="p-2 bg-gray-100 dark:bg-slate-700 rounded-full text-gray-600 dark:text-gray-300">
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                </div>
            </button>

            {isExpanded && (
                <div className="animate-in slide-in-from-top-4 duration-300">

            {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-green-500" size={28} /></div>
            ) : records.length > 0 ? (
                <div className="flex flex-col gap-3">
                    {records.map(record => {
                        const nameParts = record.employee_name ? record.employee_name.split(' ').slice(0, 2).join(' ') : 'غير معروف';
                        const isItemExpanded = expandedRequestId === record.id;
                        const typeLabel = record.leave_type === 'long_regular' ? 'اعتيادية طويلة' : record.leave_type === 'long_sick' ? 'مرضية طويلة' : record.leave_type === 'sick' ? 'مرضية' : record.leave_type === 'regular' ? 'اعتيادية' : record.leave_type === 'time_off' ? 'زمنية' : '';

                        return (
                            <div 
                                key={record.id} 
                                id={`request-${record.id}`}
                                className={`bg-white dark:bg-slate-900 border rounded-xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md ${isItemExpanded ? 'border-green-200 dark:border-green-800 ring-1 ring-green-500/20' : 'border-gray-200 dark:border-slate-700 cursor-pointer'} ${record.id === activeHighlightId ? 'highlight-request' : ''}`}
                            >
                                {/* Thin Bar (Collapsed View) */}
                                <div 
                                    onClick={() => setExpandedRequestId(isItemExpanded ? null : record.id)}
                                    className={`flex items-center justify-between p-3 ${isItemExpanded ? 'bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700/50' : 'cursor-pointer'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                                            <User size={16} className="text-green-600 dark:text-green-400" />
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-bold text-sm">{nameParts}</span>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100 dark:bg-green-900/20 dark:border-green-800/50">إجازة معتمدة {typeLabel ? `(${typeLabel})` : ''}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                {isItemExpanded && (
                                    <div className="p-4 animate-in slide-in-from-top-2 duration-200 bg-gray-50/50 dark:bg-slate-900/50">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                                                    <User size={20} className="text-green-600 dark:text-green-400" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-base text-gray-900 dark:text-white">{record.employee_name}</p>
                                                    {record.employee_job_number && (
                                                        <p className="text-[12px] text-gray-500 font-mono">{record.employee_job_number}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <LeaveTypeBadge type={record.leave_type} cancellationStatus={record.cancellation_status} timeOffSubtype={record.time_off_subtype} isMandatory={record.is_mandatory} />
                                        </div>
                                        <div className="space-y-1 text-sm bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-100 dark:border-slate-700 mb-4">
                                            <p>من <span className="font-bold dir-ltr inline-block font-mono">{record.start_date}</span> إلى <span className="font-bold dir-ltr inline-block font-mono">{record.end_date}</span></p>
                                            
                                            {record.leave_type === 'time_off' ? (
                                                <p className="text-gray-500">المدة: <span className="font-bold text-teal-600">{record.time_duration_minutes} دقيقة</span> — المسؤول: <span className="font-bold">{record.supervisor?.full_name || '-'}</span></p>
                                            ) : (
                                                <p className="text-gray-500">المدة: <span className="font-bold">{record.days_count} يوم</span> — المسؤول: <span className="font-bold">{record.supervisor?.full_name || '-'}</span></p>
                                            )}

                                            {record.destination && (
                                                <p className="text-gray-500 text-xs mt-1">الوجهة: <span className="font-bold text-purple-700 dark:text-purple-400">{record.destination}</span></p>
                                            )}

                                            {(record.unpaid_days ?? 0) > 0 && record.leave_type !== 'unpaid' && (
                                                <p className="text-amber-600 dark:text-amber-400 font-bold text-xs mt-1">⚠️ ملاحظة: منها ({record.unpaid_days}) أيام كإجازة بدون راتب</p>
                                            )}

                                            {/* HR Status Indicator */}
                                            {['long_regular', 'sick', 'long_sick', 'dispatch', 'duty'].includes(record.leave_type) && (
                                                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-700/50">
                                                    {record.hr_status === 'completed' ? (
                                                        <span className="inline-flex items-center gap-1 text-[11px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-1 rounded-md font-bold">
                                                            <CheckCircle size={12} /> مستندات HR مكتملة
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-[11px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-1 rounded-md font-bold">
                                                            <Loader2 size={12} className="animate-spin" /> بانتظار إكمال المستندات
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            {['long_regular', 'sick', 'long_sick', 'dispatch', 'duty'].includes(record.leave_type) && record.hr_status !== 'completed' && (
                                                <button
                                                    onClick={() => setSelectedRecordForHR(record)}
                                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition shadow-md"
                                                >
                                                    📋 إكمال المستندات
                                                </button>
                                            )}
                                            {record.cancellation_status !== 'approved' && (
                                                <button
                                                    onClick={() => onPrint(record)}
                                                    className="w-full bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white py-3 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition shadow-md"
                                                >
                                                    <Printer size={18} /> طباعة استمارة الإجازة PDF
                                                </button>
                                            )}
                                            <button
                                                onClick={async () => {
                                                    if (window.confirm('هل أنت متأكد من حفظ (أرشفة) هذه الإجازة لتختفي من قائمة "بانتظار الطباعة"؟')) {
                                                        const { error } = await supabase.from('leave_requests').update({ is_archived: true }).eq('id', record.id);
                                                        if (!error) {
                                                            onRefresh();
                                                        } else {
                                                            alert("حدث خطأ أثناء أرشفة الإجازة.");
                                                        }
                                                    }
                                                }}
                                                className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-3 rounded-xl text-sm font-bold transition flex justify-center items-center gap-2 shadow-sm"
                                            >
                                                <Archive size={18} /> حفظ (أرشفة الاستمارة)
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-10 text-gray-500 bg-gray-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-gray-300 dark:border-slate-700">
                    لا توجد طلبات معتمدة بانتظار المعالجة
                </div>
            )}

            {selectedRecordForHR && (
                <HRDocumentProcessingPanel
                    record={selectedRecordForHR}
                    onClose={() => setSelectedRecordForHR(null)}
                    onSuccess={() => {
                        setSelectedRecordForHR(null);
                        onRefresh();
                    }}
                    currentUser={user ? { id: user.id, full_name: user.full_name || 'موظف HR' } : null}
                />
            )}
                </div>
            )}
        </div>
    );
}
