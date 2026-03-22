import { useState } from 'react';
import { User, Check, X, Calendar, FileText, AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

import { sendPushNotification } from '../../../services/notifications';

interface LeaveRequest {
    id: string;
    user_id: string;
    start_date: string;
    end_date: string;
    days_count: number;
    reason: string;
    status: string;
    created_at: string;
    modification_type?: string;
    unpaid_days?: number;
    cut_date?: string;
    profiles?: {
        full_name: string;
        job_number: string;
        avatar_url?: string;
    };
}

interface ApprovalModalProps {
    request: LeaveRequest;
    onClose: () => void;
    onProcessed: () => void;
}

export const ApprovalModal = ({ request, onClose, onProcessed }: ApprovalModalProps) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAction = async (status: 'approved' | 'rejected') => {
        setIsProcessing(true);
        setError(null);

        try {
            let updatePayload: any = { status: status }; // Keep old status for backward compatibility of UI

            if (request.modification_type === 'canceled') {
                if (status === 'approved') {
                    // Call RPC to fully refund leave
                    const { data: rpcData, error: rpcErr } = await supabase.rpc('process_leave_cancellation', {
                        p_request_id: request.id
                    });
                    if (rpcErr) throw rpcErr;
                    if (rpcData && !rpcData.success) throw new Error(rpcData.message);
                } else {
                    updatePayload.cancellation_status = status;
                }
            } else if (request.modification_type === 'cut') {
                updatePayload.cut_status = status;
                if (status === 'approved') {
                    updatePayload.hr_cut_status = 'pending';
                }
            } else {
                // Normally (new, or edited)
                updatePayload.leave_status = status;
            }

            const { data, error: updateError } = await supabase
                .from('leave_requests')
                .update(updatePayload)
                .eq('id', request.id)
                .select();

            if (updateError) throw updateError;
            if (!data || data.length === 0) {
                throw new Error("لم يتم التحديث في قاعدة البيانات. قد يكون بسبب نقص في صلاحياتك (RLS) أو أن الطلب تمت معالجته بالفعل.");
            }

            onProcessed();
            onClose();

            // Send Push Notification to Employee
            const statusText = status === 'approved' ? 'موافق عليه' : 'مرفوض';
            let message = `تم ${statusText} لطلب إجازتك (${request.start_date})`;

            if (request.modification_type === 'canceled') {
                message = `تم ${statusText} لطلب إلغاء إجازتك (${request.start_date})`;
            } else if (request.modification_type === 'cut') {
                message = `تم ${statusText} لطلب قطع إجازتك (${request.start_date})`;
            }
            sendPushNotification(request.user_id, message, { title: "تحديث طلب الإجازة", url: `${window.location.origin}/requests` });

            // Notify HR/Admin if it's a cut or cancellation approval
            if (status === 'approved' && (request.modification_type === 'canceled' || request.modification_type === 'cut')) {
                try {
                    // Fetch all admins/hr (avoid developer role if it's assigned to too many people incorrectly)
                    const { data: admins } = await supabase
                        .from('profiles')
                        .select('id, full_name')
                        .or('admin_role.eq.hr,full_name.ilike.%مسلم عقيل%,full_name.ilike.%مسلم قيل%');

                    if (admins && admins.length > 0) {
                        const hrTitle = request.modification_type === 'canceled' ? "إلغاء إجازة" : "اعتماد قطع إجازة";
                        const hrMessage = request.modification_type === 'canceled'
                            ? `تم إلغاء إجازة الموظف (${request.profiles?.full_name || 'مجهول'}) واسترجاع رصيده بالكامل.`
                            : `توجد إجازة مقطوعة للموظف (${request.profiles?.full_name || 'مجهول'}) بانتظار اعتمادك لإرجاع الرصيد.`;

                        // Send Push to all admins
                        for (const admin of admins) {
                            await sendPushNotification(admin.id, hrMessage, { title: hrTitle, url: `${window.location.origin}/requests` });
                        }
                    }
                } catch (hrError) {
                    console.error('Failed to notify HR:', hrError);
                }
            }
        } catch (err: any) {
            console.error('Error processing request:', err);
            setError(err.message || 'حدث خطأ أثناء معالجة الطلب');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl scale-100 overflow-hidden relative mt-10">

                {/* Modification Type Banner */}
                {request.modification_type === 'edited' && (
                    <div className="absolute top-0 left-0 right-0 bg-orange-500 text-white text-center py-2 font-bold text-sm shadow-sm z-10">
                        تم تعديل طلب الإجازة
                    </div>
                )}
                {request.modification_type === 'canceled' && (
                    <div className="absolute top-0 left-0 right-0 bg-red-400 text-white text-center py-2 font-bold text-sm shadow-sm z-10">
                        طلب إلغاء الإجازة
                    </div>
                )}
                {request.modification_type === 'cut' && (
                    <div className="absolute top-0 left-0 right-0 bg-green-500 text-white text-center py-2 font-bold text-sm shadow-sm z-10">
                        تم قطع الإجازة (تاريخ المباشرة: {request.cut_date})
                    </div>
                )}

                {/* Header */}
                <div className={`flex items-center gap-4 mb-6 border-b border-gray-100 dark:border-slate-700 pb-4 ${request.modification_type ? 'pt-8' : ''}`}>
                    <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border-2 border-white dark:border-slate-600 shadow-lg">
                        {request.profiles?.avatar_url ? (
                            <img src={request.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <User size={24} className="text-gray-500 dark:text-gray-300" />
                        )}
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{request.profiles?.full_name || 'مستخدم'}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {request.modification_type === 'canceled' ? 'طلب إلغاء إجازة' :
                                request.modification_type === 'cut' ? 'طلب قطع إجازة' :
                                    'طلب إجازة جديد'}
                        </p>
                    </div>
                    <button onClick={onClose} className="mr-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="space-y-4 mb-8">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30">
                            <p className="text-xs text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1">
                                <Calendar size={12} />
                                تاريخ البداية
                            </p>
                            <p className="font-bold text-gray-900 dark:text-white dir-ltr">{request.start_date}</p>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/10 p-3 rounded-xl border border-purple-100 dark:border-purple-900/30">
                            <p className="text-xs text-purple-600 dark:text-purple-400 mb-1 flex items-center gap-1">
                                <Calendar size={12} />
                                المدة
                            </p>
                            <p className="font-bold text-gray-900 dark:text-white">{request.days_count} يوم</p>
                        </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                            <FileText size={12} />
                            سبب الإجازة
                        </p>
                        <p className="text-gray-700 dark:text-gray-200 text-sm leading-relaxed">
                            {request.reason}
                        </p>
                    </div>

                    {/* Unpaid days note */}
                    {(request.unpaid_days ?? 0) > 0 && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl text-sm flex items-start gap-2 text-amber-800 dark:text-amber-300">
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <span>
                                <strong>ملاحظة:</strong> منها ({request.unpaid_days}) أيام كإجازة بدون راتب
                            </span>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={() => handleAction('rejected')}
                        disabled={isProcessing}
                        className="flex-1 py-3 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 font-bold rounded-xl transition flex items-center justify-center gap-2"
                    >
                        {isProcessing ? 'جاري المعالجة...' : (
                            <>
                                <X size={18} />
                                رفض الطلب
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => handleAction('approved')}
                        disabled={isProcessing}
                        className="flex-[2] py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition shadow-lg shadow-green-500/20 flex items-center justify-center gap-2"
                    >
                        {isProcessing ? 'جاري المعالجة...' : (
                            <>
                                <Check size={18} />
                                {request.modification_type === 'cut' ? 'نؤيد ذلك' : 'موافق'}
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
};
