/**
 * RequestsTabContent.tsx
 * Main shell for the "الطلبات" tab in the employee dashboard.
 *
 * Layout:
 *  ┌────────────────────────────────────────────────────────┐
 *  │  [نوع الطلب يظهر هنا]    [▾ حدد نوع الطلب]           │
 *  ├────────────────────────────────────────────────────────┤
 *  │  (selected form renders here, below the selector)      │
 *  └────────────────────────────────────────────────────────┘
 *
 * Rules applied (vercel-react-best-practices):
 *  - bundle-dynamic-imports   : heavy forms loaded lazily
 *  - bundle-conditional       : form only loaded after user selects a type
 *  - rendering-hoist-jsx      : static dropdown items extracted
 *  - rerender-derived-state   : `selectedOption` derived from `selectedId`
 */

import { useState, useRef, useEffect, lazy, Suspense, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, CheckCircle2, Loader2 } from 'lucide-react';
import { REQUEST_TYPE_OPTIONS } from './requestTypes';

// ── Lazy-loaded forms (bundle-dynamic-imports) ────────────────────────────────
const TimeOffRequestForm  = lazy(() => import('./TimeOffRequestForm'));
const LeaveRequestForm    = lazy(() => import('./LeaveRequestForm'));
const DutyRequestForm     = lazy(() => import('./DutyRequestForm'));

// ── Placeholder for not-yet-built administrative forms ────────────────────────
const ComingSoonForm = ({ label }: { label: string }) => (
  <div className="text-center py-12 text-gray-400 dark:text-gray-600 animate-in fade-in duration-300">
    <div className="text-5xl mb-4">🚧</div>
    <p className="font-bold text-base text-gray-600 dark:text-gray-300 mb-1">{label}</p>
    <p className="text-sm">هذا النموذج قيد التطوير — سيكون متاحاً قريباً</p>
  </div>
);

// ── Fallback loader shown while lazy chunk is loading ────────────────────────
const FormLoader = () => (
  <div className="flex justify-center items-center py-16">
    <Loader2 size={28} className="animate-spin text-blue-500" />
  </div>
);

// ── Render the appropriate form based on selected type ────────────────────────
function SelectedForm({ typeId, leaveType, label, onSuccess }: {
  typeId: string;
  leaveType?: string;
  label: string;
  onSuccess: () => void;
}) {
  if (typeId === 'time_off') {
    return <TimeOffRequestForm key={typeId} onSuccess={onSuccess} />;
  }

  if (typeId === 'duty') {
    return <DutyRequestForm key={typeId} onSuccess={onSuccess} />;
  }

  if (leaveType) {
    // All other leave-based types use the existing LeaveRequestForm
    return <LeaveRequestForm key={typeId} initialLeaveType={leaveType as any} onSuccess={onSuccess} />;
  }

  // Administrative requests (not yet implemented)
  return <ComingSoonForm label={label} />;
}

// ── Main component ────────────────────────────────────────────────────────────
export const RequestsTabContent = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Derived state — no extra useState (rerender-derived-state)
  const selectedOption = REQUEST_TYPE_OPTIONS.find(o => o.id === selectedId) ?? null;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setIsDropdownOpen(false);
  }, []);

  const handleSuccess = useCallback(() => {
    setSelectedId(null);
  }, []);

  return (
    <div className="w-full space-y-4" dir="rtl">

      {/* ── Selector row ──────────────────────────────────────────────────────── */}
      <div className="relative flex items-stretch gap-3" ref={dropdownRef}>

        {/* Left half — selected type display */}
        <div className="flex-1 min-h-[52px] flex items-center px-4 py-2 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 overflow-hidden">
          {selectedOption ? (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-300">
              <span className="text-xl">{selectedOption.emoji}</span>
              <span className="font-bold text-gray-800 dark:text-white text-sm leading-tight">
                {selectedOption.label}
              </span>
            </div>
          ) : (
            <span className="text-sm text-gray-400 dark:text-gray-500">نوع الطلب يظهر هنا</span>
          )}
        </div>

        {/* Right half — dropdown trigger */}
        <div className="flex-1">
          <button
            onClick={() => setIsDropdownOpen(prev => !prev)}
            className="w-full h-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-gradient-to-l from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-lg shadow-blue-500/25 transition-all duration-200 active:scale-95"
          >
            <span className="text-sm">حدد نوع الطلب</span>
            <motion.div
              animate={{ rotate: isDropdownOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown size={18} />
            </motion.div>
          </button>

          {/* Dropdown */}
          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                className="absolute top-[calc(100%+6px)] left-0 right-0 z-50 w-full bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden"
              >
                {/* Leave group header */}
                <div className="px-4 py-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                  طلبات الإجازات
                </div>

                {REQUEST_TYPE_OPTIONS.filter(o => o.category === 'leave').map((opt, idx, arr) => (
                  <button
                    key={opt.id}
                    onClick={() => handleSelect(opt.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-right transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/60 ${idx < arr.length - 1 ? 'border-b border-gray-50 dark:border-slate-700/40' : ''}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base ${opt.bgColor}`}>
                      {opt.emoji}
                    </div>
                    <div className="flex-1 text-right min-w-0">
                      <div className="font-bold text-gray-800 dark:text-white text-sm">{opt.label}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{opt.description}</div>
                    </div>
                    {selectedId === opt.id && (
                      <CheckCircle2 size={16} className="text-blue-500 shrink-0" />
                    )}
                  </button>
                ))}

                {/* Administrative group header */}
                <div className="px-4 py-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-t border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                  الطلبات الإدارية
                </div>

                {REQUEST_TYPE_OPTIONS.filter(o => o.category === 'administrative').map((opt, idx, arr) => (
                  <button
                    key={opt.id}
                    onClick={() => handleSelect(opt.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-right transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/60 ${idx < arr.length - 1 ? 'border-b border-gray-50 dark:border-slate-700/40' : ''}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base ${opt.bgColor}`}>
                      {opt.emoji}
                    </div>
                    <div className="flex-1 text-right min-w-0">
                      <div className="font-bold text-gray-800 dark:text-white text-sm">{opt.label}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{opt.description}</div>
                    </div>
                    {selectedId === opt.id && (
                      <CheckCircle2 size={16} className="text-blue-500 shrink-0" />
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Form area (renders below selector, no page change) ──────────────── */}
      <AnimatePresence mode="wait">
        {selectedOption ? (
          <motion.div
            key={selectedId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <Suspense fallback={<FormLoader />}>
              <SelectedForm
                typeId={selectedOption.id}
                leaveType={selectedOption.leaveType}
                label={selectedOption.label}
                onSuccess={handleSuccess}
              />
            </Suspense>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-16 text-gray-400 dark:text-gray-600"
          >
            <div className="text-5xl mb-3">📋</div>
            <p className="font-medium text-sm">اختر نوع الطلب من القائمة أعلاه لبدء التقديم</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
