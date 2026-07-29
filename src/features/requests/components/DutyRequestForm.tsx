import React, { useState, useEffect, useCallback } from 'react';
import { Clock, AlertCircle, CheckCircle, Network, UserCheck, Loader2, MapPin, FileText } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { sendPushNotification } from '../../../services/notifications';
import { DateInput } from '../../../components/ui/DateInput';

interface Props {
  onSuccess?: () => void;
}

interface ManagerInfo {
  id: string;
  name: string;
  names?: string[];
  isTopManagerSelf?: boolean;
}

const DutyRequestForm: React.FC<Props> = ({ onSuccess }) => {
  const { user } = useAuth();

  const { todayStr, tomorrowStr } = React.useMemo(() => {
    const today = new Date();
    const tStr = today.toISOString().split('T')[0];
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tmrStr = tomorrow.toISOString().split('T')[0];
    return { todayStr: tStr, tomorrowStr: tmrStr };
  }, []);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [dutyExecutionDate, setDutyExecutionDate] = useState<string>(todayStr);
  const [dutyType, setDutyType] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [departureTime, setDepartureTime] = useState<string>('');

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
              names.push(dept.name);
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
        console.error('DutyRequestForm: fetchManager error', e);
      } finally {
        if (!cancelled) setLoadingManager(false);
      }
    };

    fetchManager();
    return () => { cancelled = true; };
  }, [user?.id]);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = useCallback((): boolean => {
    if (dutyExecutionDate !== todayStr && dutyExecutionDate !== tomorrowStr) {
      setError('تاريخ التنفيذ يجب أن يكون اليوم أو غداً فقط.');
      return false;
    }
    if (!dutyType.trim()) {
      setError('يرجى إدخال نوع الواجب.');
      return false;
    }
    if (!destination.trim()) {
      setError('يرجى إدخال موقع الواجب.');
      return false;
    }
    if (!departureTime) {
      setError('يرجى تحديد وقت المغادرة.');
      return false;
    }

    const [h, m] = departureTime.split(':').map(Number);
    const timeInMinutes = h * 60 + m;
    const maxTime = 14 * 60; // 14:00

    if (timeInMinutes > maxTime) {
      setError('وقت المغادرة يجب أن لا يتجاوز الساعة 14:00 (الثانية ظهراً).');
      return false;
    }

    if (dutyExecutionDate === todayStr) {
      const now = new Date();
      const currentInMinutes = now.getHours() * 60 + now.getMinutes();
      if (timeInMinutes < currentInMinutes) {
        setError('وقت المغادرة لا يمكن أن يكون بالماضي.');
        return false;
      }
    }

    if (!supervisorId) {
      setError('لم يتم تحديد مسؤولك المباشر في الهيكلية. راجع الإدارة.');
      return false;
    }

    setError(null);
    return true;
  }, [dutyExecutionDate, dutyType, destination, departureTime, todayStr, tomorrowStr, supervisorId]);

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
      const finalReason = `(نوع الواجب: ${dutyType.trim()} | وقت المغادرة: ${departureTime} | تاريخ التنفيذ: ${dutyExecutionDate})`;

      const { data, error: rpcError } = await supabase.rpc('submit_typed_leave_request', {
        p_leave_type: 'duty',
        p_start_date: dutyExecutionDate,
        p_end_date: dutyExecutionDate,
        p_days_count: 1,
        p_reason: finalReason,
        p_supervisor_id: supervisorId,
        p_approval_chain: approvalChain,
        p_time_duration_minutes: null,
        p_destination: destination.trim(),
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
            'طلب واجب جديد',
            `${user.full_name || 'موظف'} يطلب الخروج بواجب (${destination})`
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
      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-purple-100 dark:bg-purple-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-purple-600 dark:text-purple-400" />
        </div>
        <h3 className="text-lg font-bold text-purple-800 dark:text-purple-300 mb-2">تم إرسال الطلب بنجاح</h3>
        <p className="text-purple-600 dark:text-purple-400 mb-6 text-sm">
          تم إرسال طلب الواجب إلى مسؤولك المباشر. ستصلك الإجابة قريباً.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => {
              setSuccess(false);
              setDutyExecutionDate(todayStr);
              setDutyType('');
              setDestination('');
              setDepartureTime('');
            }}
            className="bg-purple-600 text-white px-6 py-2 rounded-xl hover:bg-purple-700 transition shadow-lg shadow-purple-500/20 text-sm font-bold"
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
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden" dir="rtl">
      {/* ── Form Header ──────────────────────────────────────────────────────── */}
      <div className="w-full flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
            <FileText size={20} />
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white leading-tight">
              نموذج واجب
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              تقديم طلب واجب جديد
            </p>
          </div>
        </div>
      </div>

      {/* ── Form content ─────────────────────────────────────────────────────── */}
      <div className="p-5">
        <form onSubmit={handleSubmit} className="space-y-5">

        {/* Info banner */}
        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/40 rounded-xl flex gap-3 items-start">
          <span className="text-2xl shrink-0">🛡️</span>
          <div>
            <p className="font-bold text-purple-800 dark:text-purple-300 text-sm mb-0.5">طلب واجب</p>
            <p className="text-xs text-purple-700 dark:text-purple-400 leading-relaxed">
              يُستخدم لتسجيل خروجك بمهام رسمية. لا يتم خصمه من رصيد الإجازات.
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

        {/* Duty paper number & date (Disabled) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              رقم ورقة الواجب
            </label>
            <input
              type="text"
              value="يُحدد لاحقاً"
              disabled
              className="w-full px-4 py-3 bg-gray-100 dark:bg-slate-800/50 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl text-gray-500 dark:text-gray-400 cursor-not-allowed text-center text-sm font-medium"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              تاريخ ورقة الواجب
            </label>
            <input
              type="text"
              value="يُحدد لاحقاً"
              disabled
              className="w-full px-4 py-3 bg-gray-100 dark:bg-slate-800/50 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl text-gray-500 dark:text-gray-400 cursor-not-allowed text-center text-sm font-medium"
            />
          </div>
        </div>

        {/* Execution Date */}
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
            تاريخ تنفيذ الواجب
          </label>
          <DateInput
            value={dutyExecutionDate}
            onChange={(val) => { setDutyExecutionDate(val); setError(null); }}
            min={todayStr}
            required
            className="w-full"
          />
          <p className="text-xs text-gray-500 mt-1">يجب أن يكون اليوم أو غداً فقط.</p>
        </div>

        {/* Duty Type */}
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
            <FileText size={14} className="inline ml-1" />
            نوع الواجب
          </label>
          <input
            type="text"
            value={dutyType}
            onChange={(e) => { setDutyType(e.target.value); setError(null); }}
            required
            placeholder="مثال: مراجعة دائرة البريد، اجتماع..."
            className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition text-base"
          />
        </div>

        {/* Destination */}
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
            <MapPin size={14} className="inline ml-1" />
            موقع الواجب
          </label>
          <input
            type="text"
            value={destination}
            onChange={(e) => { setDestination(e.target.value); setError(null); }}
            required
            placeholder="اسم الدائرة أو المكان المقصود"
            className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition text-base"
          />
        </div>

        {/* Departure Time */}
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
            <Clock size={14} className="inline ml-1" />
            وقت المغادرة
          </label>
          <input
            type="time"
            value={departureTime}
            onChange={(e) => { setDepartureTime(e.target.value); setError(null); }}
            required
            className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition dir-ltr text-left text-base"
          />
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
          className="w-full bg-gradient-to-l from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-purple-500/25 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-base"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" /> جاري الإرسال...</span>
          ) : 'إرسال الطلب للمسؤول'}
        </button>
      </form>
      </div>

      {/* ── Confirm Modal ─────────────────────────────────────────────────────── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl p-6 pb-8 w-full max-w-sm shadow-2xl mb-16 sm:mb-0">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">تأكيد إرسال الطلب</h3>
            <div className="space-y-2 text-sm mb-5">
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>نوع الطلب</span>
                <span className="font-bold text-purple-600">طلب واجب</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>تاريخ التنفيذ</span>
                <span className="font-bold">{dutyExecutionDate}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>نوع الواجب</span>
                <span className="font-bold truncate max-w-[150px]">{dutyType}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>وقت المغادرة</span>
                <span className="font-bold dir-ltr">{departureTime}</span>
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
                className="flex-1 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-bold text-sm shadow-md shadow-purple-500/25 transition"
              >
                تأكيد الإرسال
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DutyRequestForm;
