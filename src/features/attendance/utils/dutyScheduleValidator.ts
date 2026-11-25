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
import { temporaryWorkHoursService } from '../services/temporaryWorkHoursService';
import { resolveEffectiveDutyWindows, type EffectiveWorkHours } from './shiftScheduleUtils';

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
  isWeeklyExempt?: boolean;
  exemptionOrderNumber?: string;
  isSpecialSchedule?: boolean;
  effectiveWorkHours?: EffectiveWorkHours | null;
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
  const [profileRes, leaveCtx, dayType, exemptionRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('work_schedule_id, governorate')
      .eq('id', employeeId)
      .maybeSingle(),
    getLeaveContext(employeeId, dateStr),
    fetchDayType(dateStr),
    supabase
      .from('employee_weekly_exemptions')
      .select('id, day_of_week, order_number, order_date, valid_until')
      .eq('employee_id', employeeId)
      .gte('valid_until', dateStr)
  ]);

  const effectiveWorkHours = await temporaryWorkHoursService.getEffectiveWorkHoursForDate(
    dateStr,
    profileRes.data?.governorate || 'karbala'
  );

  let scheduleDays: DutyScheduleDay[] = [];
  let scheduleName: string | undefined;
  let workSchedule: any = null;
  let isSpecialSchedule = false;

  if (profileRes.data?.work_schedule_id) {
    const { data: ws } = await supabase
      .from('work_schedules')
      .select('id, name, type, is_default, days:work_schedule_days(day_of_week, is_rest_day, is_morning, is_evening, is_night, start_time, end_time)')
      .eq('id', profileRes.data.work_schedule_id)
      .maybeSingle();

    if (ws) {
      workSchedule = ws;
      scheduleName = ws.name;
      isSpecialSchedule = ws.type === 'special' || (Boolean(ws.name) && ws.name.includes('دوام خاص'));
      if (Array.isArray(ws.days)) {
        scheduleDays = ws.days;
      }
    }
  }

  // Calculate day of week for dateStr
  const targetDate = new Date(dateStr);
  const targetDow = targetDate.getDay();

  // Check if today matches any active exemption
  const activeExemption = (exemptionRes.data || []).find((ex: any) => 
    ex.day_of_week === targetDow && dateStr <= ex.valid_until && dateStr >= ex.order_date
  );

  const shiftType = determineShiftType(profileRes.data, workSchedule);

  return {
    employeeId,
    shiftType,
    scheduleName,
    scheduleDays,
    dayLeave: leaveCtx.dayLeave,
    isHolidayOrWeekend: dayType.isHolidayOrWeekend,
    dayTypeLabel: dayType.dayTypeLabel,
    loadedAt: Date.now(),
    isWeeklyExempt: Boolean(activeExemption),
    exemptionOrderNumber: activeExemption?.order_number,
    isSpecialSchedule,
    effectiveWorkHours
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
  const w = resolveEffectiveDutyWindows(ctx.effectiveWorkHours);

  // 0. فحص التفرغ الأسبوعي المعتمد بموجب أمر رسمي (أولوية مطلقة)
  if (ctx.isWeeklyExempt) {
    return {
      isWithinOfficialDuty: false,
      reason: ctx.exemptionOrderNumber 
        ? `الموظف في يوم تفرغ رسمي معتمد بموجب الأمر الإداري (${ctx.exemptionOrderNumber})`
        : 'الموظف في يوم تفرغ رسمي معتمد',
      badgeText: 'تفرغ رسمي',
      shiftType: ctx.shiftType,
      suggestedAction: 'prompt_override'
    };
  }

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

  // 1.5 فحص الدوام الخاص (Special Work Hours) إن وجد
  if (ctx.isSpecialSchedule && ctx.scheduleDays.length > 0) {
    const todaySchedule = ctx.scheduleDays.find(d => d.day_of_week === dow);
    if (todaySchedule?.is_rest_day) {
      return {
        isWithinOfficialDuty: false,
        reason: 'اليوم محدد كاستراحة أسبوعية في جدول الدوام الخاص للموظف',
        badgeText: 'استراحة خاصة',
        shiftType: 'morning',
        suggestedAction: 'prompt_override'
      };
    }

    if (todaySchedule?.start_time && todaySchedule?.end_time) {
      const startMins = parseTimeToMinutes(todaySchedule.start_time) || (8 * 60);
      const endMins = parseTimeToMinutes(todaySchedule.end_time) || (15 * 60);
      const allowedStart = Math.max(0, startMins - 30);
      const allowedEnd = endMins + 30;

      if (currentMinutes < allowedStart) {
        return {
          isWithinOfficialDuty: false,
          reason: `الوقت الحالي قبل بدء الدوام الخاص للموظف (يبدأ عند ${todaySchedule.start_time?.substring(0, 5)})`,
          badgeText: 'قبل بدء الدوام الخاص',
          shiftType: 'morning',
          suggestedAction: 'prompt_override'
        };
      }

      if (currentMinutes > allowedEnd) {
        return {
          isWithinOfficialDuty: false,
          reason: `الوقت الحالي بعد انتهاء الدوام الخاص للموظف (ينتهي عند ${todaySchedule.end_time?.substring(0, 5)})`,
          badgeText: 'بعد انتهاء الدوام الخاص',
          shiftType: 'morning',
          suggestedAction: 'prompt_override'
        };
      }

      return {
        isWithinOfficialDuty: true,
        reason: `ضمن أوقات الدوام الخاص الرسمي (${todaySchedule.start_time?.substring(0, 5)} إلى ${todaySchedule.end_time?.substring(0, 5)})`,
        badgeText: 'دوام خاص رسمي',
        shiftType: 'morning',
        suggestedAction: 'allow'
      };
    }
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

    // ساعات الدوام الصباحي الرسمي (تتزحف تلقائياً مع تعديل ساعات الدوام المؤقت):
    const MORNING_START_MINUTES = w.morningCheckInWindowStartMinutes;
    const MORNING_END_MINUTES = w.morningCheckoutMaxMinutes;

    if (currentMinutes < MORNING_START_MINUTES) {
      return {
        isWithinOfficialDuty: false,
        reason: `الوقت الحالي قبل بدء أوقات الدوام الرسمي الصباحي (يبدأ الدوام عند ${w.morningStart})`,
        badgeText: 'قبل بدء الدوام',
        shiftType: 'morning',
        suggestedAction: 'prompt_override'
      };
    }

    if (currentMinutes > MORNING_END_MINUTES) {
      return {
        isWithinOfficialDuty: false,
        reason: `الوقت الحالي خارج ساعات الدوام الرسمي الصباحي (ينتهي الدوام الصباحي عند ${w.morningEnd})`,
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
  if (currentMinutes <= w.nightEndMinutes + 30) {
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

  // 1. شفت صباحي للمناوب
  if (isMorning) {
    const startM = w.isOverridden ? w.morningCheckInWindowStartMinutes : (parseTimeToMinutes(todaySched.start_time) ?? w.morningCheckInWindowStartMinutes);
    const endM = w.isOverridden ? w.morningCheckoutMaxMinutes : (parseTimeToMinutes(todaySched.end_time) ?? w.morningCheckoutMaxMinutes);
    if (currentMinutes >= startM && currentMinutes <= endM) {
      isCurrentTimeInShift = true;
      activeShiftLabel = 'مناوبة صباحية';
    }
  }

  // 2. شفت مسائي للمناوب
  if (!isCurrentTimeInShift && isEvening) {
    const startM = w.isOverridden ? Math.max(0, w.eveningStartMinutes - 30) : (parseTimeToMinutes(todaySched.start_time) ?? Math.max(0, w.eveningStartMinutes - 30));
    const endM = w.isOverridden ? (w.eveningEndMinutes + 15) : (parseTimeToMinutes(todaySched.end_time) ?? (w.eveningEndMinutes + 15));
    if (currentMinutes >= startM && currentMinutes <= endM) {
      isCurrentTimeInShift = true;
      activeShiftLabel = 'مناوبة مسائية';
    }
  }

  // 3. شفت خفر للمناوب
  if (!isCurrentTimeInShift && isNight) {
    const startM = w.isOverridden ? Math.max(0, w.nightStartMinutes - 30) : (parseTimeToMinutes(todaySched.start_time) ?? Math.max(0, w.nightStartMinutes - 30));
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

  // إن كان مناوباً اليوم ولكن الساعة الحالية خارج الشفت
  const scheduledShiftsList: string[] = [];
  if (isMorning) scheduledShiftsList.push(`صباحي (${w.morningStart} - ${w.morningEnd})`);
  if (isEvening) scheduledShiftsList.push(`مسائي (${w.eveningStart} - ${w.eveningEnd})`);
  if (isNight) scheduledShiftsList.push(`خفر ليلي (${w.nightStart} - ${w.nightEnd})`);

  const shiftsDesc = scheduledShiftsList.join(' و ');

  return {
    isWithinOfficialDuty: false,
    reason: `أنت مناوب اليوم (${shiftsDesc})، ولكن الساعة الحالية ليست ضمن موعد مناوبتك`,
    badgeText: 'خارج وقت الشفت',
    shiftType: 'shift',
    suggestedAction: 'prompt_override'
  };
}
