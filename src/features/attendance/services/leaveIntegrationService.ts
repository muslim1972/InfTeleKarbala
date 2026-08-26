/**
 * leaveIntegrationService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * طبقة التكامل بين نظام إدارة الإجازات (تبويبة الطلبات) ونظام الحضور والانصراف
 * بالبصمة البيومترية.
 *
 * المسؤوليات:
 *  1. فحص حالة يوم الموظف (إجازة اعتيادية / مرضية / واجب / إيفاد ... إلخ)
 *     قبل السماح بتثبيت بصمة الحضور.
 *  2. فحص الإجازات الزمنية المعتمدة (time_off) ومطابقتها مع بصمات
 *     الخروج/العودة المسجلة فعلياً.
 *  3. بناء الملاحظات والتنبيهات الموحدة التي تظهر في السجلات والتقارير.
 *
 * ملاحظة مهمة: تُستثنى الإجازات المولّدة تلقائياً كعقوبات (تأخير صباحي /
 * خروج مبكر / تجاوز الحد الزمني) لأنها ليست طلبات قدّمها الموظف، ويتم
 * تمييزها في قاعدة البيانات عبر with_request = false.
 */

import { supabase } from '../../../lib/supabase';
import type { AttendanceRecord } from '../types';

// ─── ثوابت أنواع الإجازات ───────────────────────────────────────────────────

/** التسميات العربية لأنواع الإجازات (تُستخدم في الرسائل والملاحظات والتقارير) */
export const LEAVE_TYPE_LABELS: Record<string, string> = {
  regular: 'إجازة اعتيادية',
  long_regular: 'إجازة اعتيادية طويلة',
  sick: 'إجازة مرضية / فحص طبي',
  duty: 'واجب رسمي',
  dispatch: 'إيفاد',
  time_off: 'إجازة زمنية',
};

/** أنواع الإجازات التي تغطي يوماً كاملاً (غير الزمنية) */
export const DAY_LEAVE_TYPES = ['regular', 'long_regular', 'sick', 'duty', 'dispatch'];

/** بادئة ملاحظة الدوام الإضافي في يوم الإجازة — تُستخدم للكشف في التقارير */
export const LEAVE_OVERTIME_NOTE_PREFIX = 'دوام إضافي في يوم إجازة';

// ─── الأنواع (Types) ────────────────────────────────────────────────────────

export interface LeaveRequestLite {
  id: string;
  user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string | null;
  time_duration_minutes?: number | null;
  time_off_subtype?: string | null;
  with_request?: boolean | null;
  is_mandatory?: boolean | null;
  status: string;
  reason?: string | null;
}

/** معلومات إجازة تغطي يوماً كاملاً */
export interface DayLeaveInfo {
  id: string;
  leaveType: string;
  /** التسمية العربية الجاهزة للعرض */
  label: string;
  /** رسالة التنبيه الجاهزة للعرض عند محاولة البصم */
  warningMessage: string;
}

/**
 * خطأ مخصص يُرمى عند محاولة تسجيل أول بصمة في يوم إجازة معتمدة.
 * تلتقطه واجهة البصمة وتعرض مودال تأكيد ("تثبيت البصمة رغم ذلك").
 */
export class LeaveDayPunchWarning extends Error {
  readonly isLeaveDayWarning = true as const;
  readonly leaveType: string;
  readonly warningMessage: string;

  constructor(dayLeave: DayLeaveInfo) {
    super(dayLeave.warningMessage);
    this.name = 'LeaveDayPunchWarning';
    this.leaveType = dayLeave.leaveType;
    this.warningMessage = dayLeave.warningMessage;
  }
}

/** رسائل التنبيه المكيّفة حسب نوع الإجازة (تُعرض عند محاولة بصمة الحضور) */
const LEAVE_DAY_WARNING_MESSAGES: Record<string, string> = {
  regular: 'اليوم من أيام إجازتك الاعتيادية',
  long_regular: 'اليوم من أيام إجازتك الاعتيادية الطويلة',
  sick: 'اليوم من أيام إجازتك المرضية',
  duty: 'اليوم من أيام واجبك الرسمي المعتمد',
  dispatch: 'اليوم من أيام إيفادك المعتمد',
};

/** بناء رسالة تنبيه يوم الإجازة (مع بديل عام لأي نوع مستقبلي) */
export function buildLeaveDayWarningMessage(leaveType: string, label: string): string {
  return LEAVE_DAY_WARNING_MESSAGES[leaveType] || `اليوم من أيام ${label} المعتمدة`;
}

/** معلومات إجازة زمنية (بالساعات) ليوم محدد */
export interface TimeLeaveInfo {
  id: string;
  leaveType: 'time_off';
  /** mid_shift | shift_start | shift_end | null */
  subtype: string | null;
  minutes: number;
}

