import { useState, useEffect } from 'react';
import { X, CheckCircle, Clock, AlertCircle, Printer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { printContinuityLetterDirect } from '../../features/hr/utils/printContinuityDirect';
import { toast } from 'react-hot-toast';

export const NotificationHistoryModal = ({ onClose }: { onClose: () => void }) => {
    const { user } = useAuth();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [reprintingId, setReprintingId] = useState<string | null>(null);

    const handleReprintContinuity = async (notif: any) => {
        const requestId = notif.metadata?.request_id;
        if (!requestId) {
            toast.error('معرف الطلب غير متوفر في بيانات هذا الإشعار');
            return;
        }
        setReprintingId(notif.id);
        try {
            // جلب البيانات عبر الدالة الذرية المخصصة
            const { data: rpcRes, error: rpcErr } = await supabase.rpc('get_service_continuity_request_for_print', {
                p_request_id: requestId
            });

            let reqData: any = null;
            if (!rpcErr && rpcRes && (rpcRes as any).success && (rpcRes as any).request) {
                reqData = (rpcRes as any).request;
            } else {
                // الاستعلام الاحتياطي المباشر
                const { data, error } = await supabase
                    .from('service_continuity_requests')
                    .select(`
                        *,
                        employee:profiles!service_continuity_requests_user_id_fkey(
                            full_name,
                            job_number,
                            dept_text,
                            section_text,
                            gender
                        ),
                        supervisor:profiles!service_continuity_requests_supervisor_id_fkey(
                            full_name
                        )
                    `)
                    .eq('id', requestId)
                    .single();

                if (error || !data) {
                    const { data: rawReq, error: rawErr } = await supabase
                        .from('service_continuity_requests')
                        .select('*')
                        .eq('id', requestId)
                        .single();
                    if (rawErr || !rawReq) throw rawErr || new Error('تعذر العثور على سجل الطلب');

                    const { data: empProf } = await supabase
                        .from('profiles')
                        .select('id, full_name, job_number, dept_text, section_text, gender')
                        .eq('id', rawReq.user_id)
                        .maybeSingle();

                    reqData = {
                        ...rawReq,
                        employee: empProf || null
                    };
                } else {
                    reqData = data;
                }
            }

            if (!reqData) {
                throw new Error('تعذر تحميل بيانات كتاب الاستمرارية للطباعة');
            }

            const printed = await printContinuityLetterDirect(reqData);
            if (printed) {
                toast.success('تم فتح أمر طباعة / حفظ الكتاب بالصيغة المحدثة بنجاح');
            }
        } catch (err: any) {
            console.error('Error reprinting continuity letter:', err);
            toast.error(err?.message || 'حدث خطأ أثناء إعادة طباعة الكتاب');
        } finally {
            setReprintingId(null);
        }
    };

    useEffect(() => {
        const fetchHistory = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('system_notifications')
                    .select('*')
                    .eq('recipient_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(50);
                
                if (error) throw error;
                setHistory(data || []);
            } catch (err) {
                console.error('Error fetching notification history:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [user]);

    const getTypeLabel = (type: string) => {
        if (type?.startsWith('attendance_') || type === 'biometric_alert') {
            return { label: 'إشعار بصمة', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400' };
        }
        switch (type) {
            case 'leave_request': return { label: 'طلب قيد المراجعة', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400' };
            case 'leave_fyi': return { label: 'للعلم فقط', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400' };
            case 'leave_response': return { label: 'رد على طلبك', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400' };
            case 'leave_hr': return { label: 'طلب توثيق (HR)', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400' };
            default: return { label: 'تنبيه نظام', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400' };
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                >
                    <div className="bg-slate-800 dark:bg-slate-900 p-4 text-white flex justify-between items-center shrink-0 border-b border-slate-700">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <Clock size={20} />
                            مخزن وسجل الإشعارات
                        </h3>
                        <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-xl transition">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-4 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-900 custom-scrollbar space-y-3">
                        {loading ? (
                            <div className="flex justify-center p-8">
                                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : history.length === 0 ? (
                            <div className="text-center p-8 text-slate-500">لا يوجد سجل إشعارات</div>
                        ) : (
                            history.map(notif => {
                                const typeInfo = getTypeLabel(notif.type);
                                return (
                                    <div key={notif.id} className={`p-4 rounded-xl border ${notif.is_read ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-80' : 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800'} flex flex-col gap-2`}>
                                        <div className="flex justify-between items-start">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${typeInfo.color}`}>
                                                {typeInfo.label}
                                            </span>
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                                {new Date(notif.created_at).toLocaleString('ar-IQ')}
                                            </span>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{notif.title}</h4>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{notif.content}</p>
                                        </div>
                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                                            <div className="flex items-center gap-2">
                                                {(notif.type === 'service_continuity_print' || (notif.metadata?.request_id && (notif.title?.includes('استمرارية') || notif.content?.includes('استمرارية')))) && (
                                                    <button
                                                        type="button"
                                                        disabled={reprintingId === notif.id}
                                                        onClick={() => handleReprintContinuity(notif)}
                                                        className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-60 cursor-pointer"
                                                        title="إعادة طباعة الكتاب الرسمي بالصيغة المحدثة"
                                                    >
                                                        <Printer size={13} className={reprintingId === notif.id ? 'animate-spin' : ''} />
                                                        <span>{reprintingId === notif.id ? 'جارٍ السحب...' : 'إعادة طباعة'}</span>
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex justify-end">
                                                {notif.is_read ? (
                                                    <span className="text-[10px] flex items-center gap-1 text-slate-400">
                                                        <CheckCircle size={12} />
                                                        تمت القراءة / المعالجة
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] flex items-center gap-1 text-amber-500">
                                                        <AlertCircle size={12} />
                                                        غير مقروء / بانتظار الإجراء
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
