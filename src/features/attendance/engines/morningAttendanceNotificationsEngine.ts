/**
 * morningAttendanceNotificationsEngine.ts
 * المحرك الحتمي النقي لتقييم وصياغة إشعارات البصمة (صباحي، مناوبات ممتدة، إجازات زمنية)
 * مديرية اتصالات ومعلوماتية كربلاء — إطار عمل B.R.I.C.K (النواة المعمارية FE-ATT-01 / OPS-03)
 * 
 * القواعد الصارمة المطبقة:
 * 1. الدوام الصباحي الطبيعي (06:00 إلى 08:30) وانصراف (14:30 فما فوق): بدون أي إشعار.
 * 2. التأخير الصباحي (ابتداءً من 08:31): حساب الفرق بالدقائق وإشعار الموظف والمسؤول وبديله.
 * 3. الانصراف المبكر (قبل 14:30): حساب الفرق بالدقائق وإشعار الموظف والمسؤول وبديله.
 * 4. صباحي ممتد بعد خفر ليلة أمس: سماحية كاملة من 08:00 إلى 09:00 دون أي إشعار تأخير.
 * 5. صباحي متبوع بمسائي ممتد: سماحية إثبات حضور من 14:30 إلى 15:30 دون أي إشعار.
 * 6. خفر منتصف الليل: سماحية إثبات حضور بين 23:30 و 00:30 دون أي إشعار.
 * 7. الإجازات الزمنية (بداية، وسط، نهاية):
 *    - ضمن الفترة المعتمدة: طبيعي بدون إشعار.
 *    - تجاوز أو تبكير عن المستحق: إشعار الموظف والمسؤول والبديل بصيغ مخصصة.
 * 8. الإعفاءات التامة: العطل، الإجازات المعتمدة، الواجب الرسمي، الإيفاد، الاستراحة، والتعويضيات.
 * 9. الفحص البعدي بأثر رجعي للبصمات المفقودة (ما لم يتم تثبيته):
 *    - نقص إثبات حضور بين الصباحي والمسائي (14:30 - 15:30).
 *    - نقص إثبات حضور منتصف الليل للخفر (23:30 - 00:30).
 *    حقن بصمة افتراضية حمراء وإرسال إشعار نقص التواجد للموظف والمسؤول والبديل.
 */

import { getBaghdadMinutes } from './rosterAttendanceEngine';

export interface PunchTimeInfo {
  time: string; // ISO string
  location?: string | null;
  device_id?: string | null;
  verified_by_biometric?: boolean;
  is_virtual?: boolean;
}

export interface ApprovedTimeOffInfo {
  id: string;
  leave_type: string;
  time_off_subtype?: 'shift_start' | 'mid_shift' | 'shift_end' | string | null;
  start_date: string;
  leave_start_time?: string | null; // HH:mm:ss
  leave_end_time?: string | null;   // HH:mm:ss
  time_duration_minutes?: number | null;
  status: string;
}

export interface AttendanceNotificationCandidate {
  recipientType: 'employee' | 'supervisor' | 'deputy';
  recipientId: string;
  type: string;
  title: string;
  content: string;
  dedupKey: string;
  metadata: {
    type: string;
    violation_type: string;
    employee_id: string;
    employee_name: string;
    record_date: string;
    minutes?: number;
    punch_time?: string;
    expected_time?: string;
    requires_explanation?: boolean;
    is_missing_punch?: boolean;
    is_virtual_injected?: boolean;
  };
}

export interface HierarchySupervisors {
  managerId: string | null;
  deputyManagerId: string | null;
}

/**
 * دالة مساعدة لتحويل دقائق اليوم إلى نص عربي (ساعة ودقيقة أو دقائق)
 */
export function formatMinutesToArabicText(minutes: number): string {
  const absMins = Math.abs(minutes);
  const h = Math.floor(absMins / 60);
  const m = absMins % 60;
  if (h > 0 && m > 0) {
    return `${h} ساعة و ${m} دقيقة`;
  } else if (h > 0) {
    return `${h} ساعة`;
  } else {
    return `${m} دقيقة`;
  }
}