/** نتيجة مطابقة بصمات الخروج/العودة مع الإجازات الزمنية المطلوبة */
export interface TimeLeavePunchStatus {
  /** هل تتطلب الحالة بصمة خروج (مغادرة)؟ */
  needsOut: boolean;
  /** هل تتطلب الحالة بصمة عودة؟ */
  needsReturn: boolean;
  hasOut: boolean;
  hasReturn: boolean;
  missingOut: boolean;
  missingReturn: boolean;
  /** رسالة التحذير (null إذا كانت كل البصمات المطلوبة مثبتة) */
  message: string | null;
}

// ─── أدوات مساعدة ───────────────────────────────────────────────────────────

/** هل الطلب مقدَّم من الموظف (وليس عقوبة توليدية من النظام)؟ */
export function isRequestedLeave(req: LeaveRequestLite): boolean {
  return req.with_request !== false;
}

/** تاريخ اليوم بصيغة YYYY-MM-DD (بنفس أسلوب بقية النظام) */
export function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * هل يغطي الطلب التاريخ المحدد؟
 * دلالة end_date في قاعدة البيانات هي «يوم المباشرة المتوقعة» (خارج الإجازة):
 * نموذج الطلب يحسبها (البداية + عدد الأيام) ثم يدفعها بعد الجمعة/السبت/الأعياد،
 * لذا تكون الحدود حصرية (دون يوم المباشرة) متى تجاوزت يوم البداية.
 * أما إن ساوت يوم البداية أو كانت فارغة فالإجازة يوم واحد (كالزمنية والواجب والإيفاد).
 */
export function coversDate(req: LeaveRequestLite, dateStr: string): boolean {
  if (dateStr < req.start_date) return false;
  if (req.end_date && req.end_date > req.start_date) {
    return dateStr < req.end_date;
  }
  return dateStr === req.start_date;
}

/** دمج ملاحظة جديدة مع الملاحظات الحالية دون تكرار */
export function mergeNote(existing: string | undefined | null, addition: string): string {
  if (!existing) return addition;
  if (existing.includes(addition)) return existing;
  return `${existing} | ${addition}`;
}

/** بناء ملاحظة "دوام إضافي في يوم إجازة" مع ذكر نوع الإجازة */
export function buildLeaveDayOvertimeNote(label: string): string {
  return `${LEAVE_OVERTIME_NOTE_PREFIX} (${label})`;
}

/** هل تحتوي الملاحظات على مؤشر الدوام الإضافي في يوم إجازة؟ */
export function hasLeaveOvertimeNote(notes?: string | null): boolean {
  return !!notes && notes.includes(LEAVE_OVERTIME_NOTE_PREFIX);
}

function toDayLeaveInfo(req: LeaveRequestLite): DayLeaveInfo {
  const label = LEAVE_TYPE_LABELS[req.leave_type] || 'إجازة';
  return {
    id: req.id,
    leaveType: req.leave_type,
    label,
    warningMessage: buildLeaveDayWarningMessage(req.leave_type, label),
  };
}

function toTimeLeaveInfo(req: LeaveRequestLite): TimeLeaveInfo {
  return {
    id: req.id,
    leaveType: 'time_off',
    subtype: req.time_off_subtype || null,
    minutes: req.time_duration_minutes || 0,
  };
}

const LEAVE_SELECT_FIELDS =
  'id, user_id, leave_type, start_date, end_date, time_duration_minutes, time_off_subtype, with_request, is_mandatory, status';

// ─── فحوصات وقت البصمة ──────────────────────────────────────────────────────

/**
 * جلب إجازة اليوم المعتمدة التي تغطي يوماً كاملاً (اعتيادية/مرضية/واجب/إيفاد...)
 * للتوظيف في منطق تحقق البصمة. تُرجع null إن لم توجد.
 */
export async function getApprovedDayLeave(employeeId: string, dateStr: string): Promise<DayLeaveInfo | null> {
  const info = await getLeaveContext(employeeId, dateStr);
  return info.dayLeave;
}

/**
 * جلب جميع الإجازات المعتمدة (يوم كامل + زمنية) لتاريخ محدد —
 * تُستخدم في واجهة البصمة لعرض البانرات والتحذيرات.
 */
export async function getLeaveContext(
  employeeId: string,
  dateStr: string
): Promise<{ dayLeave: DayLeaveInfo | null; timeLeaves: TimeLeaveInfo[] }> {
  try {
    const { data, error } = await supabase
      .from('leave_requests')
      .select(LEAVE_SELECT_FIELDS)
      .eq('user_id', employeeId)
      .eq('status', 'approved')
      .lte('start_date', dateStr)
      .or(`end_date.gte.${dateStr},end_date.is.null`);

    if (error) throw error;

    const all = (data || []) as LeaveRequestLite[];
    const requested = all.filter(r => isRequestedLeave(r) && coversDate(r, dateStr));

    const dayLeaveReq = requested.find(r => DAY_LEAVE_TYPES.includes(r.leave_type));
    return {
      dayLeave: dayLeaveReq ? toDayLeaveInfo(dayLeaveReq) : null,
      timeLeaves: requested.filter(r => r.leave_type === 'time_off').map(toTimeLeaveInfo),
    };
  } catch (err) {
    console.error('[LeaveIntegration] فشل جلب حالة إجازات اليوم:', err);
    return { dayLeave: null, timeLeaves: [] };
  }
}

