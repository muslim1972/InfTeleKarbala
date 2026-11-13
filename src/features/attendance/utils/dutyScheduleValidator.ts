/**
 * dutyScheduleValidator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * محرك التحقق المسبق من أوقات وشفتات الدوام الرسمي (المرحلة A).
 * 
 * يتحقق قبل تشغيل الكاميرا من:
 *  1. نوع الدوام (صباحي اعتيادي أم مناوب).
 *  2. هل اليوم من أيام دوام الموظف (استراحة / عطلة نهاية أسبوع / عطلة رسمية / إجازة معتمدة).
 *  3. هل الساعة الحالية تقع ضمن نافذة الشفت المجدول للموظف.
 * 
 * النواة المعمارية: FE-ATT-01
 */

import { supabase } from '../../../lib/supabase';
import { getServerNow } from '../services/serverTimeService';
import { getBaghdadDate, determineShiftType, type ShiftType } from './shiftRules';
import { getLeaveContext, type DayLeaveInfo } from '../services/leaveIntegrationService';
import { fetchDayType } from '../../../lib/attendanceHelpers';

export interface DutyScheduleDay {
  day_of_week: number;
  is_rest_day: boolean;
  is_morning: boolean;
  is_evening: boolean;
  is_night: boolean;
  start_time?: string | null;
  end_time?: string | null;
}

export interface DutyContext {
  employeeId: string;
  shiftType: ShiftType;
  scheduleName?: string;
  scheduleDays: DutyScheduleDay[];
  dayLeave: DayLeaveInfo | null;
  isHolidayOrWeekend: boolean;
  dayTypeLabel: string;
  loadedAt: number;
}

export interface DutyEvaluationResult {
  isWithinOfficialDuty: boolean;
  reason: string;
  badgeText: string;
  shiftType: ShiftType;
  shiftName?: string;
  suggestedAction?: 'allow' | 'prompt_override';
}

function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * جلب سياق الدوام الكامل للموظف وتخزينه في الذاكرة لتنفيذ الفحص الفوري (0ms Latency)
 */
export async function loadDutyContext(employeeId: string, dateStr: string): Promise<DutyContext> {
  const [profileRes, leaveCtx, dayType] = await Promise.all([
    supabase
      .from('profiles')
      .select('work_schedule_id')
      .eq('id', employeeId)
      .maybeSingle(),
    getLeaveContext(employeeId, dateStr),
    fetchDayType(dateStr)
  ]);

  let scheduleDays: DutyScheduleDay[] = [];
  let scheduleName: string | undefined;
  let workSchedule: any = null;

  if (profileRes.data?.work_schedule_id) {
    const { data: ws } = await supabase
      .from('work_schedules')
      .select('id, name, type, is_default, days:work_schedule_days(day_of_week, is_rest_day, is_morning, is_evening, is_night, start_time, end_time)')
      .eq('id', profileRes.data.work_schedule_id)
      .maybeSingle();

    if (ws) {
      workSchedule = ws;
      scheduleName = ws.name;
      if (Array.isArray(ws.days)) {
        scheduleDays = ws.days;
      }
    }
  }

  const shiftType = determineShiftType(profileRes.data, workSchedule);

  return {
    employeeId,
    shiftType,
    scheduleName,
    scheduleDays,
    dayLeave: leaveCtx.dayLeave,
    isHolidayOrWeekend: dayType.isHolidayOrWeekend,
    dayTypeLabel: dayType.dayTypeLabel,
    loadedAt: Date.now()
  };
}

/**
 * تقييم حالة الدوام الرسمي اللحظية استناداً لسياق الدوام المسبق في الذاكرة ووقت بغداد المعتمد
 */