/**
 * فحص التأخير الصباحي وإعداد الإشعارات
 */
export function evaluateMorningLateArrival(
  firstPunchIso: string,
  recordDate: string,
  employeeId: string,
  employeeName: string,
  supervisors: HierarchySupervisors,
  isFollowUpAfterNightShift: boolean = false,
  morningTimeOff?: ApprovedTimeOffInfo | null
): AttendanceNotificationCandidate[] {
  const { totalMinutes, hours, minutes } = getBaghdadMinutes(firstPunchIso);
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  // 1. إذا كان الموظف مناوباً ممتداً بعد خفر ليلة أمس:
  // السماحية كاملة لغاية 09:00 صباحاً (540 دقيقة)
  if (isFollowUpAfterNightShift) {
    const nineAmMinutes = 9 * 60; // 540
    if (totalMinutes <= nineAmMinutes) {
      return []; // حضور طبيعي ضمن فترة السماحية
    }
    const delayMins = totalMinutes - nineAmMinutes;
    const timeText = formatMinutesToArabicText(delayMins);
    return buildLateArrivalNotifications(
      employeeId,
      employeeName,
      recordDate,
      delayMins,
      timeText,
      timeStr,
      supervisors,
      'morning_late_after_guard'
    );
  }

  // 2. إذا كان الموظف لديه إجازة زمنية بداية الدوام (shift_start):
  if (morningTimeOff && (morningTimeOff.time_off_subtype === 'shift_start' || !morningTimeOff.time_off_subtype)) {
    const durationMins = morningTimeOff.time_duration_minutes || 60;
    // البداية الطبيعية 08:30 + مدة الزمنية
    const baseLimitMinutes = 8 * 60 + 30; // 510
    const timeOffLimitMinutes = baseLimitMinutes + durationMins;

    if (totalMinutes <= timeOffLimitMinutes) {
      return []; // حضور طبيعي ضمن ساعات الإجازة الزمنية
    }

    const delayMins = totalMinutes - timeOffLimitMinutes;
    const timeText = formatMinutesToArabicText(delayMins);
    return buildLateArrivalAfterTimeOffNotifications(
      employeeId,
      employeeName,
      recordDate,
      delayMins,
      timeText,
      timeStr,
      supervisors
    );
  }

  // 3. الدوام الصباحي الاعتيادي:
  // الحد الأقصى للطبيعي هو 08:30 (510 دقيقة). التأخير يبدأ من 08:31 فما فوق
  const standardLimitMinutes = 8 * 60 + 30; // 510
  if (totalMinutes <= standardLimitMinutes) {
    return []; // حضور طبيعي
  }

  const delayMins = totalMinutes - standardLimitMinutes;
  const timeText = formatMinutesToArabicText(delayMins);

  return buildLateArrivalNotifications(
    employeeId,
    employeeName,
    recordDate,
    delayMins,
    timeText,
    timeStr,
    supervisors,
    'morning_late'
  );
}

/**
 * صياغة إشعارات التأخير الاعتيادي أو بعد الخفر
 */
