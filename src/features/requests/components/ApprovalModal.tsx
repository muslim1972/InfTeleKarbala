import { useState } from 'react';
import { User, Check, X, Calendar, FileText, AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface LeaveRequest {
    id: string;
    user_id: string;
    start_date: string;
    end_date: string;
    days_count: number;
    reason: string;
    status: string;
    created_at: string;
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
            const { error: updateError } = await supabase
                .from('leave_requests')
                .update({ status: status })
                .eq('id', request.id);

            if (updateError) throw updateError;

            onProcessed();
            onClose();
        } catch (err: any) {
            console.error('Error processing request:', err);
            setError(err.message || 'حدث خطأ أثناء معالجة الطلب');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl scale-100 overflow-hidden relative">

                {/* Header */}
                <div className="flex items-center gap-4 mb-6 border-b border-gray-100 dark:border-slate-700 pb-4">
                    <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border-2 border-white dark:border-slate-600 shadow-lg">
                        {request.profiles?.avatar_url ? (
                            <img src={request.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <User size={24} className="text-gray-500 dark:text-gray-300" />
                        )}
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{request.profiles?.full_name || 'مستخدم'}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">طلب إجازة جديد</p>
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
                                موافق
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
};