/**
 * جلب الإجازات المعتمدة لنطاق زمني (تقارير شهرية) لعدة موظفين دفعة واحدة.
 * تشمل الإجازات المقدمة من الموظفين فقط (بدون العقوبات التوليدية).
 */
export async function getApprovedLeavesInRange(
  startStr: string,
  endStr: string,
  userIds?: string[]
): Promise<LeaveRequestLite[]> {
  try {
    let query = supabase
      .from('leave_requests')
      .select(LEAVE_SELECT_FIELDS)
      .eq('status', 'approved')
      .neq('with_request', false)
      .lte('start_date', endStr)
      .or(`end_date.gte.${startStr},end_date.is.null`);

    if (userIds && userIds.length > 0) {
      query = query.in('user_id', userIds);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as LeaveRequestLite[];
  } catch (err) {
    console.error('[LeaveIntegration] فشل جلب إجازات النطاق الزمني:', err);
    return [];
  }
}

// ─── منطق مطابقة بصمات الإجازة الزمنية ─────────────────────────────────────

/**
 * تقييم التزام الموظف بإثبات بصمات الإجازة الزمنية:
 *  - وسط الدوام (mid_shift):  بصمة خروج + بصمة عودة.
 *  - بداية الدوام (shift_start): بصمة عودة فقط (أول بصمة دخول تُعتمد عودة).
 *  - نهاية الدوام (shift_end):  بصمة خروج فقط (بصمة الانصراف تُعتمد مغادرة).
 *
 * يُقيَّم التعويض لكل إجازة على حدة: بصمة الوصول تعوّض العودة في إجازات
 * "بداية الدوام" فقط، وبصمة الانصراف تعوّض الخروج في "نهاية الدوام" فقط —
 * إذ لا يثبت انصراف نهاية الدوام مغادرة إجازة وسط الدوام والعكس.
 *
 * تُرجع null إذا لم توجد إجازات زمنية، أو حالة مفصلة مع رسالة التحذير.
 */
export function evaluateTimeLeavePunches(
  record: AttendanceRecord | null | undefined,
  timeLeaves: TimeLeaveInfo[]
): TimeLeavePunchStatus | null {
  if (!timeLeaves || timeLeaves.length === 0) return null;

  let needsOut = false;
  let needsReturn = false;
  let missingOut = false;
  let missingReturn = false;

  for (const l of timeLeaves) {
    const leaveNeedsOut = l.subtype !== 'shift_start';
    const leaveNeedsReturn = l.subtype !== 'shift_end';

    needsOut = needsOut || leaveNeedsOut;
    needsReturn = needsReturn || leaveNeedsReturn;

    // بصمة خروج الراحة تُعتمد دائماً، أما بصمة الانصراف فتُعتمد خروجاً في
    // "نهاية الدوام" فقط (انصراف نهاية الدوام لا يثبت مغادرة إجازة وسط الدوام)
    const hasOut = !!(record?.time_leave_out || record?.time_leave_out_2) ||
      (l.subtype === 'shift_end' && !!record?.check_out);
    // بصمة عودة الراحة تُعتمد دائماً، أما بصمة الوصول فتُعتمد عودةً في
    // "بداية الدوام" فقط (وصول بداية الدوام لا يثبت عودة إجازة وسط الدوام)
    const hasReturn = !!(record?.time_leave_return || record?.time_leave_return_2) ||
      (l.subtype === 'shift_start' && !!record?.check_in);

    if (leaveNeedsOut && !hasOut) missingOut = true;
    if (leaveNeedsReturn && !hasReturn) missingReturn = true;
  }

  let message: string | null = null;
  const totalMinutes = timeLeaves.reduce((s, l) => s + (l.minutes || 0), 0);
  const dur = totalMinutes > 0 ? ` (${totalMinutes} دقيقة)` : '';

  if (missingOut && missingReturn) {
    message = `طلب إجازة زمنية${dur} لكنه لم يثبت بصمة خروج أو عودة`;
  } else if (missingOut) {
    message = `طلب إجازة زمنية${dur} لكنه لم يثبت بصمة خروج`;
  } else if (missingReturn) {
    message = `طلب إجازة زمنية${dur} لكنه لم يثبت بصمة عودة`;
  }

  return {
    needsOut,
    needsReturn,
    hasOut: needsOut ? !missingOut : true,
    hasReturn: needsReturn ? !missingReturn : true,
    missingOut,
    missingReturn,
    message
  };
}
