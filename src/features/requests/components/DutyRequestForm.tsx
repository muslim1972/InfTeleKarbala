import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  AlertCircle,
  CheckCircle,
  Network,
  UserCheck,
  Loader2,
  MapPin,
  FileText,
  Calendar,
  X,
  Printer,
  ShieldCheck,
  ChevronDown,
  RefreshCw,
  Ban
} from 'lucide-react';
import { toast } from 'react-hot-toast';
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

  // ── Smart Conflict Detection state ─────────────────────────────────────────
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [isCheckingConflict, setIsCheckingConflict] = useState(false);

  // ── Latest Duty state ──────────────────────────────────────────────────────
  const [latestDuty, setLatestDuty] = useState<any | null>(null);
  const [isCancellingDuty, setIsCancellingDuty] = useState(false);

  // ── History & Archive state ────────────────────────────────────────────────
  const [archiveRecords, setArchiveRecords] = useState<any[]>([]);
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);
  const [archiveStartDate, setArchiveStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [archiveEndDate, setArchiveEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  });
  const [showArchive, setShowArchive] = useState(true);

  // ── Print Duty Slip Modal ──────────────────────────────────────────────────
  const [selectedDutyForPrint, setSelectedDutyForPrint] = useState<any | null>(null);

  // ── Fetch manager from hierarchy ──────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const fetchManager = async () => {
      try {
        setLoadingManager(true);
        if (cancelled) return;

        // استدعاء دالة العقل المركزي لحساب سلسلة الصعود الهرمي
        const { data: chainRows, error: chainErr } = await supabase
          .rpc('core_resolve_approval_chain', { p_user_id: user.id });

        if (chainErr) {
          console.error('DutyRequestForm: Error calling core_resolve_approval_chain:', chainErr);
          setLoadingManager(false);
          return;
        }

        if (cancelled) return;

        if (chainRows && chainRows.length > 0) {
          const chain = chainRows.map((r: any) => r.manager_id);
          const names = chainRows.map((r: any) => `مدير ${r.dept_name}`);
          const displayNames = names.join(' ⬅️ ');
          const isTopSelf = chain.length === 1 && chain[0] === user.id;

          setManagerInfo({
            id: chain[0],
            name: isTopSelf ? 'نفسه (مسؤول أعلى)' : displayNames,
            names: names,
            isTopManagerSelf: isTopSelf
          });
          setSupervisorId(chain[0]);
          setApprovalChain(chain);
        } else {
          setManagerInfo(null);
          setSupervisorId(null);
          setApprovalChain([]);
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

  // ── Fetch Latest Duty ──────────────────────────────────────────────────────
  const fetchLatestDuty = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error: err } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', user.id)
        .eq('leave_type', 'duty')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!err) {
        setLatestDuty(data || null);
      }
    } catch (e) {
      console.warn('Error fetching latest duty:', e);
    }
  }, [user?.id]);

  // ── Fetch Duty Archive ─────────────────────────────────────────────────────
  const fetchArchive = useCallback(async () => {
    if (!user?.id) return;
    try {
      setIsLoadingArchive(true);
      const { data, error: err } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', user.id)
        .eq('leave_type', 'duty')
        .gte('start_date', archiveStartDate)
        .lte('start_date', archiveEndDate)
        .order('start_date', { ascending: false });

      if (!err) {
        setArchiveRecords(data || []);
      }
    } catch (e) {
      console.warn('Error fetching duty archive:', e);
    } finally {
      setIsLoadingArchive(false);
    }
  }, [user?.id, archiveStartDate, archiveEndDate]);

  // ── Smart Conflict Checking ────────────────────────────────────────────────
  const checkConflicts = useCallback(async (targetDate: string) => {
    if (!user?.id || !targetDate) return;
    setIsCheckingConflict(true);
    setConflictWarning(null);
    try {
      // 1. فحص الإجازات الكاملة (اعتيادية، مرضية، إلخ)
      const { data: leaves } = await supabase
        .from('leave_requests')
        .select('id, leave_type, status, start_date, end_date')
        .eq('user_id', user.id)
        .in('status', ['pending', 'approved'])
        .not('leave_type', 'in', '("duty","time_off")')
        .lte('start_date', targetDate)
        .gte('end_date', targetDate);

      if (leaves && leaves.length > 0) {
        const l = leaves[0];
        const statusText = l.status === 'approved' ? 'معتمدة' : 'قيد المراجعة';
        const typeLabels: Record<string, string> = {
          regular: 'اعتيادية',
          sick: 'مرضية',
          long_regular: 'خمس سنوات',
          long_sick: 'مرضية طويلة',
          dispatch: 'إيفاد'
        };
        const typeName = typeLabels[l.leave_type] || l.leave_type;
        setConflictWarning(`⛔ لا يمكن تقديم واجب رسمي في تاريخ (${targetDate}) لأن لديك إجازة ${typeName} (${statusText}) في هذا اليوم.`);
        return;
      }

      // 2. فحص وجود واجب رسمي آخر لنفس التاريخ
      const { data: duties } = await supabase
        .from('leave_requests')
        .select('id, destination, reason, status')
        .eq('user_id', user.id)
        .eq('leave_type', 'duty')
        .eq('start_date', targetDate)
        .in('status', ['pending', 'approved']);

      if (duties && duties.length > 0) {
        const d = duties[0];
        const statusText = d.status === 'approved' ? 'معتمد' : 'قيد المراجعة';
        setConflictWarning(`⛔ لديك بالفعل واجب رسمي إلى (${d.destination || 'جهة رسمية'}) (${statusText}) في تاريخ (${targetDate}). لا يمكن تقديم واجب مكرر في نفس اليوم.`);
        return;
      }

      // 3. فحص الإجازة الزمنية لنفس التاريخ
      const { data: timeOffs } = await supabase
        .from('leave_requests')
        .select('id, time_duration_minutes, status')
        .eq('user_id', user.id)
        .eq('leave_type', 'time_off')
        .eq('start_date', targetDate)
        .in('status', ['pending', 'approved']);

      if (timeOffs && timeOffs.length > 0) {
        const t = timeOffs[0];
        const statusText = t.status === 'approved' ? 'معتمدة' : 'قيد المراجعة';
        setConflictWarning(`⚠️ تنبيه: لديك إجازة زمنية (${t.time_duration_minutes} دقيقة) ${statusText} في تاريخ (${targetDate}). تأكد من عدم تضارب وقت الواجب مع وقت الإجازة.`);
      }
    } catch (e) {
      console.warn('Error checking date conflicts:', e);
    } finally {
      setIsCheckingConflict(false);
    }
  }, [user?.id]);

  useEffect(() => {
    checkConflicts(dutyExecutionDate);
  }, [dutyExecutionDate, checkConflicts]);

  useEffect(() => {
    fetchLatestDuty();
    fetchArchive();

    // اشتراك لحظي لمزامنة أي تغيير
    const channel = supabase
      .channel(`duty_updates_${user?.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'leave_requests',
        filter: `user_id=eq.${user?.id}`
      }, () => {
        fetchLatestDuty();
        fetchArchive();
        checkConflicts(dutyExecutionDate);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [fetchLatestDuty, fetchArchive, user?.id, dutyExecutionDate, checkConflicts]);

  // ── Cancel Pending Duty ─────────────────────────────────────────────────────
  const handleCancelDuty = async (requestId: string) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في إلغاء طلب الواجب هذا؟')) return;
    setIsCancellingDuty(true);
    try {
      const { error: cancelErr } = await supabase
        .from('leave_requests')
        .update({
          status: 'canceled',
          leave_status: 'canceled',
          modification_type: 'canceled',
          cancellation_status: 'approved'
        })
        .eq('id', requestId);

      if (cancelErr) throw cancelErr;

      // حذف إشعار المسؤول المعلق المرتبط بهذا الطلب
      await supabase
        .from('system_notifications')
        .delete()
        .eq('metadata->>request_id', requestId);

      toast.success('تم إلغاء طلب الواجب بنجاح');
      fetchLatestDuty();
      fetchArchive();
      checkConflicts(dutyExecutionDate);
    } catch (err: any) {
      console.error('Cancel duty error:', err);
      toast.error(err?.message || 'تعذر إلغاء الطلب');
    } finally {
      setIsCancellingDuty(false);
    }
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = useCallback((): boolean => {
    if (conflictWarning && conflictWarning.startsWith('⛔')) {
      setError(conflictWarning);
      return false;
    }

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
  }, [dutyExecutionDate, dutyType, destination, departureTime, todayStr, tomorrowStr, supervisorId, conflictWarning]);

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
        p_time_off_subtype: null,
        p_with_request: true,
        p_leave_start_time: departureTime ? (departureTime.length === 5 ? `${departureTime}:00` : departureTime) : null,
        p_leave_end_time: null,
        p_substitute_id: null,
      });

      if (rpcError) throw rpcError;

      const response = data as any;
      if (!response?.success) {
        setError(response?.message || 'تعذّر تقديم الطلب. حاول مرة أخرى.');
        return;
      }

      // إشعار دفع فوري للمسؤول
      try {
        const { data: supProfile } = await supabase
          .from('available_profiles')
          .select('push_token')
          .eq('id', supervisorId)
          .single();
        if (supProfile?.push_token) {
          await sendPushNotification(
            supProfile.push_token,
            `الموظف: (${user.full_name || 'موظف'}) يطلب الخروج لتنفيذ واجب رسمي إلى (${destination})`,
            { title: 'طلب واجب رسمي جديد' }
          );
        }
      } catch { /* push notification is non-critical */ }

      setSuccess(true);
      fetchLatestDuty();
      fetchArchive();
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ غير متوقع.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-purple-100 dark:bg-purple-800 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle size={32} className="text-purple-600 dark:text-purple-400" />
        </div>
        <h3 className="text-lg font-bold text-purple-900 dark:text-purple-200">تم إرسال طلب الواجب بنجاح</h3>
        <p className="text-purple-800 dark:text-purple-300 text-sm max-w-md mx-auto leading-relaxed">
          تم توجيه طلب تنفيذ الواجب الرسمي إلى مسؤولك المباشر. فور اعتماده ستُعفى تلقائياً من بصمة نهاية الدوام لهذا اليوم.
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={() => {
              setSuccess(false);
              setDutyExecutionDate(todayStr);
              setDutyType('');
              setDestination('');
              setDepartureTime('');
              setError(null);
            }}
            className="bg-purple-600 text-white px-6 py-2.5 rounded-xl hover:bg-purple-700 transition shadow-lg shadow-purple-500/20 text-sm font-bold active:scale-95"
          >
            تقديم طلب آخر
          </button>
          <button
            onClick={onSuccess}
            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-gray-100 px-6 py-2.5 rounded-xl hover:bg-gray-50 transition text-sm font-bold"
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      {/* ── Latest Duty Banner ───────────────────────────────────────────────── */}
      {latestDuty && latestDuty.status !== 'canceled' && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm transition-all ${
          latestDuty.status === 'pending'
            ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
            : latestDuty.status === 'approved'
            ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
            : 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
        }`}>
          <div className="flex items-start gap-3 flex-1">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              latestDuty.status === 'pending'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
                : latestDuty.status === 'approved'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
            }`}>
              {latestDuty.status === 'pending' ? <Clock size={20} className="animate-spin" /> :
               latestDuty.status === 'approved' ? <ShieldCheck size={20} /> : <Ban size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-gray-900 dark:text-white">
                  {latestDuty.status === 'pending' ? 'طلب واجب رسمي قيد انتظار موافقة المسؤول' :
                   latestDuty.status === 'approved' ? 'واجب رسمي معتمد' : 'طلب واجب مرفوض'}
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  latestDuty.status === 'pending'
                    ? 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100'
                    : latestDuty.status === 'approved'
                    ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100'
                    : 'bg-rose-200 text-rose-900 dark:bg-rose-800 dark:text-rose-100'
                }`}>
                  {latestDuty.status === 'pending' ? 'قيد المراجعة' :
                   latestDuty.status === 'approved' ? 'معتمد رسمياً' : 'مرفوض'}
                </span>
              </div>
              <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 font-medium leading-relaxed">
                تاريخ التنفيذ: <strong className="text-gray-900 dark:text-white">{latestDuty.start_date}</strong> | الوجهة: <strong className="text-gray-900 dark:text-white">{latestDuty.destination || 'غير محدد'}</strong>
                {latestDuty.status === 'approved' && (
                  <span className="block text-emerald-800 dark:text-emerald-300 font-bold mt-0.5">
                    🛡️ صاحب الواجب معفي من تثبيت بصمة نهاية الدوام لهذا اليوم.
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {latestDuty.status === 'pending' && (
              <button
                onClick={() => handleCancelDuty(latestDuty.id)}
                disabled={isCancellingDuty}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm disabled:opacity-50"
              >
                <X size={14} />
                {isCancellingDuty ? 'جارٍ الإلغاء...' : 'إلغاء الطلب'}
              </button>
            )}
            {latestDuty.status === 'approved' && (
              <button
                onClick={() => setSelectedDutyForPrint(latestDuty)}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <Printer size={14} />
                معاينة أمر الواجب
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Main Form Container ──────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        {/* Form Header */}
        <div className="w-full flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
              <FileText size={20} />
            </div>
            <div className="text-right">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                نموذج واجب رسمي
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                تقديم طلب تنفيذ مهمة أو واجب رسمي خارج مقر العمل
              </p>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="p-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Info banner */}
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/40 rounded-xl flex gap-3 items-start">
              <span className="text-2xl shrink-0">🛡️</span>
              <div>
                <p className="font-bold text-purple-900 dark:text-purple-300 text-sm mb-0.5">طلب واجب رسمي</p>
                <p className="text-xs text-purple-800 dark:text-purple-400 leading-relaxed font-medium">
                  يُستخدم لتسجيل خروجك بمهام رسمية معتمدة. لا يُخصم من رصيد إجازاتك، ويُعفي من بصمة نهاية الدوام فور اعتماد المسؤول.
                </p>
              </div>
            </div>

            {/* Smart Conflict Warning Banner */}
            {conflictWarning && (
              <div className={`p-4 rounded-xl border flex items-start gap-3 shadow-sm ${
                conflictWarning.startsWith('⛔')
                  ? 'bg-rose-50 border-rose-300 text-rose-900 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200'
                  : 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200'
              }`}>
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <div className="text-xs leading-relaxed font-bold">
                  {conflictWarning}
                </div>
              </div>
            )}

            {/* Routing info */}
            <div className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
              managerInfo
                ? 'bg-blue-50 dark:bg-slate-900/50 border-blue-100 dark:border-blue-900/50'
                : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30'
            }`}>
              <div className="flex-1">
                <span className={`block text-sm font-bold mb-2 ${managerInfo ? 'text-blue-700 dark:text-blue-400' : 'text-red-700 dark:text-red-400'}`}>
                  توجيه الطلب تلقائياً إلى:
                </span>
                {loadingManager ? (
                  <span className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 size={14} className="animate-spin" /> جاري تحديد المسؤول...
                  </span>
                ) : managerInfo ? (
                  <div className="space-y-1.5">
                    {(managerInfo.names ?? [managerInfo.name]).map((n, i) => (
                      <div key={i} className="text-gray-900 dark:text-gray-100 font-bold flex items-center gap-2 text-sm">
                        <UserCheck size={14} className="text-blue-500 shrink-0" />
                        <span>المستوى {i + 1}: {n}</span>
                      </div>
                    ))}
                    {managerInfo.isTopManagerSelf && (
                      <p className="text-xs text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 rounded-lg p-2 mt-1 font-bold">
                        أنت المسؤول الأعلى — سيُعرض الطلب عليك لإبداء الرأي.
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="text-red-600 text-sm font-bold">⚠️ لم يُحدَّد قسم أو مسؤول مباشر لك. راجع الإدارة.</span>
                )}
              </div>
              <Network size={36} className={`shrink-0 ${managerInfo ? 'text-blue-200 dark:text-blue-800' : 'text-red-200 dark:text-red-800/50'}`} />
            </div>

            {/* Execution Date */}
            <div>
              <label className="block text-sm font-black text-gray-900 dark:text-gray-100 mb-2">
                تاريخ تنفيذ الواجب
              </label>
              <DateInput
                value={dutyExecutionDate}
                onChange={(val) => {
                  setDutyExecutionDate(val);
                  setError(null);
                }}
                min={todayStr}
                required
                className="w-full font-bold"
              />
              <div className="flex items-center justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span>يجب أن يكون اليوم أو غداً فقط.</span>
                {isCheckingConflict && (
                  <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold">
                    <Loader2 size={12} className="animate-spin" /> جارٍ التحقق من التضارب...
                  </span>
                )}
              </div>
            </div>

            {/* Duty Type */}
            <div>
              <label className="block text-sm font-black text-gray-900 dark:text-gray-100 mb-2">
                <FileText size={14} className="inline ml-1 text-purple-600" />
                نوع الواجب
              </label>
              <input
                type="text"
                value={dutyType}
                onChange={(e) => { setDutyType(e.target.value); setError(null); }}
                required
                placeholder="مثال: مراجعة ديوان المحافظة، حضور ندوة، صيانة خارجية..."
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition text-base font-bold text-gray-900 dark:text-white"
              />
            </div>

            {/* Destination */}
            <div>
              <label className="block text-sm font-black text-gray-900 dark:text-gray-100 mb-2">
                <MapPin size={14} className="inline ml-1 text-purple-600" />
                موقع الواجب
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => { setDestination(e.target.value); setError(null); }}
                required
                placeholder="اسم الدائرة أو المكان المقصود"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition text-base font-bold text-gray-900 dark:text-white"
              />
            </div>

            {/* Departure Time */}
            <div>
              <label className="block text-sm font-black text-gray-900 dark:text-gray-100 mb-2">
                <Clock size={14} className="inline ml-1 text-purple-600" />
                وقت المغادرة
              </label>
              <input
                type="time"
                value={departureTime}
                onChange={(e) => { setDepartureTime(e.target.value); setError(null); }}
                required
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition dir-ltr text-left text-base font-bold text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 mt-1">يجب أن يكون وقت المغادرة بين بداية الدوام والساعة 14:00 (الثانية ظهراً).</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm font-bold flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || loadingManager || Boolean(conflictWarning && conflictWarning.startsWith('⛔'))}
              className="w-full bg-gradient-to-l from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-purple-500/25 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-base"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={18} className="animate-spin" /> جاري الإرسال...
                </span>
              ) : 'إرسال الطلب للمسؤول'}
            </button>
          </form>
        </div>
      </div>

      {/* ── Duty History & Archive Section ───────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div
          onClick={() => setShowArchive(prev => !prev)}
          className="w-full flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h3 className="font-bold text-base text-gray-900 dark:text-white">
              سجل وأرشيف واجباتك الرسمية
            </h3>
            <span className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 px-2 py-0.5 rounded-full font-bold">
              {archiveRecords.length}
            </span>
          </div>
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showArchive ? 'rotate-180' : ''}`} />
        </div>

        {showArchive && (
          <div className="p-4 space-y-4">
            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 dark:bg-slate-900/50 p-3 rounded-xl border border-gray-100 dark:border-slate-700">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">من تاريخ</label>
                <input
                  type="date"
                  value={archiveStartDate}
                  onChange={(e) => setArchiveStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-lg text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">إلى تاريخ</label>
                <input
                  type="date"
                  value={archiveEndDate}
                  onChange={(e) => setArchiveEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border rounded-lg text-xs font-bold"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={fetchArchive}
                  disabled={isLoadingArchive}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <RefreshCw size={14} className={isLoadingArchive ? 'animate-spin' : ''} />
                  تحديث السجل
                </button>
              </div>
            </div>

            {/* Records List */}
            {isLoadingArchive ? (
              <div className="text-center py-8 text-gray-400">
                <Loader2 size={24} className="animate-spin mx-auto mb-2 text-purple-600" />
                <p className="text-xs">جارٍ تحميل سجل الواجبات...</p>
              </div>
            ) : archiveRecords.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <FileText size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-xs font-bold text-gray-500">لا توجد واجبات رسمية مسجلة في هذه الفترة.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {archiveRecords.map((rec) => {
                  const isApproved = rec.status === 'approved';
                  const isPending = rec.status === 'pending';
                  return (
                    <div
                      key={rec.id}
                      className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors ${
                        isApproved
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
                          : isPending
                          ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40'
                          : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                            isApproved
                              ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200'
                              : isPending
                              ? 'bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200'
                              : 'bg-rose-200 text-rose-900 dark:bg-rose-900/60 dark:text-rose-200'
                          }`}>
                            {isApproved ? 'معتمد' : isPending ? 'قيد المراجعة' : 'مرفوض'}
                          </span>
                          <span className="font-bold text-sm text-gray-900 dark:text-white">
                            {rec.destination || 'جهة رسمية'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                          تاريخ الواجب: <strong>{rec.start_date}</strong> {rec.reason ? `| ${rec.reason}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isApproved && (
                          <button
                            onClick={() => setSelectedDutyForPrint(rec)}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm active:scale-95"
                          >
                            <Printer size={13} />
                            أمر الواجب
                          </button>
                        )}
                        {isPending && (
                          <button
                            onClick={() => handleCancelDuty(rec.id)}
                            disabled={isCancellingDuty}
                            className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                          >
                            <X size={13} />
                            إلغاء
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Confirmation Modal ───────────────────────────────────────────────── */}
      {showConfirm && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 pb-28 md:pb-32 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-[calc(100vh-9rem)] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">تأكيد إرسال طلب الواجب</h3>
            <div className="space-y-2 text-sm mb-5">
              <div className="flex justify-between text-gray-700 dark:text-gray-300 font-medium">
                <span>نوع الطلب</span>
                <span className="font-bold text-purple-600">طلب واجب رسمي</span>
              </div>
              <div className="flex justify-between text-gray-700 dark:text-gray-300 font-medium">
                <span>تاريخ التنفيذ</span>
                <span className="font-bold text-gray-900 dark:text-white">{dutyExecutionDate}</span>
              </div>
              <div className="flex justify-between text-gray-700 dark:text-gray-300 font-medium">
                <span>نوع الواجب</span>
                <span className="font-bold text-gray-900 dark:text-white truncate max-w-[150px]">{dutyType}</span>
              </div>
              <div className="flex justify-between text-gray-700 dark:text-gray-300 font-medium">
                <span>موقع الواجب</span>
                <span className="font-bold text-gray-900 dark:text-white truncate max-w-[150px]">{destination}</span>
              </div>
              <div className="flex justify-between text-gray-700 dark:text-gray-300 font-medium">
                <span>وقت المغادرة</span>
                <span className="font-bold dir-ltr text-gray-900 dark:text-white">{departureTime}</span>
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
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md shadow-purple-500/25 transition active:scale-95"
              >
                تأكيد الإرسال
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Official Duty Slip Modal (معاينة وطباعة أمر الواجب) ──────────────── */}
      {selectedDutyForPrint && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-5 text-gray-900 text-right print:p-0 print:shadow-none" dir="rtl">
            {/* Header */}
            <div className="text-center border-b pb-4 border-gray-200">
              <p className="text-xs font-bold text-gray-600">جمهورية العراق — وزارة الاتصالات</p>
              <p className="text-xs font-bold text-gray-600">الشركة العامة للاتصالات والمعلوماتية</p>
              <h3 className="text-lg font-black text-gray-900 mt-1">مديرية اتصالات كربلاء المقدسة</h3>
              <div className="mt-2 inline-block px-4 py-1 bg-purple-100 text-purple-900 font-black rounded-full text-xs">
                أمر تكليف بمهمة رسمية (واجب)
              </div>
            </div>

            {/* Details Table */}
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500 font-bold">اسم الموظف المكلف:</span>
                <span className="font-black text-sm text-gray-900">{user?.full_name || 'موظف'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500 font-bold">تاريخ تنفيذ الواجب:</span>
                <span className="font-black text-gray-900">{selectedDutyForPrint.start_date}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500 font-bold">موقع ومقر الواجب:</span>
                <span className="font-black text-gray-900">{selectedDutyForPrint.destination || 'غير محدد'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500 font-bold">تفاصيل الواجب:</span>
                <span className="font-bold text-gray-900">{selectedDutyForPrint.reason || 'مهمة رسمية'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500 font-bold">حالة الاعتماد الإداري:</span>
                <span className="font-black text-emerald-700">معتمد وموافق عليه رسمياً</span>
              </div>
            </div>

            {/* Instruction Notice */}
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 font-bold leading-relaxed">
              ⚠️ توجيه إداري: يُعفى الموظف المكلف بموجب هذا الأمر من تثبيت بصمة نهاية الدوام لتنفيذه المهمة الرسمية الموكولة إليه.
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Printer size={15} />
                طباعة أمر الواجب
              </button>
              <button
                onClick={() => setSelectedDutyForPrint(null)}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DutyRequestForm;
