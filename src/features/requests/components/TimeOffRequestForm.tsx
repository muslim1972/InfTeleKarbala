/**
 * TimeOffRequestForm.tsx
 * Dedicated form for "إجازة زمنية" (time-off) requests.
 * Extracted from LeaveRequestForm to follow single-responsibility principle.
 *
 * Rules applied:
 *  - rerender-functional-setstate  : functional setState for stable callbacks
 *  - bundle-conditional            : heavy validators only run on submit
 *  - js-early-exit                 : guard clauses throughout
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, AlertCircle, CheckCircle, Network, UserCheck, Loader2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { sendPushNotification } from '../../../services/notifications';

// Duration options ── hoisted outside component (rendering-hoist-jsx)
const DURATION_OPTIONS = [
  { value: 30,  label: 'نصف ساعة' },
  { value: 60,  label: 'ساعة واحدة' },
  { value: 90,  label: 'ساعة ونصف' },
  { value: 120, label: 'ساعتان' },
] as const;

// ── Helper: compute return time string ─────────────────────────────────────────
function calcReturnTime(startTime: string, durationMinutes: number): string {
  if (!startTime) return '';
  const [h, m] = startTime.split(':').map(Number);
  const total = h * 60 + m + durationMinutes;
  const rh = Math.floor(total / 60) % 24;
  const rm = total % 60;
  return `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}`;
}

// ── Helper: is Friday or Saturday? ────────────────────────────────────────────
function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr).getDay(); // 5=Fri, 6=Sat
  return day === 5 || day === 6;
}

interface Props {
  onSuccess?: () => void;
}

interface ManagerInfo {
  id: string;
  name: string;
  names?: string[];
  isTopManagerSelf?: boolean;
}

const TimeOffRequestForm: React.FC<Props> = ({ onSuccess }) => {
  const { user } = useAuth();

  const todayStr = new Date().toISOString().split('T')[0];

  // ── Form state ──────────────────────────────────────────────────────────────
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  // reason field removed per request

  // ── Derived ─────────────────────────────────────────────────────────────────
  const returnTime = calcReturnTime(startTime, durationMinutes);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ── Manager / routing state ───────────────────────────────────────────────
  const [managerInfo, setManagerInfo] = useState<ManagerInfo | null>(null);
  const [supervisorId, setSupervisorId] = useState<string | null>(null);
  const [approvalChain, setApprovalChain] = useState<string[]>([]);
  const [loadingManager, setLoadingManager] = useState(true);

  // ── Fetch manager from hierarchy ──────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const fetchManager = async () => {
      try {
        setLoadingManager(true);
        const { data: profile } = await supabase
          .from('profiles')
          .select('department_id')
          .eq('id', user.id)
          .single();

        if (!profile?.department_id || cancelled) return;

        let currentDeptId: string | null = profile.department_id;
        const chain: string[] = [];
        const names: string[] = [];
        let isTopManagerSelf = false;
        const visited = new Set<string>();

        while (currentDeptId && !visited.has(currentDeptId)) {
          visited.add(currentDeptId);
          const { data: dept } = await supabase
            .rpc('get_departments_bypass_rls')
            .select('id, name, manager_id, parent_id, level')
            .eq('id', currentDeptId)
            .single();

          if (!dept || cancelled) break;

          if (dept.manager_id && dept.manager_id !== user.id) {
            if (!chain.includes(dept.manager_id)) {
              chain.push(dept.manager_id);
              names.push('مدير ' + dept.name);
            }
          } else if (dept.manager_id === user.id && !dept.parent_id) {
            isTopManagerSelf = true;
          }

          if (dept.level <= 3 && dept.manager_id !== user.id) break;
          currentDeptId = dept.parent_id;
        }

        if (cancelled) return;

        if (chain.length > 0) {
          setManagerInfo({ id: chain[0], name: names.join(' ⬅️ '), names, isTopManagerSelf: false });
          setSupervisorId(chain[0]);
          setApprovalChain(chain);
        } else if (isTopManagerSelf) {
          setManagerInfo({ id: user.id, name: 'نفسه (مسؤول أعلى)', isTopManagerSelf: true });
          setSupervisorId(user.id);
          setApprovalChain([user.id]);
        }
      } catch (e) {
        console.error('TimeOffRequestForm: fetchManager error', e);
      } finally {
        if (!cancelled) setLoadingManager(false);
      }
    };

    fetchManager();
    return () => { cancelled = true; };
  }, [user]);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = useCallback((): boolean => {
    if (!startTime) {
      setError('يرجى تحديد ساعة البداية (الخروج).');
      return false;
    }
    if (isWeekend(todayStr)) {
      setError('لا يمكن تقديم إجازة زمنية في أيام العطلة الرسمية (الجمعة والسبت).');
      return false;
    }
    if (!supervisorId) {
      setError('لم يتم تحديد مسؤولك المباشر في الهيكلية. راجع الإدارة.');
      return false;
    }
    setError(null);
    return true;
  }, [startTime, supervisorId, todayStr]);

  // ── Submit flow ───────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setShowConfirm(true);
  };

  const confirmSubmit = async () => {
    if (!user || !supervisorId) return;
    setIsSubmitting(true);
    setShowConfirm(false);

    try {
      const finalReason = `(ساعة الخروج: ${startTime} | المدة: ${durationMinutes} دقيقة | العودة: ${returnTime})`;

      const { data, error: rpcError } = await supabase.rpc('submit_typed_leave_request', {
        p_leave_type: 'time_off',
        p_start_date: todayStr,
        p_end_date: todayStr,
        p_days_count: 1,
        p_reason: finalReason,
        p_supervisor_id: supervisorId,
        p_approval_chain: approvalChain,
        p_time_duration_minutes: durationMinutes,
        p_destination: null,
        p_with_pay: true,
        p_supporting_image_urls: [],
      });

      if (rpcError) throw rpcError;

      const response = data as any;
      if (!response?.success) {
        setError(response?.message || 'تعذّر تقديم الطلب. حاول مرة أخرى.');
        return;
      }

      // Send push notification to supervisor
      try {
        const { data: supProfile } = await supabase
          .from('available_profiles')
          .select('push_token')
          .eq('id', supervisorId)
          .single();
        if (supProfile?.push_token) {
          await sendPushNotification(
            supProfile.push_token,
            'طلب إجازة زمنية جديد',
            `${user.full_name || 'موظف'} يطلب إجازة زمنية (${durationMinutes} دقيقة) من ${startTime}`
          );
        }
      } catch { /* push notification is non-critical */ }

      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ غير متوقع.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-lg font-bold text-green-800 dark:text-green-300 mb-2">تم إرسال الطلب بنجاح</h3>
        <p className="text-green-600 dark:text-green-400 mb-6 text-sm">
          تم إرسال طلب الإجازة الزمنية إلى مسؤولك المباشر. ستصلك الإجابة قريباً.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => { setSuccess(false); setStartTime(''); setDurationMinutes(60); }}
            className="bg-green-600 text-white px-6 py-2 rounded-xl hover:bg-green-700 transition shadow-lg shadow-green-500/20 text-sm font-bold"
          >
            تقديم طلب جديد
          </button>
          <button
            onClick={onSuccess}
            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 px-6 py-2 rounded-xl hover:bg-gray-50 transition text-sm font-bold"
          >
            العودة للقائمة
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Form card ────────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="space-y-5" dir="rtl">

        {/* Info banner */}
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl flex gap-3 items-start">
          <span className="text-2xl shrink-0">⏱️</span>
          <div>
            <p className="font-bold text-amber-800 dark:text-amber-300 text-sm mb-0.5">إجازة زمنية</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              من 30 دقيقة إلى ساعتين. تُحتسب تراكمياً وكل 7 ساعات تُخصم يوم إجازة من رصيدك.
            </p>
          </div>
        </div>

        {/* Routing info */}
        <div className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
          managerInfo
            ? 'bg-blue-50 dark:bg-slate-900/50 border-blue-100 dark:border-blue-900/50'
            : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30'
        }`}>
          <div className="flex-1">
            <span className={`block text-sm font-bold mb-2 ${managerInfo ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
              توجيه الطلب تلقائياً إلى:
            </span>
            {loadingManager ? (
              <span className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 size={14} className="animate-spin" /> جاري تحديد المسؤول...
              </span>
            ) : managerInfo ? (
              <div className="space-y-1.5">
                {(managerInfo.names ?? [managerInfo.name]).map((n, i) => (
                  <div key={i} className="text-gray-900 dark:text-gray-100 font-medium flex items-center gap-2 text-sm">
                    <UserCheck size={14} className="text-blue-500 shrink-0" />
                    <span>المستوى {i + 1}: {n}</span>
                  </div>
                ))}
                {managerInfo.isTopManagerSelf && (
                  <p className="text-xs text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 rounded-lg p-2 mt-1">
                    أنت المسؤول الأعلى — سيُعرض الطلب عليك لإبداء الرأي.
                  </p>
                )}
              </div>
            ) : (
              <span className="text-red-500 text-sm">⚠️ لم يُحدَّد قسم أو مسؤول مباشر لك. راجع الإدارة.</span>
            )}
          </div>
          <Network size={36} className={`shrink-0 ${managerInfo ? 'text-blue-200 dark:text-blue-800' : 'text-red-200 dark:text-red-800/50'}`} />
        </div>

        {/* Start time */}
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
            <Clock size={14} className="inline ml-1" />
            ساعة البداية (الخروج)
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => { setStartTime(e.target.value); setError(null); }}
            required
            className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition dir-ltr text-left text-base"
          />
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
            المدة الزمنية
          </label>
          <div className="grid grid-cols-4 gap-2">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDurationMinutes(opt.value)}
                className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                  durationMinutes === opt.value
                    ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/25'
                    : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:border-amber-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Expected return */}
        <div className="flex items-center justify-between bg-amber-50 dark:bg-slate-700/50 p-4 rounded-xl border border-amber-100 dark:border-slate-600">
          <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">ساعة العودة المتوقعة:</span>
          <span className="font-bold text-xl text-amber-700 dark:text-amber-300 dir-ltr">
            {returnTime || '—'}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting || loadingManager}
          className="w-full bg-gradient-to-l from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-amber-500/25 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-base"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" /> جاري الإرسال...</span>
          ) : 'إرسال الطلب للمسؤول'}
        </button>
      </form>

      {/* ── Confirm Modal ─────────────────────────────────────────────────────── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl p-6 pb-8 w-full max-w-sm shadow-2xl mb-16 sm:mb-0">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">تأكيد إرسال الطلب</h3>
            <div className="space-y-2 text-sm mb-5">
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>نوع الطلب</span>
                <span className="font-bold text-amber-600">إجازة زمنية</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>ساعة الخروج</span>
                <span className="font-bold dir-ltr">{startTime}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>المدة</span>
                <span className="font-bold">{DURATION_OPTIONS.find(o => o.value === durationMinutes)?.label}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>العودة المتوقعة</span>
                <span className="font-bold dir-ltr">{returnTime}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-200 font-bold text-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition"
              >
                تعديل
              </button>
              <button
                onClick={confirmSubmit}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md shadow-amber-500/25 transition"
              >
                تأكيد الإرسال
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TimeOffRequestForm;