export function evaluateOfficialDutyStatus(
  ctx: DutyContext | null,
  now: Date = getServerNow()
): DutyEvaluationResult {
  // إذا لم يتوفر السياق بعد، نفترض السماح الاحتياطي
  if (!ctx) {
    return {
      isWithinOfficialDuty: true,
      reason: 'جاري فحص وتأكيد الجدول',
      badgeText: 'تحقق افتراضي',
      shiftType: 'morning',
      suggestedAction: 'allow'
    };
  }

  const baghdadNow = getBaghdadDate(now);
  const hours = baghdadNow.getHours();
  const minutes = baghdadNow.getMinutes();
  const currentMinutes = hours * 60 + minutes;
  const dow = baghdadNow.getDay(); // 0=الأحد, 1=الإثنين, ..., 5=الجمعة, 6=السبت
  const yesterdayDow = (dow + 6) % 7;

  // 1. فحص الإجازة المعتمدة ليوم كامل (اعتيادية، مرضية، واجب، إيفاد)
  if (ctx.dayLeave) {
    return {
      isWithinOfficialDuty: false,
      reason: ctx.dayLeave.warningMessage || `أنت في ${ctx.dayLeave.label} معتمدة اليوم`,
      badgeText: ctx.dayLeave.label || 'إجازة معتمدة',
      shiftType: ctx.shiftType,
      suggestedAction: 'prompt_override'
    };
  }

  // 2. معالجة الدوام الصباحي الاعتيادي (Morning Shift)
  if (ctx.shiftType === 'morning') {
    // عطلة نهاية الأسبوع (الجمعة والسبت)
    if (dow === 5 || dow === 6) {
      const weekendDayName = dow === 5 ? 'الجمعة' : 'السبت';
      return {
        isWithinOfficialDuty: false,
        reason: `اليوم عطلة نهاية الأسبوع (${weekendDayName})`,
        badgeText: 'عطلة نهاية الأسبوع',
        shiftType: 'morning',
        suggestedAction: 'prompt_override'
      };
    }

    // عطلة رسمية
    if (ctx.isHolidayOrWeekend) {
      return {
        isWithinOfficialDuty: false,
        reason: ctx.dayTypeLabel || 'اليوم عطلة رسمية معتمدة',
        badgeText: 'عطلة رسمية',
        shiftType: 'morning',
        suggestedAction: 'prompt_override'
      };
    }

    // ساعات الدوام الصباحي الرسمي:
    // استقبال الحضور يبدأ من 07:30 ص (450 دقيقة)
    // نهاية الدوام الرسمي عند 15:00 م (900 دقيقة) + مرونة حتى 15:15 م (915 دقيقة)
    const MORNING_START_MINUTES = 7 * 60 + 30;  // 07:30 ص
    const MORNING_END_MINUTES = 15 * 60 + 15;   // 03:15 م

    if (currentMinutes < MORNING_START_MINUTES) {
      return {
        isWithinOfficialDuty: false,
        reason: 'الوقت الحالي قبل بدء أوقات الدوام الرسمي الصباحي (يبدأ استقبال الحضور من 07:30 ص)',
        badgeText: 'قبل بدء الدوام',
        shiftType: 'morning',
        suggestedAction: 'prompt_override'
      };
    }

    if (currentMinutes > MORNING_END_MINUTES) {
      return {
        isWithinOfficialDuty: false,
        reason: 'الوقت الحالي خارج ساعات الدوام الرسمي الصباحي (ينتهي الدوام الصباحي عند 03:00 م)',
        badgeText: 'بعد نهاية الدوام',
        shiftType: 'morning',
        suggestedAction: 'prompt_override'
      };
    }

    return {
      isWithinOfficialDuty: true,
      reason: 'ضمن أوقات الدوام الصباحي الرسمي',
      badgeText: 'دوام صباحي رسمي',
      shiftType: 'morning',
      suggestedAction: 'allow'
    };
  }

  // 3. معالجة الدوام المناوب (Roster / Shifts)
  // أ. معالجة امتداد شفت الخفر عابر منتصف الليل (Cross-Midnight Night Shift)
  // شفت الخفر يبدأ 20:00 ليلاً ويمتد حتى 08:00 صباح اليوم التالي (بمرونة حتى 08:30 ص)
  if (currentMinutes <= 8 * 60 + 30) {
    const yesterdaySched = ctx.scheduleDays.find(d => d.day_of_week === yesterdayDow);
    if (yesterdaySched?.is_night) {
      return {
        isWithinOfficialDuty: true,
        reason: 'ضمن ساعات شفت الخفر الليلي (امتداد دوام الأمس)',
        badgeText: 'مناوب خفر ليلي',
        shiftType: 'shift',
        shiftName: 'خفر ليلي',
        suggestedAction: 'allow'
      };
    }
  }

  // ب. جدول اليوم الحالي في مصفوفة المناوبة
  const todaySched = ctx.scheduleDays.find(d => d.day_of_week === dow);

  if (!todaySched) {
    return {
      isWithinOfficialDuty: false,
      reason: 'ليس لديك جدول مناوبة مسجل لهذا اليوم',
      badgeText: 'خارج الجدول',
      shiftType: 'shift',
      suggestedAction: 'prompt_override'
    };
  }

  if (todaySched.is_rest_day) {
    return {
      isWithinOfficialDuty: false,
      reason: 'اليوم هو يوم استراحة في جدول مناوبتك المعتمد',
      badgeText: 'يوم استراحة',
      shiftType: 'shift',
      suggestedAction: 'prompt_override'
    };
  }

  // فحص الشفتات الفعالة لليوم
  const isMorning = Boolean(todaySched.is_morning);
  const isEvening = Boolean(todaySched.is_evening);
  const isNight = Boolean(todaySched.is_night);

  if (!isMorning && !isEvening && !isNight) {
    return {
      isWithinOfficialDuty: false,
      reason: 'لا توجد مناوبة مقررة لك في جدول اليوم',
      badgeText: 'بدون شفت مجدول',
      shiftType: 'shift',
      suggestedAction: 'prompt_override'
    };
  }

  // فحص توافق الساعة الحالية مع أي شفت مخصص لليوم
  let isCurrentTimeInShift = false;
  let activeShiftLabel = '';

  // 1. شفت صباحي للمناوب (08:00 - 15:00، استقبال من 07:30 إلى 15:15)
  if (isMorning) {
    const startM = parseTimeToMinutes(todaySched.start_time) ?? (7 * 60 + 30);
    const endM = parseTimeToMinutes(todaySched.end_time) ?? (15 * 60 + 15);
    if (currentMinutes >= startM && currentMinutes <= endM) {
      isCurrentTimeInShift = true;
      activeShiftLabel = 'مناوبة صباحية';
    }
  }

  // 2. شفت مسائي للمناوب (15:00 - 20:00، استقبال من 14:30 إلى 20:15)
  if (!isCurrentTimeInShift && isEvening) {
    const startM = parseTimeToMinutes(todaySched.start_time) ?? (14 * 60 + 30);
    const endM = parseTimeToMinutes(todaySched.end_time) ?? (20 * 60 + 15);
    if (currentMinutes >= startM && currentMinutes <= endM) {
      isCurrentTimeInShift = true;
      activeShiftLabel = 'مناوبة مسائية';
    }
  }

  // 3. شفت خفر للمناوب (20:00 - منتصف الليل، استقبال من 19:30 إلى 23:59)
  if (!isCurrentTimeInShift && isNight) {
    const startM = parseTimeToMinutes(todaySched.start_time) ?? (19 * 60 + 30);
    if (currentMinutes >= startM) {
      isCurrentTimeInShift = true;
      activeShiftLabel = 'مناوبة خفر ليلي';
    }
  }

  if (isCurrentTimeInShift) {
    return {
      isWithinOfficialDuty: true,
      reason: `أنت الآن ضمن وقت ${activeShiftLabel}`,
      badgeText: activeShiftLabel,
      shiftType: 'shift',
      shiftName: activeShiftLabel,
      suggestedAction: 'allow'
    };
  }

  // إن كان مناوباً اليوم ولكن الساعة الحالية خارج الشفت (مثلاً 11:00 صباحاً وهو مسائي يبدأ 15:00)
  const scheduledShiftsList: string[] = [];
  if (isMorning) scheduledShiftsList.push('صباحي (08:00 - 15:00)');
  if (isEvening) scheduledShiftsList.push('مسائي (15:00 - 20:00)');
  if (isNight) scheduledShiftsList.push('خفر ليلي (20:00 - 08:00)');

  const shiftsDesc = scheduledShiftsList.join(' و ');

  return {
    isWithinOfficialDuty: false,
    reason: `أنت مناوب اليوم (${shiftsDesc})، ولكن الساعة الحالية ليست ضمن موعد مناوبتك`,
    badgeText: 'خارج وقت الشفت',
    shiftType: 'shift',
    suggestedAction: 'prompt_override'
  };
}
