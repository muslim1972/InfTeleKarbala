import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X, Check, User } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';

interface DirectivesModalProps {
    type: 'directive' | 'conference';
    content: string;
    isOpen: boolean;
    onClose: () => void;
    onAcknowledge?: () => Promise<void>;
}

import { createPortal } from 'react-dom';

// ... (props interface)

export function DirectivesModal({ type, content, isOpen, onClose, onAcknowledge }: DirectivesModalProps) {
    const [acknowledging, setAcknowledging] = useState(false);

    const handleAcknowledge = async () => {
        if (!onAcknowledge) return;
        setAcknowledging(true);
        try {
            await onAcknowledge();
            onClose();
        } finally {
            setAcknowledging(false);
        }
    };

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-auto">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={cn(
                            "fixed inset-0 bg-black/80 backdrop-blur-sm",
                            type === 'directive' ? "cursor-not-allowed" : "cursor-default"
                        )}
                        onClick={type === 'conference' ? onClose : undefined}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className={cn(
                            "relative w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden m-4 z-10",
                            type === 'directive'
                                ? "bg-slate-900 border-red-500/50 shadow-red-500/20"
                                : "bg-slate-900 border-green-500/50 shadow-green-500/20"
                        )}
                    >
                        {/* Header */}
                        <div className={cn(
                            "p-4 flex items-center justify-between border-b",
                            type === 'directive'
                                ? "bg-red-500/10 border-red-500/20"
                                : "bg-green-500/10 border-green-500/20"
                        )}>
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "p-2 rounded-full",
                                    type === 'directive' ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"
                                )}>
                                    {type === 'directive' ? <AlertCircle size={24} /> : <User size={24} />}
                                </div>
                                <h3 className={cn(
                                    "font-bold text-lg",
                                    type === 'directive' ? "text-red-100" : "text-green-100"
                                )}>
                                    {type === 'directive' ? 'توجيهات هامة' : 'مؤتمرات'}
                                </h3>
                            </div>

                            {/* Close button only for conferences */}
                            {type === 'conference' && (
                                <button
                                    onClick={onClose}
                                    className="p-1 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            )}
                        </div>

                        {/* Content */}
                        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <p className="text-white/90 text-lg leading-relaxed whitespace-pre-line text-right" dir="rtl">
                                {content}
                            </p>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-white/5 bg-black/20 flex justify-end">
                            {type === 'directive' ? (
                                <button
                                    onClick={handleAcknowledge}
                                    disabled={acknowledging}
                                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center sm:w-auto"
                                >
                                    {acknowledging ? (
                                        <span className="animate-pulse">جارِ التأكيد...</span>
                                    ) : (
                                        <>
                                            <Check size={20} />
                                            <span>تبلغت</span>
                                        </>
                                    )}
                                </button>
                            ) : (
                                <button
                                    onClick={onClose}
                                    className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                                >
                                    إغلاق
                                </button>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
