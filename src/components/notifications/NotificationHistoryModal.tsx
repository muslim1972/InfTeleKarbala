import { useState, useEffect } from 'react';
import { X, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

export const NotificationHistoryModal = ({ onClose }: { onClose: () => void }) => {
    const { user } = useAuth();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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
                                        <div className="flex justify-end mt-1">
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
                                );
                            })
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
