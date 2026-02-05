import { useState, useEffect, useRef } from 'react';
import { History, X, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

interface HistoryLog {
    id: string;
    old_value: string | null;
    new_value: string | null;
    changed_by_name: string;
    changed_at: string;
}

interface HistoryViewerProps {
    tableName: string;
    recordId: string;
    fieldName: string;
    label?: string;
}

export const HistoryViewer = ({ tableName, recordId, fieldName, label }: HistoryViewerProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [logs, setLogs] = useState<HistoryLog[]>([]);
    const [loading, setLoading] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('field_change_logs')
                .select('*')
                .eq('table_name', tableName)
                .eq('record_id', recordId)
                .eq('field_name', fieldName)
                .order('changed_at', { ascending: false });

            if (error) throw error;
            setLogs(data || []);
        } catch (err) {
            console.error("Error fetching history:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpen = () => {
        setIsOpen(true);
        fetchHistory();
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="relative inline-block ml-2">
            <button
                type="button"
                onClick={handleOpen}
                className="text-white/20 hover:text-brand-yellow transition-colors p-1 rounded-full hover:bg-white/5 active:scale-95"
                title="سجل التعديلات"
            >
                <History size={14} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <motion.div
                            ref={modalRef}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
                            dir="rtl"
                        >
                            {/* Header */}
                            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                                <h3 className="text-white font-bold flex items-center gap-2">
                                    <History className="text-brand-yellow" size={18} />
                                    سجل تغييرات: <span className="text-brand-green">{label || fieldName}</span>
                                </h3>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="text-white/40 hover:text-white transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                {loading ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="w-8 h-8 animate-spin text-brand-yellow" />
                                    </div>
                                ) : logs.length > 0 ? (
                                    logs.map((log) => (
                                        <div key={log.id} className="bg-white/5 border border-white/5 rounded-lg p-3 text-sm relative group hover:border-white/10 transition-colors">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="bg-brand-blue/20 p-1.5 rounded-full">
                                                        <UserIcon size={12} className="text-brand-blue" />
                                                    </div>
                                                    <span className="text-white/80 font-medium">
                                                        {log.changed_by_name || 'مسؤول النظام'}
                                                    </span>
                                                </div>
                                                <span className="text-white/30 text-[10px] dir-ltr font-mono">
                                                    {new Date(log.changed_at).toLocaleString('en-GB')}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center bg-black/20 p-2 rounded border border-white/5">
                                                <div className="text-center">
                                                    <span className="block text-red-400/70 text-[10px] mb-1">القيمة القديمة</span>
                                                    <span className="text-red-100 font-mono text-xs line-through opacity-70 block break-words">
                                                        {log.old_value !== null ? log.old_value : <span className="italic opacity-50">فارغ</span>}
                                                    </span>
                                                </div>

                                                <ArrowLeft size={14} className="text-white/20" />

                                                <div className="text-center">
                                                    <span className="block text-brand-green/70 text-[10px] mb-1">القيمة الجديدة</span>
                                                    <span className="text-brand-green font-mono text-xs font-bold block break-words">
                                                        {log.new_value !== null ? log.new_value : <span className="italic opacity-50">فارغ</span>}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-10 text-white/30">
                                        <History size={32} className="mx-auto mb-2 opacity-50" />
                                        <p>لا توجد تعديلات مسجلة لهذا الحقل</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Mini user icon for the history items
const UserIcon = ({ size = 16, className = "" }: { size?: number, className?: string }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);