function buildLateArrivalNotifications(
  employeeId: string,
  employeeName: string,
  recordDate: string,
  delayMins: number,
  timeText: string,
  punchTimeStr: string,
  supervisors: HierarchySupervisors,
  violationType: string
): AttendanceNotificationCandidate[] {
  const notifications: AttendanceNotificationCandidate[] = [];

  // إشعار الموظف نفسه
  notifications.push({
    recipientType: 'employee',
    recipientId: employeeId,
    type: 'attendance_morning_late',
    title: '⚠️ تنبيه تأخير عن الدوام الصباحي',
    content: `لديك تأخير عن الدوام الصباحي ليوم ${recordDate} بمقدار ${timeText}، لذا توجب تقديم استيضاح للمسؤول المباشر خلال 24 ساعة`,
    dedupKey: `${employeeId}_${recordDate}_morning_late_emp`,
    metadata: {
      type: 'morning_attendance_alert',
      violation_type: violationType,
      employee_id: employeeId,
      employee_name: employeeName,
      record_date: recordDate,
      minutes: delayMins,
      punch_time: punchTimeStr,
      requires_explanation: true
    }
  });

  // إشعار المسؤول المباشر
  if (supervisors.managerId && supervisors.managerId !== employeeId) {
    notifications.push({
      recipientType: 'supervisor',
      recipientId: supervisors.managerId,
      type: 'attendance_morning_late',
      title: '⚠️ تأخر موظف عن البصمة الصباحية',
      content: `تأخر الموظف (${employeeName}) ليوم ${recordDate} بمقدار ${timeText} عن البصمة الصباحية، لذا يرجى توجيه استيضاح للموظف لبيان أسباب التأخير`,
      dedupKey: `${employeeId}_${recordDate}_morning_late_mgr_${supervisors.managerId}`,
      metadata: {
        type: 'morning_attendance_alert',
        violation_type: violationType,
        employee_id: employeeId,
        employee_name: employeeName,
        record_date: recordDate,
        minutes: delayMins,
        punch_time: punchTimeStr,
        requires_explanation: true
      }
    });
  }

  // إشعار البديل (إن وجد وكان مختلفاً عن الموظف والمسؤول)
  if (
    supervisors.deputyManagerId &&
    supervisors.deputyManagerId !== employeeId &&
    supervisors.deputyManagerId !== supervisors.managerId
  ) {
    notifications.push({
      recipientType: 'deputy',
      recipientId: supervisors.deputyManagerId,
      type: 'attendance_morning_late',
      title: '⚠️ تأخر موظف عن البصمة الصباحية (كبديل مسؤول)',
      content: `تأخر الموظف (${employeeName}) ليوم ${recordDate} بمقدار ${timeText} عن البصمة الصباحية، لذا يرجى توجيه استيضاح للموظف لبيان أسباب التأخير`,
      dedupKey: `${employeeId}_${recordDate}_morning_late_dep_${supervisors.deputyManagerId}`,
      metadata: {
        type: 'morning_attendance_alert',
        violation_type: violationType,
        employee_id: employeeId,
        employee_name: employeeName,
        record_date: recordDate,
        minutes: delayMins,
        punch_time: punchTimeStr,
        requires_explanation: true
      }
    });
  }

  return notifications;
}

/**
 * صياغة إشعارات التأخير بعد الإجازة الزمنية الصباحية
 */
function buildLateArrivalAfterTimeOffNotifications(
  employeeId: string,
  employeeName: string,
  recordDate: string,
  delayMins: number,
  timeText: string,
  punchTimeStr: string,
  supervisors: HierarchySupervisors
): AttendanceNotificationCandidate[] {
  const notifications: AttendanceNotificationCandidate[] = [];

  // إشعار الموظف
  notifications.push({
    recipientType: 'employee',
    recipientId: employeeId,
    type: 'attendance_time_off_late',
    title: '⚠️ تأخير بعد الإجازة الزمنية',
    content: `لديك تأخير عن الدوام الصباحي بعد الزمنية ليوم ${recordDate} بمقدار ${timeText}، لذا توجب تقديم استيضاح للمسؤول المباشر خلال 24 ساعة`,
    dedupKey: `${employeeId}_${recordDate}_time_off_late_emp`,
    metadata: {
      type: 'morning_attendance_alert',
      violation_type: 'morning_late_after_time_off',
      employee_id: employeeId,
      employee_name: employeeName,
      record_date: recordDate,
      minutes: delayMins,
      punch_time: punchTimeStr,
      requires_explanation: true
    }
  });

  // إشعار المسؤول المباشر
  if (supervisors.managerId && supervisors.managerId !== employeeId) {
    notifications.push({
      recipientType: 'supervisor',
      recipientId: supervisors.managerId,
      type: 'attendance_time_off_late',
      title: '⚠️ تأخر موظف بعد الإجازة الزمنية',
      content: `تأخر الموظف (${employeeName}) ليوم ${recordDate} بمقدار ${timeText} عن البصمة بعد الزمنية، لذا يرجى توجيه استيضاح للموظف لبيان أسباب التأخير`,
      dedupKey: `${employeeId}_${recordDate}_time_off_late_mgr_${supervisors.managerId}`,
      metadata: {
        type: 'morning_attendance_alert',
        violation_type: 'morning_late_after_time_off',
        employee_id: employeeId,
        employee_name: employeeName,
        record_date: recordDate,
        minutes: delayMins,
        punch_time: punchTimeStr,
        requires_explanation: true
      }
    });
  }

  // إشعار البديل
  if (
    supervisors.deputyManagerId &&
    supervisors.deputyManagerId !== employeeId &&
    supervisors.deputyManagerId !== supervisors.managerId
  ) {
    notifications.push({
      recipientType: 'deputy',
      recipientId: supervisors.deputyManagerId,
      type: 'attendance_time_off_late',
      title: '⚠️ تأخر موظف بعد الإجازة الزمنية (كبديل مسؤول)',
      content: `تأخر الموظف (${employeeName}) ليوم ${recordDate} بمقدار ${timeText} عن البصمة بعد الزمنية، لذا يرجى توجيه استيضاح للموظف لبيان أسباب التأخير`,
      dedupKey: `${employeeId}_${recordDate}_time_off_late_dep_${supervisors.deputyManagerId}`,
      metadata: {
        type: 'morning_attendance_alert',
        violation_type: 'morning_late_after_time_off',
        employee_id: employeeId,
        employee_name: employeeName,
        record_date: recordDate,
        minutes: delayMins,
        punch_time: punchTimeStr,
        requires_explanation: true
      }
    });
  }

  return notifications;
}

