/**
 * TimeOffRequestForm.tsx
 * نموذج طلب الإجازة الزمنية المتقدم — يدعم 3 أنواع فرعية:
 *   A) وسط الدوام (mid_shift)   — بصمتين: مغادرة + عودة
 *   B) بداية الدوام (shift_start) — بصمة عودة فقط (الخروج = بداية الدوام)
 *   C) نهاية الدوام (shift_end)   — بصمة مغادرة فقط (العودة = نهاية الدوام)
 *
 * القواعد المطبقة من ممارسات Vercel:
 *  - rerender-functional-setstate  : functional setState for stable callbacks
 *  - bundle-conditional            : heavy validators only run on submit
 *  - js-early-exit                 : guard clauses throughout
 *  - rerender-derived-state-no-effect : derive state during render
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Clock, AlertCircle, CheckCircle, Network, UserCheck, Loader2, AlertTriangle, X, CalendarDays } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { sendPushNotification } from '../../../services/notifications';

// ── Types ───────────────────────────────────────────────────────────────────
type TimeOffSubtype = 'mid_shift' | 'shift_start' | 'shift_end';

interface SubtypeConfig {
  label: string;
  icon: string;
  hint: string;
  showLeaveTime: boolean;  // حقل ساعة الخروج/المغادرة
  showReturnTime: boolean; // حقل ساعة العودة
}

// ── Subtype configurations ── hoisted outside component ─────────────────────
const SUBTYPE_CONFIGS: Record<TimeOffSubtype, SubtypeConfig> = {
  mid_shift: {
    label: 'وسط الدوام',
    icon: '🔄',
    hint: 'يحتاج بصمتين: مغادرة + عودة. الحد الأقصى ساعتان، وإلا تتحول لإجازة اعتيادية ليوم واحد.',
    showLeaveTime: true,
    showReturnTime: true,
  },
  shift_start: {
    label: 'بداية الدوام',
    icon: '🌅',
    hint: 'الخروج هو وقت بداية الدوام الرسمي. حدد ساعة العودة فقط. الحد الأقصى ساعتان، وإلا تتحول لإجازة اعتيادية ليوم واحد.',
    showLeaveTime: false,
    showReturnTime: true,
  },
  shift_end: {
    label: 'نهاية الدوام',
    icon: '🌇',
    hint: 'حدد ساعة المغادرة فقط. العودة هي نهاية الدوام الرسمي. الحد الأقصى ساعتان، وإلا تتحول لإجازة اعتيادية ليوم واحد.',
    showLeaveTime: true,
    showReturnTime: false,
  },
};

const MAX_DURATION_MINUTES = 120;

// ── Helpers ── hoisted outside component ────────────────────────────────────
function timeToMinutes(time: string): number {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function getRelativeMins(timeStr: string, startStr: string, endStr: string): number {
  if (!timeStr) return 0;
  const mins = timeToMinutes(timeStr);
  const start = timeToMinutes(startStr);
  const end = timeToMinutes(endStr);
  
  if (end < start) { // Shift crosses midnight
    if (mins < start && mins <= end + 240) { 
        return mins + 1440;
    }
  }
  return mins;
}

function minutesToTime(mins: number): string {
  const h = Math.floor((mins % (24 * 60)) / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDurationText(mins: number): string {
  if (mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h} ساعة و ${m} دقيقة`;
  if (h > 0) return h === 1 ? 'ساعة واحدة' : h === 2 ? 'ساعتان' : `${h} ساعات`;
  return `${m} دقيقة`;
}

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr).getDay();
  return day === 5 || day === 6;
}

// ── Props ───────────────────────────────────────────────────────────────────
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
  // تاريخ اليوم بالتوقيت المحلي (وليس UTC) لتفادي انزياح التاريخ ليلاً
  const now0 = new Date();
  const todayStr = `${now0.getFullYear()}-${String(now0.getMonth() + 1).padStart(2, '0')}-${String(now0.getDate()).padStart(2, '0')}`;

  // ── Form state ────────────────────────────────────────────────────────────
  const [subtype, setSubtype] = useState<TimeOffSubtype>('mid_shift');
  const [requestDate, setRequestDate] = useState(''); // تاريخ الإجازة (إلزامي قبل الأوقات)
  const [leaveTime, setLeaveTime] = useState('');   // ساعة الخروج/المغادرة
  const [returnTime, setReturnTime] = useState('');  // ساعة العودة

  // ── الإجازات الزمنية المسجلة مسبقاً لنفس التاريخ (لفحص تجاوز الساعتين تلفيقياً) ──
  const [existingMinutes, setExistingMinutes] = useState(0);
  const [loadingExisting, setLoadingExisting] = useState(false);

  // ── Schedule state ────────────────────────────────────────────────────────
  const [shiftStart, setShiftStart] = useState('08:00');
  const [shiftEnd, setShiftEnd] = useState('15:00');
  const [workScheduleId, setWorkScheduleId] = useState<string | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successConverted, setSuccessConverted] = useState(false); // نجاح عبر التحويل لإجازة اعتيادية
  const [showConfirm, setShowConfirm] = useState(false);

  // ── Manager / routing state ───────────────────────────────────────────────
  const [managerInfo, setManagerInfo] = useState<ManagerInfo | null>(null);
  const [supervisorId, setSupervisorId] = useState<string | null>(null);
  const [approvalChain, setApprovalChain] = useState<string[]>([]);
  const [loadingManager, setLoadingManager] = useState(true);

  // ── Derived: effective times based on subtype ─────────────────────────────
  const effectiveLeaveTime = useMemo(() => {
    if (subtype === 'shift_start') return shiftStart;
    return leaveTime;
  }, [subtype, shiftStart, leaveTime]);

  const effectiveReturnTime = useMemo(() => {
    if (subtype === 'shift_end') return shiftEnd;
    return returnTime;
  }, [subtype, shiftEnd, returnTime]);

  // ── Derived: duration in minutes ──────────────────────────────────────────
  const leaveRelative = useMemo(() => getRelativeMins(effectiveLeaveTime, shiftStart, shiftEnd), [effectiveLeaveTime, shiftStart, shiftEnd]);
  const returnRelative = useMemo(() => getRelativeMins(effectiveReturnTime, shiftStart, shiftEnd), [effectiveReturnTime, shiftStart, shiftEnd]);

  const durationMinutes = useMemo(() => {
    if (!effectiveLeaveTime || !effectiveReturnTime) return 0;
    const diff = returnRelative - leaveRelative;
    return diff > 0 ? diff : 0;
  }, [effectiveLeaveTime, effectiveReturnTime, leaveRelative, returnRelative]);

  // المجموع التراكمي: مدة هذا الطلب + مدد الإجازات الزمنية المسجلة لنفس التاريخ (منع تلفيق الفترتين)
  const cumulativeMinutes = existingMinutes + durationMinutes;
  const exceedsLimit = cumulativeMinutes > MAX_DURATION_MINUTES;
  const subtypeConfig = SUBTYPE_CONFIGS[subtype];

  // ── Fetch manager + schedule ──────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const fetchManagerAndSchedule = async () => {
      try {
        setLoadingManager(true);
        const { data: profile } = await supabase
          .from('profiles')
          .select('department_id, work_schedule_id')
          .eq('id', user.id)
          .single();

        // حفظ معرف الدوام — أوقات اليوم تُحمَّل عبر effect مستقل (حسب التاريخ المختار)
        if (!cancelled) setWorkScheduleId(profile?.work_schedule_id ?? null);

        if (!profile?.department_id || cancelled) return;

        // Load manager hierarchy
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
        console.error('TimeOffRequestForm: fetchManagerAndSchedule error', e);
      } finally {
        if (!cancelled) setLoadingManager(false);
      }
    };

    fetchManagerAndSchedule();
    return () => { cancelled = true; };
  }, [user]);

  // ── تحميل أوقات دوام يوم الطلب (تختلف بين أيام الأسبوع) ──────────────────
  useEffect(() => {
    if (!workScheduleId) return;
    const targetDate = requestDate || todayStr; // بلا تاريخ → دوام اليوم الحالي
    const dayOfWeek = new Date(targetDate).getDay();
    let cancelled = false;
    (async () => {
      try {
        const { data: scheduleDay } = await supabase
          .from('work_schedule_days')
          .select('start_time, end_time')
          .eq('schedule_id', workScheduleId)
          .eq('day_of_week', dayOfWeek)
          .maybeSingle(); // يوم الراحة = لا صف
        if (cancelled) return;
        if (scheduleDay?.start_time && scheduleDay?.end_time) {
          setShiftStart(scheduleDay.start_time.substring(0, 5));
          setShiftEnd(scheduleDay.end_time.substring(0, 5));
        }
      } catch { /* الإبقاء على الدوام الحالي عند الفشل */ }
    })();
    return () => { cancelled = true; };
  }, [workScheduleId, requestDate, todayStr]);

  // ── جلب الإجازات الزمنية المسجلة لنفس التاريخ (pending/approved) لفحص التراكمي ──
  useEffect(() => {
    if (!user || !requestDate) {
      setExistingMinutes(0);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingExisting(true);
      try {
        const { data } = await supabase
          .from('leave_requests')
          .select('time_duration_minutes')
          .eq('user_id', user.id)
          .eq('leave_type', 'time_off')
          .in('status', ['pending', 'approved'])
          .eq('start_date', requestDate);
        if (cancelled) return;
        const total = (data || []).reduce((s: number, r: any) => s + (r.time_duration_minutes || 0), 0);
        setExistingMinutes(total);
      } catch {
        if (!cancelled) setExistingMinutes(0);
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, requestDate]);

  // ── Reset fields when subtype changes ─────────────────────────────────────
  const handleSubtypeChange = useCallback((newSubtype: TimeOffSubtype) => {
    setSubtype(newSubtype);
    setLeaveTime('');
    setReturnTime('');
    setError(null);
  }, []);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = useCallback((): boolean => {
    const config = SUBTYPE_CONFIGS[subtype];

    // 1) التاريخ إلزامي قبل أي وقت
    if (!requestDate) {
      setError('يرجى تحديد تاريخ الإجازة أولاً');
      return false;
    }
    // 2) منع التواريخ الماضية نهائياً (اليوم الحالي والأيام القادمة مسموحة)
    if (requestDate < todayStr) {
      setError('لا يمكن تقديم إجازة زمنية لتاريخ ماضٍ.');
      return false;
    }

    if (config.showLeaveTime && !leaveTime) {
      setError('يرجى تحديد ساعة المغادرة');
      return false;
    }
    if (config.showReturnTime && !returnTime) {
      setError('يرجى تحديد ساعة العودة');
      return false;
    }

    // Validate leave time is within shift
    if (config.showLeaveTime) {
      const leaveMins = getRelativeMins(leaveTime, shiftStart, shiftEnd);
      const startMins = getRelativeMins(shiftStart, shiftStart, shiftEnd);
      const endMins = getRelativeMins(shiftEnd, shiftStart, shiftEnd);
      if (leaveMins < startMins) {
        setError(`لا يمكنك طلب إجازة قبل بداية دوامك (${shiftStart})`);
        return false;
      }
      if (leaveMins >= endMins) {
        setError(`لا يمكنك طلب إجازة بعد نهاية دوامك (${shiftEnd})`);
        return false;
      }
    }

    // Validate return time is within shift
    if (config.showReturnTime) {
      const retMins = getRelativeMins(returnTime, shiftStart, shiftEnd);
      const startMins = getRelativeMins(shiftStart, shiftStart, shiftEnd);
      const endMins = getRelativeMins(shiftEnd, shiftStart, shiftEnd);
      if (retMins <= startMins) {
        setError(`ساعة العودة يجب أن تكون بعد بداية الدوام (${shiftStart})`);
        return false;
      }
      if (retMins > endMins) {
        setError(`ساعة العودة يجب أن لا تتجاوز نهاية الدوام (${shiftEnd})`);
        return false;
      }
    }

    // Validate return is after leave
    if (durationMinutes <= 0) {
      setError('ساعة العودة يجب أن تكون بعد ساعة المغادرة');
      return false;
    }

    // 4) منع تداخل وقت الإجازة مع الوقت الحقيقي — لطلبات اليوم الحالي فقط
    //    (الأيام القادمة لم تحدث بعد، فلا معنى لفحصها ضد "الآن")
    if (requestDate === todayStr) {
      const now = new Date();
      const nowClock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const sMins = timeToMinutes(shiftStart);
      const eMins = timeToMinutes(shiftEnd);
      // إسقاط "الآن" على خط زمن الدوام (يعالج الدوام العابر لمنتصف الليل)
      const nowRel = (eMins < sMins && nowMins < sMins) ? nowMins + 1440 : nowMins;
      if (leaveRelative <= nowRel) {
        setError(`الوقت الآن ${nowClock} — لا يمكن طلب إجازة زمنية لليوم تبدأ في وقت مضى أو متداخلة مع اللحظة الحالية.`);
        return false;
      }
    }

    if (isWeekend(requestDate)) {
      setError('تاريخ الإجازة المحدد يقع في أيام العطلة الرسمية (الجمعة والسبت) — اختر يوماً آخر.');
      return false;
    }
    if (!supervisorId) {
      setError('لم يتم تحديد مسؤولك المباشر في الهيكلية. راجع الإدارة.');
      return false;
    }
    setError(null);
    return true;
  }, [subtype, leaveTime, returnTime, requestDate, shiftStart, shiftEnd, durationMinutes, leaveRelative, supervisorId, todayStr]);

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
      const subtypeLabel = SUBTYPE_CONFIGS[subtype].label;
      const willConvert = exceedsLimit; // المجموع التراكمي تجاوز ساعتين → تحويل إجباري

      const finalReason = `(نوع الزمنية: ${subtypeLabel} | التاريخ: ${requestDate} | ساعة الخروج: ${effectiveLeaveTime} | ساعة العودة: ${effectiveReturnTime} | المدة: ${durationMinutes} دقيقة${existingMinutes > 0 ? ` | مدد زمنية سابقة بنفس اليوم: ${existingMinutes} دقيقة` : ''}${willConvert ? ' — تم التحويل لإجازة اعتيادية لتجاوز مجموع المدد ساعتين' : ''})`;

      let rpcResult: any;
      if (willConvert) {
        // التحويل الإجباري: إدراج مباشر كإجازة اعتيادية معتمدة + إشعارات للمسؤول/HR/الموظف
        const { data, error: rpcError } = await supabase.rpc('submit_time_leave_auto_converted', {
          p_leave_date: requestDate,
          p_reason: finalReason,
          p_supervisor_id: supervisorId,
          p_approval_chain: approvalChain,
          p_total_minutes: durationMinutes,
          p_existing_minutes: existingMinutes,
          p_time_off_subtype: subtype,
        });
        if (rpcError) throw rpcError;
        rpcResult = data;
      } else {
        const { data, error: rpcError } = await supabase.rpc('submit_typed_leave_request', {
          p_leave_type: 'time_off',
          p_start_date: requestDate,
          p_end_date: requestDate,
          p_days_count: 1,
          p_reason: finalReason,
          p_supervisor_id: supervisorId,
          p_approval_chain: approvalChain,
          p_time_duration_minutes: durationMinutes,
          p_destination: null,
          p_with_pay: true,
          p_supporting_image_urls: [],
          p_time_off_subtype: subtype,
          p_with_request: true,
        });
        if (rpcError) throw rpcError;
        rpcResult = data;
      }

      const response = rpcResult as any;
      if (!response?.success) {
        setError(response?.message || 'تعذّر تقديم الطلب. حاول مرة أخرى.');
        return;
      }

      // Push notification
      try {
        if (willConvert) {
          // إشعار فوري للمسؤول + الموارد البشرية بالتحويل (الموظف تصله رسالة داخلية + شاشة النجاح)
          const pushTitle = 'تحويل تلقائي إلى إجازة اعتيادية';
          const pushBody = `${user.full_name || 'موظف'} — تحوّل الطلب الزمني (المجموع ${cumulativeMinutes} دقيقة) إلى إجازة اعتيادية معتمدة بتاريخ ${requestDate}`;
          const tokens: string[] = [];
          const { data: hrProfiles } = await supabase
            .from('available_profiles')
            .select('push_token')
            .or('role.eq.admin,admin_role.eq.hr_supervisor');
          (hrProfiles || []).forEach((hr: any) => { if (hr.push_token) tokens.push(hr.push_token); });
          const { data: supProfile } = await supabase
            .from('available_profiles')
            .select('push_token')
            .eq('id', supervisorId)
            .single();
          if (supProfile?.push_token && !tokens.includes(supProfile.push_token)) tokens.push(supProfile.push_token);
          await Promise.all(tokens.map(t => sendPushNotification(t, pushTitle, pushBody).catch(() => {})));
        } else {
          const { data: supProfile } = await supabase
            .from('available_profiles')
            .select('push_token')
            .eq('id', supervisorId)
            .single();
          if (supProfile?.push_token) {
            await sendPushNotification(
              supProfile.push_token,
              `طلب إجازة زمنية — ${subtypeLabel}`,
              `${user.full_name || 'موظف'} يطلب إجازة زمنية (${subtypeLabel}) بمدة ${durationMinutes} دقيقة`
            );
          }
        }
      } catch { /* push is non-critical */ }

      setSuccessConverted(willConvert);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ غير متوقع.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (success) {
    // حالة التحويل الإجباري: الطلب سُجِّل كإجازة اعتيادية معتمدة مباشرة
    if (successConverted) {
      return (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} className="text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-lg font-bold text-amber-800 dark:text-amber-300 mb-2">تم تحويل الطلب إلى إجازة اعتيادية معتمدة</h3>
          <p className="text-amber-700 dark:text-amber-400 mb-2 text-sm leading-relaxed">
            تجاوز مجموع مدد الإجازات الزمنية ليوم <span className="font-bold dir-ltr">{requestDate}</span> الحد المسموح (ساعتان)
            بمجموع <span className="font-bold">{formatDurationText(cumulativeMinutes)}</span>
            {existingMinutes > 0 && <> (منها {formatDurationText(existingMinutes)} من طلبات سابقة)</>}.
          </p>
          <p className="text-amber-700 dark:text-amber-400 mb-6 text-sm leading-relaxed">
            لذلك سُجِّل الطلب مباشرة كـ<strong>إجازة اعتيادية معتمدة ليوم واحد</strong> في سجل إجازاتك،
            وأُرسلت إشعارات فورية إلى مسؤولك المباشر والموارد البشرية بتفاصيل الطلب وسبب التحويل.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setSuccess(false); setSuccessConverted(false); setRequestDate(''); setLeaveTime(''); setReturnTime(''); setSubtype('mid_shift'); }}
              className="bg-amber-600 text-white px-6 py-2 rounded-xl hover:bg-amber-700 transition shadow-lg shadow-amber-500/20 text-sm font-bold"
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
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-lg font-bold text-green-800 dark:text-green-300 mb-2">تم إرسال الطلب بنجاح</h3>
        <p className="text-green-600 dark:text-green-400 mb-6 text-sm">
          تم إرسال طلب الإجازة الزمنية ({SUBTYPE_CONFIGS[subtype].label}) بتاريخ <span className="font-bold dir-ltr">{requestDate}</span> إلى مسؤولك المباشر. ستصلك الإجابة قريباً.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => { setSuccess(false); setRequestDate(''); setLeaveTime(''); setReturnTime(''); setSubtype('mid_shift'); }}
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
      <form onSubmit={handleSubmit} className="space-y-5" dir="rtl">

        {/* ── نوع الزمنية (القائمة المنسدلة) ─────────────────────────────── */}
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
            حدد نوع الزمنية
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(SUBTYPE_CONFIGS) as [TimeOffSubtype, SubtypeConfig][]).map(([key, config]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleSubtypeChange(key)}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-sm font-bold border-2 transition-all duration-200 ${
                  subtype === key
                    ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/25 scale-[1.02]'
                    : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:border-amber-300 hover:shadow-sm'
                }`}
              >
                <span className="text-lg">{config.icon}</span>
                <span className="text-xs leading-tight">{config.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── تلميح النوع المختار ──────────────────────────────────────────── */}
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl flex gap-3 items-start">
          <span className="text-xl shrink-0">{subtypeConfig.icon}</span>
          <div>
            <p className="font-bold text-amber-800 dark:text-amber-300 text-sm mb-0.5">{subtypeConfig.label}</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              {subtypeConfig.hint}
            </p>
          </div>
        </div>

        {/* ── التوجيه للمسؤول ──────────────────────────────────────────────── */}
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

        {/* ── تاريخ الإجازة (إلزامي قبل الأوقات) ── */}
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
            <CalendarDays size={14} className="inline ml-1" />
            تاريخ الإجازة <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={requestDate}
            min={todayStr}
            onChange={(e) => {
              setRequestDate(e.target.value);
              setError(null);
              // إفراغ الأوقات عند تغيير/إلغاء التاريخ (الدوام قد يختلف بين الأيام)
              setLeaveTime('');
              setReturnTime('');
            }}
            className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-gray-800 dark:text-gray-100 shadow-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-500/30 outline-none transition-all"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
            يُسمح بتقديم الإجازة الزمنية لليوم الحالي أو الأيام القادمة — لا يمكن اختيار تاريخ ماضٍ.
          </p>
        </div>

        {/* ── ساعة الخروج / المغادرة ── */}
        <div>
          <label className={`block text-sm font-bold mb-2 ${requestDate ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
            <Clock size={14} className="inline ml-1" />
            {subtype === 'shift_end' ? 'ساعة المغادرة' : 'ساعة الخروج'}
          </label>
          {subtypeConfig.showLeaveTime ? (
            <>
              <ModernTimePicker
                  value={leaveTime}
                  onChange={(val: string) => { setLeaveTime(val); setError(null); }}
                  label={subtype === 'shift_end' ? 'ساعة المغادرة' : 'ساعة الخروج'}
                  disabled={!requestDate}
              />
              {!requestDate && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">حدد تاريخ الإجازة أولاً لتفعيل الأوقات.</p>
              )}
            </>
          ) : (
            <div className="w-full px-4 py-3 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-600 dark:text-gray-400 dir-ltr text-left text-base flex items-center justify-between">
              <span className="font-mono font-bold text-gray-800 dark:text-gray-200">{shiftStart}</span>
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">بداية الدوام الرسمي</span>
            </div>
          )}
        </div>

        {/* ── ساعة العودة ─────────────────────────────────────────────────── */}
        <div>
          <label className={`block text-sm font-bold mb-2 ${requestDate ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
            <Clock size={14} className="inline ml-1" />
            ساعة العودة
          </label>
          {subtypeConfig.showReturnTime ? (
            <>
              <ModernTimePicker
                  value={returnTime}
                  onChange={(val: string) => { setReturnTime(val); setError(null); }}
                  label="ساعة العودة"
                  disabled={!requestDate}
              />
              {!requestDate && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">حدد تاريخ الإجازة أولاً لتفعيل الأوقات.</p>
              )}
            </>
          ) : (
            <div className="w-full px-4 py-3 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-600 dark:text-gray-400 dir-ltr text-left text-base flex items-center justify-between">
              <span className="font-mono font-bold text-gray-800 dark:text-gray-200">{shiftEnd}</span>
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">نهاية الدوام الرسمي</span>
            </div>
          )}
        </div>

        {/* ── المدة المحسوبة تلقائياً ─────────────────────────────────────── */}
        <div className={`flex items-center justify-between p-4 rounded-xl border ${
          exceedsLimit
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40'
            : durationMinutes > 0
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40'
              : 'bg-gray-50 dark:bg-slate-700/50 border-gray-200 dark:border-slate-600'
        }`}>
          <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">المدة المحسوبة:</span>
          <span className={`font-bold text-sm ${
            exceedsLimit
              ? 'text-red-700 dark:text-red-300'
              : durationMinutes > 0
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-gray-400'
          }`}>
            {durationMinutes > 0 ? formatDurationText(durationMinutes) : '—'}
          </span>
        </div>

        {/* ── المجموع التراكمي مع المدد الزمنية السابقة بنفس اليوم ── */}
        {requestDate && (loadingExisting || existingMinutes > 0) && (
          <div className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-sm ${
            exceedsLimit
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40'
              : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40'
          }`}>
            {loadingExisting ? (
              <span className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Loader2 size={14} className="animate-spin" /> جاري فحص الإجازات الزمنية السابقة لهذا اليوم...
              </span>
            ) : (
              <>
                <span className="text-gray-600 dark:text-gray-300 font-medium">
                  مدد زمنية سابقة بنفس اليوم: <span className="font-bold">{formatDurationText(existingMinutes)}</span>
                </span>
                <span className={`font-bold ${exceedsLimit ? 'text-red-700 dark:text-red-300' : 'text-blue-700 dark:text-blue-300'}`}>
                  المجموع: {formatDurationText(cumulativeMinutes)}
                </span>
              </>
            )}
          </div>
        )}

        {/* ── تحذير تجاوز الحد ────────────────────────────────────────────── */}
        {exceedsLimit && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-300 rounded-xl text-sm flex items-start gap-2">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">تجاوز الحد الزمني (ساعتان)</p>
              <p className="text-xs leading-relaxed">
                مجموع مدد الإجازات الزمنية لهذا اليوم {formatDurationText(cumulativeMinutes)}
                {existingMinutes > 0 && <> (منها {formatDurationText(existingMinutes)} من طلبات سابقة)</>}
                {durationMinutes > MAX_DURATION_MINUTES
                  ? ' — مدة هذا الطلب وحدها تجاوزت الحد.'
                  : ' — المجموع التراكمي تجاوز الحد حتى لو كانت الفترات منفصلة.'}
                سيتم تحويل هذا الطلب تلقائياً إلى إجازة اعتيادية معتمدة ليوم واحد، مع إشعار مسؤولك المباشر والموارد البشرية.
              </p>
            </div>
          </div>
        )}

        {/* ── خطأ ─────────────────────────────────────────────────────────── */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        {/* ── زر الإرسال ──────────────────────────────────────────────────── */}
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

      {/* ── نافذة التأكيد ──────────────────────────────────────────────────── */}
      {showConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">تأكيد إرسال الطلب</h3>
            <div className="space-y-2 text-sm mb-5">
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>نوع الطلب</span>
                <span className={`font-bold ${exceedsLimit ? 'text-red-600' : 'text-amber-600'}`}>
                  {exceedsLimit ? 'إجازة اعتيادية (تحويل تلقائي)' : `زمنية — ${subtypeConfig.label}`}
                </span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>التاريخ</span>
                <span className="font-bold dir-ltr">{requestDate}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>ساعة الخروج</span>
                <span className="font-bold dir-ltr">{effectiveLeaveTime}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>ساعة العودة</span>
                <span className="font-bold dir-ltr">{effectiveReturnTime}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>المدة</span>
                <span className={`font-bold ${exceedsLimit ? 'text-red-600' : ''}`}>{formatDurationText(durationMinutes)}</span>
              </div>
              {existingMinutes > 0 && (
                <>
                  <div className="flex justify-between text-gray-600 dark:text-gray-300">
                    <span>مدد زمنية سابقة بنفس اليوم</span>
                    <span className="font-bold">{formatDurationText(existingMinutes)}</span>
                  </div>
                  <div className="flex justify-between text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-slate-700/50 rounded-lg px-2 py-1.5">
                    <span className="font-bold">المجموع التراكمي</span>
                    <span className={`font-bold ${exceedsLimit ? 'text-red-600' : 'text-blue-600'}`}>{formatDurationText(cumulativeMinutes)}</span>
                  </div>
                </>
              )}
            </div>
            {exceedsLimit && (
              <div className="mb-4 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg text-xs text-red-700 dark:text-red-300 leading-relaxed">
                تنبيه: عند التأكيد سيُسجَّل الطلب مباشرة كـ<strong>إجازة اعتيادية معتمدة ليوم واحد</strong> (لتجاوز المجموع ساعتين)، وسيتم إشعار مسؤولك المباشر والموارد البشرية والموظف المعني فوراً.
              </div>
            )}
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

// ── Custom Modern 24h Time Picker ────────────────────────────────────────────
const ModernTimePicker = ({ value, onChange, label, hint, disabled }: any) => {
   const [isOpen, setIsOpen] = useState(false);
   const [step, setStep] = useState<'h' | 'm'>('h');
   const [tempH, setTempH] = useState('');

   const h = value ? value.split(':')[0] : '00';
   const m = value ? value.split(':')[1] : '00';

   const hours = Array.from({length: 24}).map((_, i) => String(i).padStart(2, '0'));
   const minutes = Array.from({length: 60}).map((_, i) => String(i).padStart(2, '0'));

   return (
      <div className="relative">
          <div
            onClick={() => { if (disabled) return; setIsOpen(true); setStep('h'); setTempH(h); }}
            aria-disabled={disabled}
            className={`w-full bg-white dark:bg-slate-900 border rounded-xl p-3 flex flex-row-reverse items-center justify-between shadow-sm transition-all ${
              disabled
                ? 'border-gray-200 dark:border-slate-700 opacity-50 cursor-not-allowed'
                : 'border-gray-200 dark:border-slate-700 cursor-pointer hover:border-amber-400 dark:hover:border-amber-500'
            }`}
          >
             <div className="flex gap-1.5 items-center text-xl font-mono font-bold text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-slate-700">
                <Clock size={18} className="text-amber-500 ml-2" />
                <span>{m}</span>
                <span className="text-gray-400 mb-0.5">:</span>
                <span>{h}</span>
             </div>
             
             <div className="flex flex-col text-sm text-gray-700 dark:text-gray-300">
                <span className="font-bold">{label}</span>
                {hint && <span className="text-xs text-gray-500">{hint}</span>}
             </div>
          </div>

          {isOpen && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
               <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-2xl rounded-2xl p-5 w-full max-w-xs z-10 animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-5 border-b border-gray-100 dark:border-slate-700 pb-3">
                     <span className="font-bold text-gray-800 dark:text-gray-200">
                        {step === 'h' ? 'اختر الساعة (24)' : 'اختر الدقيقة'}
                     </span>
                     <button type="button" onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-red-500 bg-gray-50 dark:bg-slate-700 p-1.5 rounded-full transition-colors">
                        <X size={16} />
                     </button>
                  </div>
                  
                  {step === 'h' ? (
                     <div className="grid grid-cols-6 gap-1.5 dir-ltr">
                        {hours.map(hour => (
                           <button 
                             type="button"
                             key={hour}
                             onClick={() => { setTempH(hour); setStep('m'); }}
                             className={`py-2 rounded-lg text-sm font-bold font-mono transition-all ${hour === h ? 'bg-amber-500 text-white shadow-md' : 'bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-amber-100 dark:hover:bg-slate-600'}`}
                           >
                             {hour}
                           </button>
                        ))}
                     </div>
                  ) : (
                     <div>
                        <div className="grid grid-cols-6 gap-1.5 dir-ltr max-h-[40vh] overflow-y-auto pr-1 hide-scrollbar">
                           {minutes.map(minute => (
                              <button 
                                type="button"
                                key={minute}
                                onClick={() => { 
                                   onChange(`${tempH}:${minute}`); 
                                   setIsOpen(false); 
                                }}
                                className={`py-2 rounded-lg text-sm font-bold font-mono transition-all ${minute === m && tempH === h ? 'bg-amber-500 text-white shadow-md' : 'bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-amber-100 dark:hover:bg-slate-600'}`}
                              >
                                {minute}
                              </button>
                           ))}
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setStep('h')}
                          className="w-full mt-4 py-3 text-sm font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                        >
                          العودة لتحديد الساعة
                        </button>
                     </div>
                  )}
               </div>
               <div className="fixed inset-0 -z-10" onClick={() => setIsOpen(false)}></div>
            </div>
          )}
      </div>
   )
}

export default TimeOffRequestForm;


