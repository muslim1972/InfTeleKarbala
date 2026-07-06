/**
 * ============================================================================
 *  طبقة الحساب المشتركة لنظام الحضور والانصراف (Attendance Calculation Layer)
 * ----------------------------------------------------------------------------
 *  هذه الطبقة هي المصدر الوحيد للحقيقة (Single Source of Truth) لكل الأرقام:
 *  صافي ساعات العمل، التأخير، الخروج المبكر، الإضافي، والحالة الحية.
 *  تُستخدم في اللوحة الحية (LiveAttendanceBoard) والجداول الزمنية (Timesheets)
 *  لضمان اتساق النتائج في كل مكان.
 * ============================================================================
 */

import type { AttendanceRecord } from '../types';

/** يوم واحد من جدول الدوام (work_schedule_days) */
export interface ScheduleDay {
  day_of_week: number; // 0 = الأحد ... 6 = السبت (متوافق مع Date.getDay())
  is_rest_day: boolean;
  start_time: string | null; // 'HH:mm' أو 'HH:mm:ss'
  end_time: string | null;
}

/** جدول دوام كامل (work_schedules + أيامه) */
export interface WorkScheduleFull {
  id: string;
  name: string;
  grace_period_minutes: number;
  days: ScheduleDay[];
}

/** الحالة الحية المشتقّة للموظف في لحظة معينة */
export type LiveStatus =
  | 'working'        // يعمل الآن
  | 'on_break'       // في استراحة/خروج زمني
  | 'late'           // حاضر لكنه تأخّر
  | 'checked_out'    // انصرف
  | 'absent'         // غائب (انتهى الدوام ولم يحضر)
  | 'not_checked_in' // لم يسجّل الحضور بعد
  | 'day_off';       // عطلة حسب جدوله

export interface LiveStatusInfo {
  status: LiveStatus;
  label: string;
  /** لون دلالي للحالة (hex) */
  color: string;
  /** دقائق العمل الصافية حتى الآن */
  workedMinutes: number;
  /** دقائق التأخير */
  lateMinutes: number;
  /** هل هو ضمن فترة استراحة نشطة */
  onActiveBreak: boolean;
}

export interface DayComputation {
  workedMinutes: number;
  breakMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  expectedMinutes: number;
  isRestDay: boolean;
  hasCheckIn: boolean;
  hasCheckOut: boolean;
}

// ---------------------------------------------------------------------------
//  أدوات مساعدة زمنية
// ---------------------------------------------------------------------------

/** يحوّل 'HH:mm' أو 'HH:mm:ss' إلى دقائق منذ منتصف الليل */
export function timeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const parts = time.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] ?? '0', 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** الفرق بالدقائق بين طابعين زمنيين (ISO strings) — دائماً ≥ 0 */
export function diffMinutes(from?: string | null, to?: string | null): number {
  if (!from || !to) return 0;
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (Number.isNaN(ms) || ms < 0) return 0;
  return Math.floor(ms / 60000);
}