/**
 * فحص الخروج المبكر الصباحي وإعداد الإشعارات
 */
export function evaluateMorningEarlyDeparture(
  lastPunchIso: string,
  recordDate: string,
  employeeId: string,
  employeeName: string,
  supervisors: HierarchySupervisors,
  isFollowedByEveningShift: boolean = false,
  endTimeOff?: ApprovedTimeOffInfo | null
): AttendanceNotificationCandidate[] {
  const { totalMinutes, hours, minutes } = getBaghdadMinutes(lastPunchIso);
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  // 1. إذا كان الموظف مناوباً ولديه دوام مسائي ممتد بعد الصباحي:
  // السماحية ممتدة من 14:30 إلى 15:30 دون محاسبة على 14:30 بالدقة
  if (isFollowedByEveningShift) {
    const windowStart = 14 * 60 + 30; // 14:30
    const windowEnd = 15 * 60 + 30;   // 15:30
    if (totalMinutes >= windowStart && totalMinutes <= windowEnd) {
      return []; // حضور وتأكيد حضور طبيعي بين الشفتين
    }
  }

  // 2. إذا كان لدى الموظف إجازة زمنية نهاية الدوام (shift_end):
  if (endTimeOff && (endTimeOff.time_off_subtype === 'shift_end' || !endTimeOff.time_off_subtype)) {
    const durationMins = endTimeOff.time_duration_minutes || 60;
    // وقت الاستحقاق للمغادرة: 14:30 - مدة الزمنية
    const standardEndMinutes = 14 * 60 + 30; // 870
    const eligibleExitMinutes = standardEndMinutes - durationMins;

    // إذا خرج عند أو بعد وقت الاستحقاق: طبيعي
    if (totalMinutes >= eligibleExitMinutes) {
      return [];
    }

    const earlyMins = eligibleExitMinutes - totalMinutes;
    const timeText = formatMinutesToArabicText(earlyMins);
    return buildEarlyDepartureAfterTimeOffNotifications(
      employeeId,
      employeeName,
      recordDate,
      earlyMins,
      timeText,
      timeStr,
      supervisors
    );
  }

  // 3. الدوام الصباحي الاعتيادي:
  // ينتهي عند 14:30 (870 دقيقة). الخروج قبل 14:30 (14:29 فما دون) يعتبر مغادرة مبكرة
  const standardEndMinutes = 14 * 60 + 30; // 870
  if (totalMinutes >= standardEndMinutes) {
    return []; // خروج نظامي
  }

  const earlyMins = standardEndMinutes - totalMinutes;
  const timeText = formatMinutesToArabicText(earlyMins);

  return buildEarlyDepartureNotifications(
    employeeId,
    employeeName,
    recordDate,
    earlyMins,
    timeText,
    timeStr,
    supervisors
  );
}

