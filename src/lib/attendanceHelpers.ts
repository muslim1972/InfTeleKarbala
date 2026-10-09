import { supabase } from './supabase';

// ─── توقيت بغداد المعتمد (UTC+3 ثابت بلا توقيت صيفي) ───
// كل منطق «أي يوم نحن فيه» في البصمة يجب أن يمر عبر هذه المساعدات
// ولا يستخدم toISOString مباشرة لأنها تعيد تاريخ UTC (يتأخر 3 ساعات عن بغداد).
export const BAGHDAD_TZ = 'Asia/Baghdad';

/** تاريخ اليوم بتوقيت بغداد بصيغة YYYY-MM-DD */
export function baghdadDateStr(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BAGHDAD_TZ }).format(d);
}

/** نافذة يوم بغداد كاملة (00:00:00.000 — 23:59:59.999) محولة إلى ISO/UTC للاستعلام */
export function baghdadDayRange(dateStr: string): { startIso: string; endIso: string } {
  // بغداد بدون توقيت صيفي، لذا الإزاحة +03:00 ثابتة وآمنة
  const start = new Date(`${dateStr}T00:00:00.000+03:00`);
  const end = new Date(`${dateStr}T23:59:59.999+03:00`);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/** اسم اليوم بالعربية لتاريخ معين (dateStr بصيغة YYYY-MM-DD) */
export function arabicDayNameForDate(dateStr: string): string {
  const dayNamesArabic = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const d = new Date(`${dateStr}T00:00:00+03:00`);
  return dayNamesArabic[d.getDay()];
}

export type LiveEmployeeStatus =
  | 'working'
  | 'on_break'
  | 'checked_out'
  | 'missing_checkout'
  | 'late'
  | 'on_leave'
  | 'on_duty'
  | 'upcoming_shift'
  | 'absent';

export interface ScheduledEmployeeLiveInfo {
  id: string;
  fullName: string;
  jobNumber?: string;
  departmentId?: string;
  departmentName: string;
  shiftLabel: string;
  shiftType: 'morning' | 'shift';
  expectedStart: string;
  expectedEnd: string;
  checkIn?: string | null;
  checkOut?: string | null;
  timeLeaveOut?: string | null;
  timeLeaveReturn?: string | null;
  isDevicePending?: boolean;
  workedMinutes: number;
  liveStatus: LiveEmployeeStatus;
  liveStatusLabel: string;
  leaveInfo?: {
    id: string;
    leaveType: string;
    subtype?: string | null;
    destination?: string | null;
    reason?: string | null;
  } | null;
  notes?: string;
}

export interface DailyAttendanceStats {
  absentCount: number;
  totalScheduled: number;
  dayTypeLabel: string;
  isHolidayOrWeekend: boolean;
  holidayName?: string | null;
  scheduledEmployees: Array<{
    id: string;
    fullName: string;
    jobNumber?: string;
    shiftLabel: string;
    departmentId?: string;
  }>;
  // Extended rich fields
  allEmployees: ScheduledEmployeeLiveInfo[];
  totalPresent: number;
  activeNow: number;
  onBreak: number;
  completedDuty: number;
  missingCheckout: number;
  lateCount: number;
  onLeaveCount: number;
  onDutyCount: number;
  upcomingShiftCount: number;
  coveragePercent: number;
  departments: Array<{ id: string; name: string }>;
  dayPhase: 'morning_arrival' | 'core_hours' | 'afternoon_checkout' | 'evening_shift' | 'night_shift';
  dayPhaseLabel: string;
}

export async function fetchDailyAttendanceStats(dateStr: string, gov: string): Promise<DailyAttendanceStats> {
  const dayOfWeek = new Date(`${dateStr}T00:00:00+03:00`).getDay();
  const dayNamesEng = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayNamesArabic = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const todayEng = dayNamesEng[dayOfWeek];
  const todayAr = dayNamesArabic[dayOfWeek];

  const startIso = new Date(`${dateStr}T00:00:00.000+03:00`).toISOString();
  const endIso = new Date(`${dateStr}T23:59:59.999+03:00`).toISOString();

  // 1. Fetch active profiles for governorate
  let profilesQuery = supabase
    .from('profiles')
    .select('id, full_name, job_number, work_schedule_id, governorate, department_id')
    .eq('role', 'user');

  if (gov && gov !== 'all') {
    profilesQuery = profilesQuery.eq('governorate', gov);
  }

  const [
    profilesRes,
    recordsRes,
    leavesRes,
    departmentsRes,
    scheduleDaysRes,
    settingsRes,
    holidaysRes
  ] = await Promise.all([
    profilesQuery,
    supabase
      .from('attendance_records')
      .select('id, employee_id, check_in, check_out, time_leave_out, time_leave_return, status, notes, is_device_pending, created_at')
      .gte('created_at', startIso)
      .lte('created_at', endIso),
    supabase
      .from('leave_requests')
      .select('id, user_id, leave_type, time_off_subtype, destination, notes, start_date, end_date')
      .eq('status', 'approved')
      .lte('start_date', dateStr)
      .gte('end_date', dateStr),
    supabase.from('departments').select('id, name'),
    supabase
      .from('work_schedule_days')
      .select('schedule_id, day_of_week, is_rest_day, is_morning, is_evening, is_night, start_time, end_time')
      .eq('day_of_week', dayOfWeek),
    supabase.from('attendance_settings').select('weekend_days').limit(1).single(),
    supabase
      .from('official_holidays')
      .select('name, start_date, end_date')
      .lte('start_date', dateStr)
      .gte('end_date', dateStr)
  ]);

  const allProfiles = profilesRes.data || [];
  const weekendDays = settingsRes.data?.weekend_days || ['Friday', 'Saturday'];
  const isWeekend = weekendDays.includes(todayEng);
  const matchedHoliday = (holidaysRes.data && holidaysRes.data.length > 0) ? holidaysRes.data[0] : null;
  const isHolidayOrWeekend = isWeekend || !!matchedHoliday;

  let dayTypeLabel = `دوام رسمي اعتيادي (${todayAr})`;
  if (matchedHoliday) {
    dayTypeLabel = `عطلة رسمية: ${matchedHoliday.name}`;
  } else if (isWeekend) {
    dayTypeLabel = `عطلة نهاية الأسبوع (${todayAr})`;
  }

  const scheduleDaysMap = new Map<string, any>();
  (scheduleDaysRes.data || []).forEach((sd: any) => {
    scheduleDaysMap.set(sd.schedule_id, sd);
  });

  const deptMap = new Map<string, string>();
  const departmentsList: Array<{ id: string; name: string }> = [];
  (departmentsRes.data || []).forEach((d: any) => {
    deptMap.set(d.id, d.name);
    departmentsList.push({ id: d.id, name: d.name });
  });

  const scheduledEmployees: Array<{ id: string; fullName: string; jobNumber?: string; shiftLabel: string; departmentId?: string }> = [];

  for (const p of allProfiles) {
    const schedId = p.work_schedule_id;
    const daySched = schedId ? scheduleDaysMap.get(schedId) : null;

    if (isHolidayOrWeekend) {
      if (daySched && !daySched.is_rest_day) {
        const hasShift = daySched.is_morning || daySched.is_evening || daySched.is_night;
        if (hasShift) {
          let shiftLabel = 'مناوبة';
          if (daySched.is_morning && daySched.is_evening && daySched.is_night) shiftLabel = 'نوبة كاملة 24 س';
          else if (daySched.is_morning && daySched.is_evening) shiftLabel = 'صباحي + مسائي';
          else if (daySched.is_evening && daySched.is_night) shiftLabel = 'مسائي + خفر';
          else if (daySched.is_morning) shiftLabel = 'صباحي';
          else if (daySched.is_evening) shiftLabel = 'مسائي';
          else if (daySched.is_night) shiftLabel = 'خفر / ليلي';

          scheduledEmployees.push({
            id: p.id,
            fullName: p.full_name || 'موظف',
            jobNumber: p.job_number,
            shiftLabel,
            departmentId: p.department_id
          });
        }
      }
    } else {
      if (daySched && daySched.is_rest_day) {
        continue;
      }
      let shiftLabel = 'دوام صباحي';
      if (daySched) {
        if (daySched.is_morning && daySched.is_evening && daySched.is_night) shiftLabel = 'نوبة كاملة 24 س';
        else if (daySched.is_morning && daySched.is_evening) shiftLabel = 'صباحي + مسائي';
        else if (daySched.is_evening && daySched.is_night) shiftLabel = 'مسائي + خفر';
        else if (daySched.is_evening) shiftLabel = 'مسائي';
        else if (daySched.is_night) shiftLabel = 'خفر / ليلي';
      }
      scheduledEmployees.push({
        id: p.id,
        fullName: p.full_name || 'موظف',
        jobNumber: p.job_number,
        shiftLabel,
        departmentId: p.department_id
      });
    }
  }

  // Baghdad current time calculations
  const baghdadNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Baghdad' }));
  const currentHour = baghdadNow.getHours();
  const currentMinute = baghdadNow.getMinutes();
  const currentTotalMins = currentHour * 60 + currentMinute;

  let dayPhase: 'morning_arrival' | 'core_hours' | 'afternoon_checkout' | 'evening_shift' | 'night_shift' = 'core_hours';
  let dayPhaseLabel = 'ساعات العمل الرئيسية';

  if (currentTotalMins >= 360 && currentTotalMins < 540) { // 06:00 - 09:00
    dayPhase = 'morning_arrival';
    dayPhaseLabel = 'فترة التوافد وتسجيل الدخول الصباحي';
  } else if (currentTotalMins >= 540 && currentTotalMins < 840) { // 09:00 - 14:00
    dayPhase = 'core_hours';
    dayPhaseLabel = 'ساعات العمل الرئيسية واستقرار الدوام';
  } else if (currentTotalMins >= 840 && currentTotalMins < 930) { // 14:00 - 15:30
    dayPhase = 'afternoon_checkout';
    dayPhaseLabel = 'فترة الانصراف الصباحي واستلام المناوبة';
  } else if (currentTotalMins >= 930 && currentTotalMins < 1200) { // 15:30 - 20:00
    dayPhase = 'evening_shift';
    dayPhaseLabel = 'فترة المناوبة المسائية (انتهاء الدوام الصباحي)';
  } else { // 20:00 - 06:00
    dayPhase = 'night_shift';
    dayPhaseLabel = 'فترة الخفر والمناوبة الليلية';
  }

  const recordsMap = new Map<string, any>();
  (recordsRes.data || []).forEach((r: any) => {
    recordsMap.set(r.employee_id, r);
  });

  const leavesMap = new Map<string, any>();
  (leavesRes.data || []).forEach((l: any) => {
    leavesMap.set(l.user_id, l);
  });

  const allEmployees: ScheduledEmployeeLiveInfo[] = [];

  let totalPresent = 0;
  let activeNow = 0;
  let onBreak = 0;
  let completedDuty = 0;
  let missingCheckout = 0;
  let lateCount = 0;
  let onLeaveCount = 0;
  let onDutyCount = 0;
  let absentCount = 0;
  let upcomingShiftCount = 0;

  for (const emp of scheduledEmployees) {
    const rec = recordsMap.get(emp.id);
    const leave = leavesMap.get(emp.id);
    const deptName = deptMap.get(emp.departmentId || '') || 'بدون قسم';

    let liveStatus: LiveEmployeeStatus = 'absent';
    let liveStatusLabel = 'غائب غير مبرر';
    let workedMinutes = 0;

    let expStart = '08:00';
    let expEnd = '15:00';
    let cutoffMin = 930; // 15:30

    if (emp.shiftLabel === 'مسائي') {
      expStart = '14:30';
      expEnd = '20:00';
      cutoffMin = 1230; // 20:30
    } else if (emp.shiftLabel === 'خفر / ليلي') {
      expStart = '20:00';
      expEnd = '08:00';
      cutoffMin = 510;
    } else if (emp.shiftLabel === 'نوبة كاملة 24 س') {
      expStart = '08:00';
      expEnd = '08:00';
      cutoffMin = 510;
    }

    if (rec) {
      totalPresent++;
      if (rec.status === 'late') lateCount++;

      if (rec.check_in) {
        const inDate = new Date(rec.check_in);
        const outDate = rec.check_out ? new Date(rec.check_out) : baghdadNow;
        let mins = Math.max(0, Math.floor((outDate.getTime() - inDate.getTime()) / 60000));
        if (rec.time_leave_out && rec.time_leave_return) {
          const lOut = new Date(rec.time_leave_out);
          const lRet = new Date(rec.time_leave_return);
          mins = Math.max(0, mins - Math.floor((lRet.getTime() - lOut.getTime()) / 60000));
        }
        workedMinutes = mins;
      }

      if (rec.check_out) {
        liveStatus = 'checked_out';
        liveStatusLabel = 'أكمل دوامه وانصرف';
        completedDuty++;
      } else if (rec.time_leave_out && !rec.time_leave_return) {
        liveStatus = 'on_break';
        liveStatusLabel = 'في استراحة / زمنية';
        onBreak++;
        activeNow++;
      } else {
        const isPastShiftEnd = (emp.shiftLabel === 'مسائي')
          ? (currentTotalMins >= cutoffMin)
          : (emp.shiftLabel === 'خفر / ليلي' || emp.shiftLabel === 'نوبة كاملة 24 س')
            ? false
            : (currentTotalMins >= cutoffMin);

        if (isPastShiftEnd) {
          liveStatus = 'missing_checkout';
          liveStatusLabel = 'معلق (لم يسجل انصراف)';
          missingCheckout++;
        } else if (rec.status === 'late') {
          liveStatus = 'late';
          liveStatusLabel = 'متأخر (على رأس العمل)';
          activeNow++;
        } else {
          liveStatus = 'working';
          liveStatusLabel = 'على رأس العمل الآن';
          activeNow++;
        }
      }
    } else if (leave) {
      if (leave.leave_type === 'duty' || leave.leave_type === 'dispatch') {
        liveStatus = 'on_duty';
        liveStatusLabel = leave.leave_type === 'dispatch' ? 'إيفاد رسمي' : 'واجب رسمي';
        onDutyCount++;
      } else {
        liveStatus = 'on_leave';
        const typeLabels: Record<string, string> = {
          regular: 'إجازة اعتيادية',
          long_regular: 'إجازة خمس سنوات',
          sick: 'إجازة مرضية',
          long_sick: 'مرضية طويلة',
          time_off: 'إجازة زمنية'
        };
        liveStatusLabel = typeLabels[leave.leave_type] || 'مجاز رسمياً';
        onLeaveCount++;
      }
    } else {
      const isBeforeShift = (emp.shiftLabel === 'خفر / ليلي' && currentTotalMins < 1200) ||
                            (emp.shiftLabel === 'مسائي' && currentTotalMins < 870) ||
                            (emp.shiftLabel.includes('صباحي') && currentTotalMins < 480) ||
                            (emp.shiftLabel === 'نوبة كاملة 24 س' && currentTotalMins < 480);
      if (isBeforeShift) {
        liveStatus = 'upcoming_shift';
        liveStatusLabel = `بانتظار بدء المناوبة (${expStart})`;
        upcomingShiftCount++;
      } else {
        liveStatus = 'absent';
        liveStatusLabel = 'غائب غير مبرر';
        absentCount++;
      }
    }

    allEmployees.push({
      id: emp.id,
      fullName: emp.fullName,
      jobNumber: emp.jobNumber,
      departmentId: emp.departmentId,
      departmentName: deptName,
      shiftLabel: emp.shiftLabel,
      shiftType: emp.shiftLabel.includes('صباحي') ? 'morning' : 'shift',
      expectedStart: expStart,
      expectedEnd: expEnd,
      checkIn: rec?.check_in || null,
      checkOut: rec?.check_out || null,
      timeLeaveOut: rec?.time_leave_out || null,
      timeLeaveReturn: rec?.time_leave_return || null,
      isDevicePending: rec?.is_device_pending || rec?.notes?.includes('جهاز غير معتمد'),
      workedMinutes,
      liveStatus,
      liveStatusLabel,
      leaveInfo: leave ? {
        id: leave.id,
        leaveType: leave.leave_type,
        subtype: leave.time_off_subtype,
        destination: leave.destination,
        reason: leave.notes
      } : null,
      notes: rec?.notes || (liveStatus === 'missing_checkout' ? 'انتهت ساعات الدوام الرسمي دون تسجيل بصمة انصراف' : undefined)
    });
  }

  const coveredCount = totalPresent + onLeaveCount + onDutyCount;
  const coveragePercent = Math.round((coveredCount / (scheduledEmployees.length || 1)) * 100);

  return {
    absentCount,
    totalScheduled: scheduledEmployees.length,
    dayTypeLabel,
    isHolidayOrWeekend,
    holidayName: matchedHoliday?.name,
    scheduledEmployees,
    allEmployees,
    totalPresent,
    activeNow,
    onBreak,
    completedDuty,
    missingCheckout,
    lateCount,
    onLeaveCount,
    onDutyCount,
    upcomingShiftCount,
    coveragePercent,
    departments: departmentsList,
    dayPhase,
    dayPhaseLabel
  };
}

export async function fetchTrueAbsentCount(dateStr: string, gov: string): Promise<number> {
  const stats = await fetchDailyAttendanceStats(dateStr, gov);
  return stats.absentCount;
}

/** فحص خفيف لنوع اليوم (عطلة نهاية أسبوع/رسمية) — بديل fetchDailyAttendanceStats في مسار تسجيل البصمة */
export async function fetchDayType(dateStr: string): Promise<{ isHolidayOrWeekend: boolean; dayTypeLabel: string }> {
  const dayOfWeek = new Date(`T00:00:00+03:00`).getDay();
  const dayNamesEng = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayNamesArabic = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const [settingsRes, holidaysRes] = await Promise.all([
    supabase.from('attendance_settings').select('weekend_days').limit(1).single(),
    supabase.from('official_holidays').select('name').lte('start_date', dateStr).gte('end_date', dateStr).limit(1),
  ]);
  const weekendDays: string[] = settingsRes.data?.weekend_days || ['Friday', 'Saturday'];
  const holiday = holidaysRes.data && holidaysRes.data.length > 0 ? holidaysRes.data[0] : null;
  const isWeekend = weekendDays.includes(dayNamesEng[dayOfWeek]);
  const dayTypeLabel = holiday ? `عطلة رسمية: ${holiday.name}` : isWeekend ? `عطلة نهاية الأسبوع (${dayNamesArabic[dayOfWeek]})` : `دوام رسمي اعتيادي (${dayNamesArabic[dayOfWeek]})`;
  return { isHolidayOrWeekend: isWeekend || !!holiday, dayTypeLabel };
}
