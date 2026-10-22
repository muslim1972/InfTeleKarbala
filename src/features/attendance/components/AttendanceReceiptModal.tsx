import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle2, ShieldCheck, Clock, MapPin, Loader2, Heart } from 'lucide-react';

interface AttendanceReceiptModalProps {
  isOpen: boolean;
  employeeName: string;
  punchTime: string;
  locationName: string;
  shiftName?: string;
  isUploading: boolean;
  onClose: () => void;
  autoCloseSeconds?: number;
}

export const AttendanceReceiptModal: React.FC<AttendanceReceiptModalProps> = ({
  isOpen,
  employeeName,
  punchTime,
  locationName,
  shiftName,
  isUploading,
  onClose,
  autoCloseSeconds = 10,
}) => {
  // استخدام progressMs بدقة 100ms لحركة انسيابية جداً للشريط والعداد
  const totalMs = autoCloseSeconds * 1000;
  const [msRemaining, setMsRemaining] = useState(totalMs);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) {
      setMsRemaining(totalMs);
      return;
    }

    setMsRemaining(totalMs);
    const stepMs = 100;
    const interval = window.setInterval(() => {
      setMsRemaining((prev) => {
        if (prev <= stepMs) {
          window.clearInterval(interval);
          onCloseRef.current();
          return 0;
        }
        return prev - stepMs;
      });
    }, stepMs);

    return () => window.clearInterval(interval);
  }, [isOpen, totalMs]);

  if (!isOpen) return null;

  // نسبة التقدم المتبقية من 100% إلى 0%
  const progressPercent = Math.max(0, Math.min(100, (msRemaining / totalMs) * 100));
  const secondsDisplay = Math.ceil(msRemaining / 1000);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden transform transition-all text-right font-tajawal">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-l from-emerald-600 via-teal-600 to-emerald-700 p-6 text-white text-center relative">
          <div className="w-16 h-16 mx-auto mb-3 bg-white/20 rounded-full flex items-center justify-center shadow-inner backdrop-blur-md">
            <CheckCircle2 className="w-10 h-10 text-white animate-bounce-short" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">تم التحقق وتثبيت الحضور</h2>
          <p className="text-emerald-100 text-xs mt-1 font-medium">مديرية اتصالات ومعلوماتية كربلاء المقدسة</p>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {/* Employee & Time Card */}
          <div className="bg-slate-50 dark:bg-gray-700/50 rounded-2xl p-4 border border-slate-100 dark:border-gray-600/50 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-600 pb-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">اسم الموظف</span>
              <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{employeeName}</span>
            </div>

            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-600 pb-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                وقت البصمة الرسمي
              </span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 dir-ltr font-mono">
                {punchTime}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-blue-500" />
                موقع العمل المثبت
              </span>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 max-w-[200px] truncate">
                {locationName || 'الموقع المعتمد'}
              </span>
            </div>

            {shiftName && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">نوع الوجبة / المناوبة</span>
                <span className="text-xs font-medium text-purple-600 dark:text-purple-400">{shiftName}</span>
              </div>
            )}
          </div>

          {/* Status & Lazy Queue Sync Indicator */}
          <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-xl p-3 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-3">
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-spin shrink-0" />
                <div className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
                  <span className="font-bold">جاري رفع وتوثيق اللقطة الحية...</span>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    يرجى عدم إغلاق النافذة حتى إتمام المزامنة بهدوء
                  </div>
                </div>
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed font-medium">
                  تم اعتماد القيد بالكامل وتأمين سجل الحضور.
                </div>
              </>
            )}
          </div>

          {/* شريط الإغلاق التنازلي التفاعلي المباشر */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 font-medium">
              <span>الإغلاق التلقائي</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {secondsDisplay} ثانية
              </span>
            </div>
            <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-l from-emerald-500 to-teal-500 rounded-full transition-all duration-100 ease-linear shadow-sm"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Thank You Note */}
          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 pt-1">
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            <span>شكراً لتعاونكم مع نظام الإدارة لضمان حقوقكم الوظيفية</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-all active:scale-95"
          >
            إغلاق ومتابعة
          </button>
        </div>
      </div>
    </div>
  );
};