/**
 * صياغة إشعارات المغادرة المبكرة الاعتيادية
 */
function buildEarlyDepartureNotifications(
  employeeId: string,
  employeeName: string,
  recordDate: string,
  earlyMins: number,
  timeText: string,
  punchTimeStr: string,
  supervisors: HierarchySupervisors
): AttendanceNotificationCandidate[] {
  const notifications: AttendanceNotificationCandidate[] = [];

  // إشعار الموظف
  notifications.push({
    recipientType: 'employee',
    recipientId: employeeId,
    type: 'attendance_morning_early_leave',
    title: '⚠️ مغادرة مبكرة من الدوام الصباحي',
    content: `لديك مغادرة مبكرة من الدوام الصباحي ليوم ${recordDate} بمقدار ${timeText}، لذا توجب تقديم استيضاح للمسؤول المباشر خلال 24 ساعة`,
    dedupKey: `${employeeId}_${recordDate}_morning_early_emp`,
    metadata: {
      type: 'morning_attendance_alert',
      violation_type: 'morning_early_leave',
      employee_id: employeeId,
      employee_name: employeeName,
      record_date: recordDate,
      minutes: earlyMins,
      punch_time: punchTimeStr,
      requires_explanation: true
    }
  });

  // إشعار المسؤول المباشر
  if (supervisors.managerId && supervisors.managerId !== employeeId) {
    notifications.push({
      recipientType: 'supervisor',
      recipientId: supervisors.managerId,
      type: 'attendance_morning_early_leave',
      title: '⚠️ مغادرة مبكرة لموظف عن نهاية الدوام',
      content: `غادر الموظف (${employeeName}) ليوم ${recordDate} قبل نهاية الدوام الصباحي بمقدار ${timeText} عن بصمة نهاية الدوام، لذا يرجى توجيه استيضاح للموظف لبيان أسباب المغادرة`,
      dedupKey: `${employeeId}_${recordDate}_morning_early_mgr_${supervisors.managerId}`,
      metadata: {
        type: 'morning_attendance_alert',
        violation_type: 'morning_early_leave',
        employee_id: employeeId,
        employee_name: employeeName,
        record_date: recordDate,
        minutes: earlyMins,
        punch_time: punchTimeStr,
        requires_explanation: true
      }
    });
  }

  // إشعار البديل
  if (
    supervisors.deputyManagerId &&
    supervisors.deputyManagerId !== employeeId &&
    supervisors.deputyManagerId !== supervisors.managerId
  ) {
    notifications.push({
      recipientType: 'deputy',
      recipientId: supervisors.deputyManagerId,
      type: 'attendance_morning_early_leave',
      title: '⚠️ مغادرة مبكرة لموظف عن نهاية الدوام (كبديل مسؤول)',
      content: `غادر الموظف (${employeeName}) ليوم ${recordDate} قبل نهاية الدوام الصباحي بمقدار ${timeText} عن بصمة نهاية الدوام، لذا يرجى توجيه استيضاح للموظف لبيان أسباب المغادرة`,
      dedupKey: `${employeeId}_${recordDate}_morning_early_dep_${supervisors.deputyManagerId}`,
      metadata: {
        type: 'morning_attendance_alert',
        violation_type: 'morning_early_leave',
        employee_id: employeeId,
        employee_name: employeeName,
        record_date: recordDate,
        minutes: earlyMins,
        punch_time: punchTimeStr,
        requires_explanation: true
      }
    });
  }

  return notifications;
}

/**
 * صياغة إشعارات المغادرة المبكرة قبل استحقاق الإجازة الزمنية
 */
