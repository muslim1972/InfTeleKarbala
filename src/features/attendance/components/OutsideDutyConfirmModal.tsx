'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Fingerprint, X, AlertCircle } from 'lucide-react';

interface OutsideDutyConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  reason?: string;
  badgeText?: string;
}

export const OutsideDutyConfirmModal: React.FC<OutsideDutyConfirmModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  reason,
  badgeText,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
        {/* الخلفية المعتمة الهادئة */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        />

        {/* بطاقة الحوار */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden z-10 text-right space-y-5"
          dir="rtl"
        >
          {/* شريط الإغلاق السريع */}
          <button
            onClick={onCancel}
            className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="إلغاء وتراجع"
          >
            <X className="w-5 h-5" />
          </button>

          {/* الترويسة والأيقونة */}
          <div className="flex items-center gap-3.5 pt-1">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-sm">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                تنبيه أوقات الدوام الرسمي
              </h3>
              {badgeText && (
                <span className="inline-block text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/40">
                  {badgeText}
                </span>
              )}
            </div>
          </div>

          {/* نص التنبيه المهدئ مع السبب الإيضاحي */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-4 space-y-2">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
              أنت الآن لست ضمن أوقات الدوام الرسمي، هل تريد تثبيت البصمة على أية حال؟
            </p>
            {reason && (
              <div className="flex items-start gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span className="leading-snug">{reason}</span>
              </div>
            )}
          </div>

          {/* الأزرار التفاعلية */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {/* زر نعم — الاستمرار وتثبيت البصمة */}
            <button
              onClick={onConfirm}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-2xl font-bold text-sm shadow-md hover:shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 order-1 sm:order-2"
            >
              <Fingerprint className="w-5 h-5 shrink-0" />
              <span>نعم، متابعة وتثبيت</span>
            </button>

            {/* زر كلا — التراجع وإغلاق الكاميرا */}
            <button
              onClick={onCancel}
              className="w-full py-3.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-98 text-slate-700 dark:text-slate-200 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-1.5 order-2 sm:order-1"
            >
              <span>كلا، تراجع</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