/** دقائق التاريخ منذ منتصف الليل بالتوقيت المحلي */
function localMinutesOfDay(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

// ---------------------------------------------------------------------------
//  استخراج يوم الجدول المناسب لتاريخ معيّن
// ---------------------------------------------------------------------------

export function getScheduleDay(
  schedule: WorkScheduleFull | null | undefined,
  date: Date
): ScheduleDay | null {
  if (!schedule || !schedule.days || schedule.days.length === 0) return null;
  const dow = date.getDay();
  return schedule.days.find((d) => d.day_of_week === dow) ?? null;
}

// ---------------------------------------------------------------------------
//  حساب فترة الاستراحة (الخروج الزمني)
// ---------------------------------------------------------------------------

export function computeBreakMinutes(
  record: Pick<AttendanceRecord, 'time_leave_out' | 'time_leave_return'>
): number {
  return diffMinutes(record.time_leave_out, record.time_leave_return);
}

// ---------------------------------------------------------------------------
//  صافي دقائق العمل = (الخروج - الدخول) - الاستراحة
// ---------------------------------------------------------------------------

export function computeWorkedMinutes(
  record: Pick<AttendanceRecord, 'check_in' | 'check_out' | 'time_leave_out' | 'time_leave_return'>,
  now: Date = new Date()
): number {
  if (!record.check_in) return 0;
  const end = record.check_out ?? now.toISOString();
  const gross = diffMinutes(record.check_in, end);
  const brk = computeBreakMinutes(record);
  return Math.max(0, gross - brk);
}

// ---------------------------------------------------------------------------
//  دقائق التأخير عن موعد بدء الدوام (مع مراعاة فترة السماح)
// ---------------------------------------------------------------------------

export function computeLateMinutes(
  record: Pick<AttendanceRecord, 'check_in'>,
  scheduleDay: ScheduleDay | null,
  gracePeriodMinutes = 0
): number {
  if (!record.check_in || !scheduleDay || scheduleDay.is_rest_day) return 0;
  const start = timeToMinutes(scheduleDay.start_time);
  const checkIn = localMinutesOfDay(record.check_in);
  if (start === null || checkIn === null) return 0;
  const late = checkIn - (start + gracePeriodMinutes);
  return late > 0 ? late : 0;
}

// ---------------------------------------------------------------------------
//  دقائق الخروج المبكر قبل انتهاء الدوام
// ---------------------------------------------------------------------------

export function computeEarlyLeaveMinutes(
  record: Pick<AttendanceRecord, 'check_out'>,
  scheduleDay: ScheduleDay | null
): number {
  if (!record.check_out || !scheduleDay || scheduleDay.is_rest_day) return 0;
  const end = timeToMinutes(scheduleDay.end_time);
  const checkOut = localMinutesOfDay(record.check_out);
  if (end === null || checkOut === null) return 0;
  const early = end - checkOut;
  return early > 0 ? early : 0;
}

// ---------------------------------------------------------------------------
//  دقائق الإضافي — نعتمد القيمة المخزّنة إن وُجدت وإلا نحسبها من الجدول
// ---------------------------------------------------------------------------

export function computeOvertimeMinutes(
  record: Pick<AttendanceRecord, 'check_out' | 'overtime_minutes'>,
  scheduleDay: ScheduleDay | null
): number {
  if (typeof record.overtime_minutes === 'number' && record.overtime_minutes > 0) {
    return record.overtime_minutes;
  }
  if (!record.check_out || !scheduleDay || scheduleDay.is_rest_day) return 0;
  const end = timeToMinutes(scheduleDay.end_time);
  const checkOut = localMinutesOfDay(record.check_out);
  if (end === null || checkOut === null) return 0;
  const over = checkOut - end;
  return over > 0 ? over : 0;
}

// ---------------------------------------------------------------------------
//  الدقائق المتوقّعة للعمل في هذا اليوم حسب الجدول
// ---------------------------------------------------------------------------

export function computeExpectedMinutes(scheduleDay: ScheduleDay | null): number {
  if (!scheduleDay || scheduleDay.is_rest_day) return 0;
  const start = timeToMinutes(scheduleDay.start_time);
  const end = timeToMinutes(scheduleDay.end_time);
  if (start === null || end === null || end <= start) return 0;
  return end - start;
}

// ---------------------------------------------------------------------------
//  حساب يوم كامل (يُستخدم في الجداول الزمنية)
// ---------------------------------------------------------------------------

export function computeDay(
  record: AttendanceRecord | null,
  schedule: WorkScheduleFull | null,
  date: Date,
  now: Date = new Date()
): DayComputation {
  const scheduleDay = getScheduleDay(schedule, date);
  const grace = schedule?.grace_period_minutes ?? 0;
  const isRestDay = scheduleDay?.is_rest_day ?? false;
  const expectedMinutes = computeExpectedMinutes(scheduleDay);

  if (!record) {
    return {
      workedMinutes: 0,
      breakMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      expectedMinutes,
      isRestDay,
      hasCheckIn: false,
      hasCheckOut: false,
    };
  }

  return {
    workedMinutes: computeWorkedMinutes(record, now),
    breakMinutes: computeBreakMinutes(record),
    lateMinutes: computeLateMinutes(record, scheduleDay, grace),
    earlyLeaveMinutes: computeEarlyLeaveMinutes(record, scheduleDay),
    overtimeMinutes: computeOvertimeMinutes(record, scheduleDay),
    expectedMinutes,
    isRestDay,
    hasCheckIn: Boolean(record.check_in),
    hasCheckOut: Boolean(record.check_out),
  };
}

// ---------------------------------------------------------------------------
//  اشتقاق الحالة الحية للموظف (قلب اللوحة الحية)
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<LiveStatus, string> = {
  working: '#10b981',        // أخضر
  on_break: '#f59e0b',       // كهرماني
  late: '#f97316',           // برتقالي
  checked_out: '#64748b',    // رمادي
  absent: '#ef4444',         // أحمر
  not_checked_in: '#94a3b8', // رمادي فاتح
  day_off: '#8b5cf6',        // بنفسجي
};

const STATUS_LABELS: Record<LiveStatus, string> = {
  working: 'يعمل الآن',
  on_break: 'في استراحة',
  late: 'متأخر',
  checked_out: 'منصرف',
  absent: 'غائب',
  not_checked_in: 'لم يحضر بعد',
  day_off: 'عطلة',
};

export function statusLabel(status: LiveStatus): string {
  return STATUS_LABELS[status];
}

export function statusColor(status: LiveStatus): string {
  return STATUS_COLORS[status];
}

export function deriveLiveStatus(
  record: AttendanceRecord | null,
  schedule: WorkScheduleFull | null,
  now: Date = new Date()
): LiveStatusInfo {
  const scheduleDay = getScheduleDay(schedule, now);
  const grace = schedule?.grace_period_minutes ?? 0;

  const build = (status: LiveStatus, extra?: Partial<LiveStatusInfo>): LiveStatusInfo => ({
    status,
    label: STATUS_LABELS[status],
    color: STATUS_COLORS[status],
    workedMinutes: record ? computeWorkedMinutes(record, now) : 0,
    lateMinutes: record ? computeLateMinutes(record, scheduleDay, grace) : 0,
    onActiveBreak: false,
    ...extra,
  });

  // عطلة حسب الجدول ولا يوجد أي تسجيل
  if (scheduleDay?.is_rest_day && !record?.check_in) {
    return build('day_off');
  }

  // لا يوجد سجل أو لم يسجّل الدخول
  if (!record || !record.check_in) {
    const end = timeToMinutes(scheduleDay?.end_time ?? null);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (end !== null && nowMin > end && !scheduleDay?.is_rest_day) {
      return build('absent');
    }
    return build('not_checked_in');
  }

  // انصرف
  if (record.check_out) {
    return build('checked_out');
  }

  // في استراحة (خرج زمنياً ولم يعُد)
  if (record.time_leave_out && !record.time_leave_return) {
    return build('on_break', { onActiveBreak: true });
  }

  // حاضر — متأخر أم يعمل بشكل طبيعي؟
  const late = computeLateMinutes(record, scheduleDay, grace);
  if (late > 0) {
    return build('late', { lateMinutes: late });
  }
  return build('working');
}

// ---------------------------------------------------------------------------
//  تنسيق المدة بالعربية (مثال: "4س 12د")
// ---------------------------------------------------------------------------

export function formatDurationAr(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return '0د';
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `${m}د`;
  if (m === 0) return `${h}س`;
  return `${h}س ${m}د`;
}

/** تنسيق دقيق للعدّاد الحي (مثال: "04:12:35") بإعطاء الثواني */
export function formatClock(totalSeconds: number): string {
  if (totalSeconds < 0) totalSeconds = 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** تحويل الدقائق لساعات عشرية (مثال: 450 => 7.5) */
export function minutesToHours(totalMinutes: number): number {
  return Math.round((totalMinutes / 60) * 100) / 100;
}