function buildEarlyDepartureAfterTimeOffNotifications(
  employeeId: string,
  employeeName: string,
  recordDate: string,
  earlyMins: number,
  timeText: string,
  punchTimeStr: string,
  supervisors: HierarchySupervisors
): AttendanceNotificationCandidate[] {
  const notifications: AttendanceNotificationCandidate[] = [];

  // إشعار الموظف
  notifications.push({
    recipientType: 'employee',
    recipientId: employeeId,
    type: 'attendance_time_off_early',
    title: '⚠️ مغادرة مبكرة قبل استحقاق الإجازة الزمنية',
    content: `لديك مغادرة مبكرة من الدوام الصباحي للزمنية ليوم ${recordDate} بمقدار ${timeText}، لذا توجب تقديم استيضاح للمسؤول المباشر خلال 24 ساعة`,
    dedupKey: `${employeeId}_${recordDate}_time_off_early_emp`,
    metadata: {
      type: 'morning_attendance_alert',
      violation_type: 'morning_early_time_off',
      employee_id: employeeId,
      employee_name: employeeName,
      record_date: recordDate,
      minutes: earlyMins,
      punch_time: punchTimeStr,
      requires_explanation: true
    }
  });

  // إشعار المسؤول المباشر
  if (supervisors.managerId && supervisors.managerId !== employeeId) {
    notifications.push({
      recipientType: 'supervisor',
      recipientId: supervisors.managerId,
      type: 'attendance_time_off_early',
      title: '⚠️ مغادرة موظف قبل استحقاق الزمنية',
      content: `غادر الموظف (${employeeName}) ليوم ${recordDate} بمقدار ${timeText} قبل وقت استحقاق الزمنية، لذا يرجى توجيه استيضاح للموظف لبيان أسباب التأخير`,
      dedupKey: `${employeeId}_${recordDate}_time_off_early_mgr_${supervisors.managerId}`,
      metadata: {
        type: 'morning_attendance_alert',
        violation_type: 'morning_early_time_off',
        employee_id: employeeId,
        employee_name: employeeName,
        record_date: recordDate,
        minutes: earlyMins,
        punch_time: punchTimeStr,
        requires_explanation: true
      }
    });
  }

  // إشعار البديل
  if (
    supervisors.deputyManagerId &&
    supervisors.deputyManagerId !== employeeId &&
    supervisors.deputyManagerId !== supervisors.managerId
  ) {
    notifications.push({
      recipientType: 'deputy',
      recipientId: supervisors.deputyManagerId,
      type: 'attendance_time_off_early',
      title: '⚠️ مغادرة موظف قبل استحقاق الزمنية (كبديل مسؤول)',
      content: `غادر الموظف (${employeeName}) ليوم ${recordDate} بمقدار ${timeText} قبل وقت استحقاق الزمنية، لذا يرجى توجيه استيضاح للموظف لبيان أسباب التأخير`,
      dedupKey: `${employeeId}_${recordDate}_time_off_early_dep_${supervisors.deputyManagerId}`,
      metadata: {
        type: 'morning_attendance_alert',
        violation_type: 'morning_early_time_off',
        employee_id: employeeId,
        employee_name: employeeName,
        record_date: recordDate,
        minutes: earlyMins,
        punch_time: punchTimeStr,
        requires_explanation: true
      }
    });
  }

  return notifications;
}

/**
 * فحص البصمات في الإجازة الزمنية وسط الدوام (mid_shift)
 */
