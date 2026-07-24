import { useState } from 'react';
import { User, Check, X, Calendar, FileText, AlertCircle, CheckCircle, Trash2, Loader2, AlertTriangle } from 'lucide-react';
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
    prev_manager_name?: string;
    approval_chain?: string[];
    current_approval_step?: number;
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
    const [isOrphanedError, setIsOrphanedError] = useState(false);
    const [isDeletingOrphan, setIsDeletingOrphan] = useState(false);

    const handleAction = async (status: 'approved' | 'rejected') => {
        setIsProcessing(true);
        setError(null);
        setIsOrphanedError(false);

        let updatePayload: any = {}; 
        let rpcResult: any = null;

        try {
            if (request.modification_type === 'canceled') {
                if (status === 'approved') {
                    // Multi-level cancellation escalation
                    const currentStep = request.current_approval_step ?? 1;
                    if (request.approval_chain && Array.isArray(request.approval_chain) && currentStep < request.approval_chain.length) {
                        const nextStep = currentStep + 1;
                        const nextManagerId = request.approval_chain[currentStep]; // 0-based index means currentStep points to the NEXT manager
                        updatePayload.current_approval_step = nextStep;
                        updatePayload.supervisor_id = nextManagerId;
                        rpcResult = { status: 'escalated', next_supervisor: nextManagerId };
                    } else {
                        // Fully approved by all managers, goes to HR
                        updatePayload.cancellation_status = 'approved';
                        updatePayload.is_read_by_employee = false;
                        updatePayload.status = 'canceled';
                    }
                } else {
                    updatePayload.cancellation_status = 'rejected';
                    updatePayload.modification_type = null;
                    updatePayload.is_read_by_employee = false;
                }
            } else if (request.modification_type === 'cut') {
                updatePayload.cut_status = status;
                if (status === 'approved') {
                    updatePayload.hr_cut_status = 'pending';
                    // We DO NOT set is_read_by_employee to false here, because we want the notification
                    // to only go to the employee AFTER HR processes the cut.
                } else {
                    // If the supervisor rejects the cut, we SHOULD notify the employee now!
                    updatePayload.modification_type = null;
                    updatePayload.is_read_by_employee = false;
                }
            } else {
                // Normally (new, or edited) - Use the new Multi-Level Approval RPC
                const { data: rpcData, error: rpcErr } = await supabase.rpc('process_leave_approval', {
                    p_request_id: request.id,
                    p_action: status
                });
                if (rpcErr) throw rpcErr;
                if (rpcData && !rpcData.success) throw new Error(rpcData.message);
                
                rpcResult = rpcData;
                // If it escalated to the next manager, we don't need to do the regular status update
                // because the RPC already handled it. But we skip the direct update below for normal leaves.
                updatePayload = null; 
            }

            if (updatePayload && Object.keys(updatePayload).length > 0) {
                const { data, error: updateError } = await supabase
                    .from('leave_requests')
                    .update(updatePayload)
                    .eq('id', request.id)
                    .select();

                if (updateError) throw updateError;
                if (!data || data.length === 0) {
                    throw new Error("لم يتم التحديث في قاعدة البيانات. قد يكون بسبب نقص في صلاحياتك (RLS) أو أن الطلب تمت معالجته بالفعل.");
                }
            }

            onProcessed();
            onClose();

            // Send Push Notification logic
            if (rpcResult && rpcResult.status === 'escalated') {
                // 1. Request escalated to next supervisor, notify the next supervisor!
                if (rpcResult.next_supervisor) {
                    sendPushNotification(rpcResult.next_supervisor, `لديك طلب إجازة جديد يتطلب موافقتك (${request.start_date})`, { title: "طلب إجازة معلق", url: `${window.location.origin}/requests` });
                }
            } else {
                // 2. Request fully processed (approved or rejected), notify the employee
                const statusText = status === 'approved' ? 'موافق عليه' : 'مرفوض';
                let message = `تم ${statusText} لطلب إجازتك (${request.start_date})`;

                if (request.modification_type === 'canceled') {
                    message = `تم ${statusText} لطلب إلغاء إجازتك (${request.start_date})`;
                } else if (request.modification_type === 'cut') {
                    message = `تم ${statusText} لطلب قطع إجازتك (${request.start_date})`;
                }
                sendPushNotification(request.user_id, message, { title: "تحديث طلب الإجازة", url: `${window.location.origin}/requests` });
            }

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
            
            // Smart error handling for network issues
            if (err.message === 'Failed to fetch' || err.message?.includes('Failed to fetch') || err.message?.includes('Network Error')) {
                setError('حدث خطأ في الاتصال بالخادم. يرجى التحقق من جودة الاتصال بالإنترنت والمحاولة مرة أخرى.');
            } else {
                const errorMsg = err.message || 'حدث خطأ أثناء معالجة الطلب';
                setError(errorMsg);
                if (errorMsg.includes('سجل مالي') || errorMsg.includes('صلاحياتك') || errorMsg.includes('RLS')) {
                    setIsOrphanedError(true);
                }
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handleForceRemove = async () => {
        setIsDeletingOrphan(true);
        setError(null);
        try {
            const { data, error: rpcErr } = await supabase.rpc('cleanup_orphaned_leave_request', {
                p_request_id: request.id
            });

            if (rpcErr) throw rpcErr;
            if (data && !data.success) throw new Error(data.message);

            onProcessed();
            onClose();
        } catch (err: any) {
            setError(err.message || 'حدث خطأ أثناء حذف الطلب المعلق');
            setIsOrphanedError(false); // Fallback to normal error display
        } finally {
            setIsDeletingOrphan(false);
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

                {request.prev_manager_name && (
                    <div className={`mx-4 mt-12 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-3 flex items-center gap-2 text-emerald-800 dark:text-emerald-300`}>
                        <CheckCircle size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <p className="text-sm font-bold">حاصل على موافقة ({request.prev_manager_name})</p>
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

                    {request.modification_type === 'cut' && (() => {
                        let actual = 0;
                        let returned = 0;
                        if (request.cut_date && request.start_date) {
                            const start = new Date(request.start_date);
                            const cut = new Date(request.cut_date);
                            actual = Math.ceil((cut.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                            if (actual < 0) actual = 0;
                            if (actual > request.days_count) actual = request.days_count;
                            returned = request.days_count - actual;
                        }
                        
                        // Extract time from updated_at for submission time
                        const submitDate = new Date((request as any).updated_at || (request as any).created_at);
                        const timeString = submitDate.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
                        const dateString = submitDate.toLocaleDateString('en-GB');

                        return (
                            <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-200 dark:border-amber-900/30 mt-4 space-y-3">
                                <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400 border-b border-amber-200 dark:border-amber-900/50 pb-2">تفاصيل طلب القطع</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-xs text-amber-600 dark:text-amber-500 mb-1">وقت التقديم</p>
                                        <p className="font-bold text-amber-900 dark:text-amber-200">{dateString} {timeString}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-amber-600 dark:text-amber-500 mb-1">تاريخ المباشرة</p>
                                        <p className="font-bold text-amber-900 dark:text-amber-200">{request.cut_date}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-amber-600 dark:text-amber-500 mb-1">الأيام الفعلية</p>
                                        <p className="font-bold text-amber-900 dark:text-amber-200">{actual} يوم</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-amber-600 dark:text-amber-500 mb-1">المتبقي للإرجاع</p>
                                        <p className="font-bold text-amber-900 dark:text-amber-200">{returned} يوم</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Unpaid days note */}
                    {(request.unpaid_days ?? 0) > 0 && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl text-sm flex items-start gap-2 text-amber-800 dark:text-amber-300">
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <span>
                                <strong>ملاحظة:</strong> منها ({request.unpaid_days}) أيام كإجازة بدون راتب
                            </span>
                        </div>
                    )}

                    {error && !isOrphanedError && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    {isOrphanedError && (
                        <div className="mt-4 p-4 border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 rounded-xl animate-in slide-in-from-bottom-4 fade-in duration-300">
                            <h4 className="text-red-800 dark:text-red-400 font-bold flex items-center gap-2 mb-2">
                                <AlertTriangle size={18} />
                                معالجة الطلبات المعلقة (حالة استثنائية)
                            </h4>
                            <p className="text-sm text-red-700 dark:text-red-300 mb-4 leading-relaxed">
                                النظام اكتشف أن هذا الموظف لم يعد ضمن الهيكلية الإدارية التابعة لك (أو تم نقله لقسم آخر). 
                                يمكنك إزالة هذا الطلب نهائياً لتنظيف صندوق الإشعارات الخاص بك.
                            </p>
                            <button 
                                onClick={handleForceRemove} 
                                disabled={isDeletingOrphan}
                                className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-bold flex items-center justify-center gap-2 w-full shadow-lg shadow-red-500/20 disabled:opacity-70"
                            >
                                {isDeletingOrphan ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                                {isDeletingOrphan ? 'جاري الحذف...' : 'حذف الطلب نهائياً من صندوقي'}
                            </button>
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