export function evaluateMidShiftTimeOffPunches(
  exitPunchIso: string | null,
  returnPunchIso: string | null,
  midTimeOff: ApprovedTimeOffInfo,
  recordDate: string,
  employeeId: string,
  employeeName: string,
  supervisors: HierarchySupervisors
): AttendanceNotificationCandidate[] {
  const notifications: AttendanceNotificationCandidate[] = [];

  if (!midTimeOff.leave_start_time || !midTimeOff.leave_end_time) {
    return [];
  }

  const [sh, sm] = midTimeOff.leave_start_time.split(':').map(Number);
  const [eh, em] = midTimeOff.leave_end_time.split(':').map(Number);
  const startLimitMins = sh * 60 + sm;
  const endLimitMins = eh * 60 + em;

  // 1. بصمة المغادرة للزمنية:
  if (exitPunchIso) {
    const { totalMinutes, hours, minutes } = getBaghdadMinutes(exitPunchIso);
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    // إذا سبقت وقت بداية الزمنية المعتمدة
    if (totalMinutes < startLimitMins) {
      const earlyMins = startLimitMins - totalMinutes;
      const timeText = formatMinutesToArabicText(earlyMins);
      const earlyNotifs = buildEarlyDepartureAfterTimeOffNotifications(
        employeeId,
        employeeName,
        recordDate,
        earlyMins,
        timeText,
        timeStr,
        supervisors
      );
      notifications.push(...earlyNotifs);
    }
  }

  // 2. بصمة العودة من الزمنية:
  if (returnPunchIso) {
    const { totalMinutes, hours, minutes } = getBaghdadMinutes(returnPunchIso);
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    // إذا عادت بعد نهاية وقت الزمنية المعتمدة
    if (totalMinutes > endLimitMins) {
      const delayMins = totalMinutes - endLimitMins;
      const timeText = formatMinutesToArabicText(delayMins);
      const lateNotifs = buildLateArrivalAfterTimeOffNotifications(
        employeeId,
        employeeName,
        recordDate,
        delayMins,
        timeText,
        timeStr,
        supervisors
      );
      notifications.push(...lateNotifs);
    }
  }

  return notifications;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * الفحص البعدي بأثر رجعي للبصمات المفقودة (ما لم يتم تثبيته)
 * يُنفذ عند حلول نهاية اليوم / ما بعد منتصف الليل (00:31 فما بعد)
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * إشعار نقص بصمة إثبات الحضور بين الصباحي والمسائي (14:30 - 15:30)
 */
export function buildMissingMorningEveningBridgeNotifications(
  employeeId: string,
  employeeName: string,
  recordDate: string,
  supervisors: HierarchySupervisors
): AttendanceNotificationCandidate[] {
  const notifications: AttendanceNotificationCandidate[] = [];

  // إشعار الموظف
  notifications.push({
    recipientType: 'employee',
    recipientId: employeeId,
    type: 'attendance_missing_presence',
    title: '⚠️ نقص بصمة إثبات تواجد في نهاية الصباحي',
    content: `لديك نقص بصمة إثبات تواجد في نهاية الدوام الصباحي ليوم ${recordDate}، لذا توجب تقديم الاستيضاح للمسؤول المباشر خلال 24 ساعة.`,
    dedupKey: `${employeeId}_${recordDate}_missing_morning_evening_emp`,
    metadata: {
      type: 'morning_attendance_alert',
      violation_type: 'missing_morning_evening_bridge',
      employee_id: employeeId,
      employee_name: employeeName,
      record_date: recordDate,
      requires_explanation: true,
      is_missing_punch: true,
      is_virtual_injected: true
    }
  });

  // إشعار المسؤول المباشر
  if (supervisors.managerId && supervisors.managerId !== employeeId) {
    notifications.push({
      recipientType: 'supervisor',
      recipientId: supervisors.managerId,
      type: 'attendance_missing_presence',
      title: '⚠️ نقص بصمة إثبات حضور لموظف',
      content: `لدى الموظف (${employeeName})، نقص بصمة إثبات حضور في نهاية الدوام الصباحي ليوم ${recordDate}، لذا يرجى توجيه استيضاح للموظف لبيان أسباب عدم الالتزام`,
      dedupKey: `${employeeId}_${recordDate}_missing_morning_evening_mgr_${supervisors.managerId}`,
      metadata: {
        type: 'morning_attendance_alert',
        violation_type: 'missing_morning_evening_bridge',
        employee_id: employeeId,
        employee_name: employeeName,
        record_date: recordDate,
        requires_explanation: true,
        is_missing_punch: true,
        is_virtual_injected: true
      }
    });
  }

  // إشعار البديل
  if (
    supervisors.deputyManagerId &&
    supervisors.deputyManagerId !== employeeId &&
    supervisors.deputyManagerId !== supervisors.managerId
  ) {
    notifications.push({
      recipientType: 'deputy',
      recipientId: supervisors.deputyManagerId,
      type: 'attendance_missing_presence',
      title: '⚠️ نقص بصمة إثبات حضور لموظف (كبديل مسؤول)',
      content: `لدى الموظف (${employeeName})، نقص بصمة إثبات حضور في نهاية الدوام الصباحي ليوم ${recordDate}، لذا يرجى توجيه استيضاح للموظف لبيان أسباب عدم الالتزام`,
      dedupKey: `${employeeId}_${recordDate}_missing_morning_evening_dep_${supervisors.deputyManagerId}`,
      metadata: {
        type: 'morning_attendance_alert',
        violation_type: 'missing_morning_evening_bridge',
        employee_id: employeeId,
        employee_name: employeeName,
        record_date: recordDate,
        requires_explanation: true,
        is_missing_punch: true,
        is_virtual_injected: true
      }
    });
  }

  return notifications;
}

/**
 * إشعار نقص بصمة إثبات الحضور في منتصف الخفر (23:30 - 00:30)
 */
export function buildMissingMidnightBridgeNotifications(
  employeeId: string,
  employeeName: string,
  recordDate: string,
  supervisors: HierarchySupervisors
): AttendanceNotificationCandidate[] {
  const notifications: AttendanceNotificationCandidate[] = [];

  // إشعار الموظف
  notifications.push({
    recipientType: 'employee',
    recipientId: employeeId,
    type: 'attendance_missing_midnight',
    title: '⚠️ نقص بصمة إثبات تواجد في منتصف الخفر',
    content: `لديك نقص بصمة إثبات تواجد في منتصف الدوام الخفر ليوم ${recordDate}، لذا توجب تقديم الاستيضاح للمسؤول المباشر خلال 24 ساعة.`,
    dedupKey: `${employeeId}_${recordDate}_missing_midnight_emp`,
    metadata: {
      type: 'morning_attendance_alert',
      violation_type: 'missing_midnight_bridge',
      employee_id: employeeId,
      employee_name: employeeName,
      record_date: recordDate,
      requires_explanation: true,
      is_missing_punch: true,
      is_virtual_injected: true
    }
  });

  // إشعار المسؤول المباشر
  if (supervisors.managerId && supervisors.managerId !== employeeId) {
    notifications.push({
      recipientType: 'supervisor',
      recipientId: supervisors.managerId,
      type: 'attendance_missing_midnight',
      title: '⚠️ نقص بصمة منتصف الليل لموظف خفر',
      content: `لدى الموظف (${employeeName})، نقص بصمة إثبات حضور في منتصف الدوام الخفر ليوم ${recordDate}، لذا يرجى توجيه استيضاح للموظف لبيان أسباب عدم الالتزام`,
      dedupKey: `${employeeId}_${recordDate}_missing_midnight_mgr_${supervisors.managerId}`,
      metadata: {
        type: 'morning_attendance_alert',
        violation_type: 'missing_midnight_bridge',
        employee_id: employeeId,
        employee_name: employeeName,
        record_date: recordDate,
        requires_explanation: true,
        is_missing_punch: true,
        is_virtual_injected: true
      }
    });
  }

  // إشعار البديل
  if (
    supervisors.deputyManagerId &&
    supervisors.deputyManagerId !== employeeId &&
    supervisors.deputyManagerId !== supervisors.managerId
  ) {
    notifications.push({
      recipientType: 'deputy',
      recipientId: supervisors.deputyManagerId,
      type: 'attendance_missing_midnight',
      title: '⚠️ نقص بصمة منتصف الليل لموظف خفر (كبديل مسؤول)',
      content: `لدى الموظف (${employeeName})، نقص بصمة إثبات حضور في منتصف الدوام الخفر ليوم ${recordDate}، لذا يرجى توجيه استيضاح للموظف لبيان أسباب عدم الالتزام`,
      dedupKey: `${employeeId}_${recordDate}_missing_midnight_dep_${supervisors.deputyManagerId}`,
      metadata: {
        type: 'morning_attendance_alert',
        violation_type: 'missing_midnight_bridge',
        employee_id: employeeId,
        employee_name: employeeName,
        record_date: recordDate,
        requires_explanation: true,
        is_missing_punch: true,
        is_virtual_injected: true
      }
    });
  }

  return notifications;
}
