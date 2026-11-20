/**
 * rosterAttendanceEngine.ts
 * المحرك الحتمي الصافي لحساب وتقييم بصمات وحضور موظفي المناوبات (Roster)
 * مديرية اتصالات كربلاء — إطار عمل B.R.I.C.K (ATT-04)
 * 
 * القواعد الصارمة المطبقة:
 * 1. عزل معماري نقي 100% عن محرك الموظف الصباحي الثابت.
 * 2. تشخيصي بحت: صفر إجازات تلقائية، صفر زمنيات تلقائية، صفر تعديلات تخريبية.
 * 3. حماية خانة الانصراف النهائي (Slot 6): نبضات التواجد البينية داخل الشفت لا تقفل الشفت.
 * 4. إدارة الخانات الست وقاعدة البصمة 7 وما بعدها (استبدال السادسة مع توثيق الأرشيف وتنبيه PDF).
 * 5. شرط بصمتي الجسر عند منتصف الليل: إثبات حضور إن وُجدتا، وطباعة بديل افتراضي أحمر مع إشعار المشرف للكاميرات إن فُقدتا.
 * 6. حظر الإجازة الزمنية الوسطية للمناوب، وحصرها بـ shift_start و shift_end فقط.
 * 7. أوزان الشفتات: صباحي=1، مسائي=1، خفر=2، مسائي+خفر=3 أيام.
 */

export type RosterShiftType = 'morning' | 'evening' | 'night' | 'connected_evening_night' | 'connected_night_morning' | 'rest';

export interface RosterPunch {
  time: string; // ISO String UTC
  location?: string;
  device_id?: string;
  snapshot_url?: string;
  notes?: string;
  verified_by_biometric?: boolean;
  is_virtual?: boolean;
  target_slot?: string;
}

export interface RosterDaySchedule {
  is_morning: boolean;
  is_evening: boolean;
  is_night: boolean;
  is_rest_day: boolean;
}

export interface ApprovedLeaveLite {
  id: string;
  leave_type: string;
  start_date: string;
  end_date?: string;
  leave_start_time?: string;
  leave_end_time?: string;
  time_duration_minutes?: number;
  time_off_subtype?: string;
  status: string;
  reason?: string;
}

export interface RosterEvaluationResult {
  slots: {
    check_in: string | null;
    check_in_location?: string | null;
    check_in_device_id?: string | null;
    check_in_snapshot_url?: string | null;
    check_in_verified_by_biometric?: boolean;

    check_out: string | null;
    check_out_location?: string | null;
    check_out_device_id?: string | null;
    check_out_snapshot_url?: string | null;
    check_out_verified_by_biometric?: boolean;
    check_out_is_virtual?: boolean;

    time_leave_out: string | null;
    time_leave_return: string | null;
    time_leave_out_2: string | null;
    time_leave_return_2: string | null;
  };
  rawPunches: RosterPunch[];
  shiftType: RosterShiftType;
  status: 'present' | 'late' | 'early_leave' | 'absent' | 'on_leave' | 'rest_day';
  notes: string;
  pdfNote?: string;
  hasOverflowPunches: boolean;
  midnightStatus: 'not_applicable' | 'verified' | 'missing_virtual_red' | 'pending';
  supervisorAlert?: string;
}

/**
 * استخراج ساعة ودقيقة بتوقيت بغداد (UTC+3) من نص ISO
 */
export function getBaghdadMinutes(isoTime: string): { hours: number; minutes: number; totalMinutes: number } {
  const d = new Date(isoTime);
  const baghdadHours = (d.getUTCHours() + 3) % 24;
  const mins = d.getUTCMinutes();
  return {
    hours: baghdadHours,
    minutes: mins,
    totalMinutes: baghdadHours * 60 + mins
  };
}

/**
 * تكوين وقت بتوقيت بغداد بتنسيق ISO
 */
export function createBaghdadIso(dateStr: string, hour: number, minute: number, second: number = 0): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcMillis = Date.UTC(y, m - 1, d, hour, minute, second, 0) - (3 * 3600 * 1000);
  return new Date(utcMillis).toISOString();
}

/**
 * تحديد نوع شفت اليوم بناءً على جدول المناوبة
 */
export function resolveRosterShiftType(
  schedule: RosterDaySchedule,
  prevDaySchedule?: { is_night: boolean },
  hasPunches: boolean = false
): RosterShiftType {
  if (schedule.is_rest_day || (!schedule.is_morning && !schedule.is_evening && !schedule.is_night)) {
    if (prevDaySchedule?.is_night && hasPunches) {
      return 'connected_night_morning';
    }
    return 'rest';
  }
  if (schedule.is_evening && schedule.is_night) {
    return 'connected_evening_night';
  }
  if (schedule.is_night && !schedule.is_evening && !schedule.is_morning) {
    return 'night';
  }
  if (schedule.is_evening && !schedule.is_night && !schedule.is_morning) {
    return 'evening';
  }
  if (schedule.is_morning && !schedule.is_evening && !schedule.is_night) {
    return 'morning';
  }
  return 'connected_evening_night'; // الافتراضي للحالات المتعددة
}

/**
 * المحرك الرئيسي لتقييم يوم مناوبة
 */
export function evaluateRosterAttendance(
  rawPunchesInput: RosterPunch[],
  dateStr: string, // YYYY-MM-DD
  schedule: RosterDaySchedule,
  prevDaySchedule: { is_night: boolean } = { is_night: false },
  approvedLeaves: ApprovedLeaveLite[] = [],
  approvedTimeOffs: ApprovedLeaveLite[] = [],
  isEndOfDay: boolean = false
): RosterEvaluationResult {
  const hasAnyRealPunches = (rawPunchesInput || []).some(p => !p.is_virtual && !p.notes?.includes('افتراضي'));
  const shiftType = resolveRosterShiftType(schedule, prevDaySchedule, hasAnyRealPunches);

  // 1. إذا كان يوم استراحة
  if (shiftType === 'rest') {
    return {
      slots: {
        check_in: null,
        check_out: null,
        time_leave_out: null,
        time_leave_return: null,
        time_leave_out_2: null,
        time_leave_return_2: null
      },
      rawPunches: rawPunchesInput,
      shiftType: 'rest',
      status: 'rest_day',
      notes: 'استراحة مجدولة (بدون دوام)',
      hasOverflowPunches: false,
      midnightStatus: 'not_applicable'
    };
  }

  // 2. فحص الإجازات الاعتيادية/المرضية المعتمدة
  const coveringLeave = approvedLeaves.find(l => {
    if (l.status !== 'approved') return false;
    if (l.leave_type === 'time_off') return false;
    const start = l.start_date;
    const end = l.end_date || l.start_date;
    return dateStr >= start && dateStr <= end;
  });

  if (coveringLeave) {
    return {
      slots: {
        check_in: null,
        check_out: null,
        time_leave_out: null,
        time_leave_return: null,
        time_leave_out_2: null,
        time_leave_return_2: null
      },
      rawPunches: rawPunchesInput,
      shiftType,
      status: 'on_leave',
      notes: `مجاز رسمياً (${coveringLeave.reason || coveringLeave.leave_type})`,
      hasOverflowPunches: false,
      midnightStatus: 'not_applicable'
    };
  }

  // 3. فرز وتنقية البصمات الحقيقية (استبعاد البصمات الافتراضية) وفق مهلة الـ 180 ثانية (3 دقائق)
  const cleanRealPunches = rawPunchesInput.filter(p => !p.is_virtual && !p.notes?.includes('افتراضي'));
  const sortedPunches = [...cleanRealPunches].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );

  const cooldownMs = 180 * 1000;
  const filteredPunches: RosterPunch[] = [];
  let pIdx = 0;
  while (pIdx < sortedPunches.length) {
    let nextIdx = pIdx + 1;
    while (
      nextIdx < sortedPunches.length &&
      new Date(sortedPunches[nextIdx].time).getTime() - new Date(sortedPunches[nextIdx - 1].time).getTime() <= cooldownMs
    ) {
      nextIdx++;
    }
    // نعتمد البصمة الأولى في نافذة الـ 3 دقائق لمنع التكرار العرضي
    filteredPunches.push(sortedPunches[pIdx]);
    pIdx = nextIdx;
  }

  // 4. النوافذ الزمنية لانصراف الشفت
  // بغداد دقائق اليوم (0 - 1440)
  let checkOutWindowStartMins = 0;
  let checkOutWindowEndMins = 0;

  switch (shiftType) {
    case 'morning':
      checkOutWindowStartMins = 14 * 60 + 15; // 14:15
      checkOutWindowEndMins = 16 * 60;      // 16:00
      break;
    case 'evening':
      checkOutWindowStartMins = 19 * 60 + 45; // 19:45
      checkOutWindowEndMins = 21 * 60 + 30;  // 21:30
      break;
    case 'night':
      // نهاية الخفر صباح اليوم التالي (07:30 - 09:30)
      checkOutWindowStartMins = 7 * 60 + 30;
      checkOutWindowEndMins = 9 * 60 + 30;
      break;
    case 'connected_evening_night':
    case 'connected_night_morning':
      // نهاية النوبة الممتدة صباح اليوم التالي (07:30 - 09:30)
      checkOutWindowStartMins = 7 * 60 + 30;
      checkOutWindowEndMins = 9 * 60 + 30;
      break;
    default:
      checkOutWindowStartMins = 19 * 60 + 45;
      checkOutWindowEndMins = 21 * 60;
  }

  // 5. فحص الإجازات الزمنية الصالحة (المناوب مسموح له فقط shift_start أو shift_end)
  const validTimeOffs = approvedTimeOffs.filter(
    t => t.time_off_subtype === 'shift_start' || t.time_off_subtype === 'shift_end'
  );
  const startTo = validTimeOffs.find(t => t.time_off_subtype === 'shift_start');
  const endTo = validTimeOffs.find(t => t.time_off_subtype === 'shift_end');

  // 6. توزيع البصمات على الخانات الست
  const slots: RosterEvaluationResult['slots'] = {
    check_in: null,
    check_in_location: null,
    check_in_device_id: null,
    check_in_snapshot_url: null,
    check_in_verified_by_biometric: false,

    check_out: null,
    check_out_location: null,
    check_out_device_id: null,
    check_out_snapshot_url: null,
    check_out_verified_by_biometric: false,
    check_out_is_virtual: false,

    time_leave_out: null,
    time_leave_return: null,
    time_leave_out_2: null,
    time_leave_return_2: null
  };

  const heartbeats: RosterPunch[] = [];
  let midnightVerified = false;
  let hasOverflow = false;

  if (filteredPunches.length > 0) {
    if (shiftType === 'connected_night_morning') {
      // في يوم استكمال الخفارة الممتدة صباحاً: البصمة الصباحية هي بصمة انصراف نهاية الخفارة
      const lastPunch = filteredPunches[filteredPunches.length - 1];
      slots.check_out = lastPunch.time;
      slots.check_out_location = lastPunch.location;
      slots.check_out_device_id = lastPunch.device_id;
      slots.check_out_snapshot_url = lastPunch.snapshot_url;
      slots.check_out_verified_by_biometric = lastPunch.verified_by_biometric;
      if (filteredPunches.length > 1) {
        slots.time_leave_out = filteredPunches[0].time;
      }
    } else {
    // الخانة 1: الدخول الرئيسي (أول بصمة مقبولة)
    const firstPunch = filteredPunches[0];
    slots.check_in = firstPunch.time;
    slots.check_in_location = firstPunch.location;
    slots.check_in_device_id = firstPunch.device_id;
    slots.check_in_snapshot_url = firstPunch.snapshot_url;
    slots.check_in_verified_by_biometric = firstPunch.verified_by_biometric;

    // فحص البصمات التالية
    for (let i = 1; i < filteredPunches.length; i++) {
      const punch = filteredPunches[i];
      const { hours, minutes, totalMinutes } = getBaghdadMinutes(punch.time);

      // فحص بصمة منتصف الليل (بين 23:15 و 00:45)
      if ((hours === 23 && minutes >= 15) || (hours === 0 && minutes <= 45)) {
        midnightVerified = true;
      }

      // هل هذه البصمة تقع في نافذة الانصراف النهائي للشفت؟
      const isNightNextDayOut = (shiftType === 'night' || shiftType === 'connected_evening_night') &&
        totalMinutes >= checkOutWindowStartMins && totalMinutes <= checkOutWindowEndMins;

      const isNormalOut = (shiftType === 'morning' || shiftType === 'evening') &&
        totalMinutes >= checkOutWindowStartMins && totalMinutes <= checkOutWindowEndMins;

      const isExplicitCheckout = punch.target_slot === 'check_out';

      if (isNightNextDayOut || isNormalOut || isExplicitCheckout) {
        // بصمة انصراف نهائي معتمدة
        slots.check_out = punch.time;
        slots.check_out_location = punch.location;
        slots.check_out_device_id = punch.device_id;
        slots.check_out_snapshot_url = punch.snapshot_url;
        slots.check_out_verified_by_biometric = punch.verified_by_biometric;
      } else {
        // نبضة تواجد بينية (Presence Heartbeat)
        heartbeats.push(punch);
      }
    }
    }
  }

  // توزيع نبضات التواجد على الخانات الوسطى (استراحة 1 و 2) دون المساس بالانصراف
  if (heartbeats.length > 0 && !slots.time_leave_out) {
    slots.time_leave_out = heartbeats[0].time;
  }
  if (heartbeats.length > 1 && !slots.time_leave_return) {
    slots.time_leave_return = heartbeats[1].time;
  }
  if (heartbeats.length > 2 && !slots.time_leave_out_2) {
    slots.time_leave_out_2 = heartbeats[2].time;
  }
  if (heartbeats.length > 3 && !slots.time_leave_return_2) {
    slots.time_leave_return_2 = heartbeats[3].time;
  }

  // التحقق من تجاوز الـ 6 بصمات
  if (filteredPunches.length > 6) {
    hasOverflow = true;
  }

  // 7. معالجة شرط بصمة الجسر عند منتصف الليل (طلب الإدارة وملاحظة م. مسلم)
  let midnightStatus: RosterEvaluationResult['midnightStatus'] = 'not_applicable';
  let supervisorAlert: string | undefined;

  const requiresMidnightBridge = shiftType === 'night' || shiftType === 'connected_evening_night';
  if (requiresMidnightBridge) {
    if (midnightVerified) {
      midnightStatus = 'verified';
    } else if (isEndOfDay) {
      // فقط عند نهاية اليوم أو التدقيق البعدي لليوم السابق:
      // الموظف حاضر ولكن لم يثبت حضوره عند منتصف الليل:
      // نولد بصمة الجسر الافتراضية باللون الأحمر (23:59:59)
      midnightStatus = 'missing_virtual_red';
      supervisorAlert = '⚠️ تنبيه تدقيق: لم يثبت الموظف حضوره عند منتصف الليل لشفت الخفر. يرجى مراجعة الكاميرات للتحقق من التواجد الفعلي بالمقر.';

      // إضافة البصمة الافتراضية الحمراء للأرشيف ليقرأها تقرير المشرف
      const virtualMidnightPunch: RosterPunch = {
        time: createBaghdadIso(dateStr, 23, 59, 59),
        notes: '(بصمة منتصف ليل افتراضية حمراء - تنبيه تدقيق كاميرات)',
        is_virtual: true
      };
      filteredPunches.push(virtualMidnightPunch);
    } else {
      // أثناء اليوم وقبل حلول منتصف الليل: الحالة قيد الانتظار ولا تُحقن بصمة افتراضية في المستقبل
      midnightStatus = 'pending';
    }
  }

  // 8. تحديد الحالة العامة (Status) والملاحظات
  let status: RosterEvaluationResult['status'] = 'present';
  let notes = '';

  if (shiftType === 'connected_night_morning') {
    status = 'present';
    notes = 'انصراف خفارة ممتدة (امتداد شفت ليلة الأمس)';
  } else if (!slots.check_in) {
    status = 'absent';
    notes = 'غياب — لم تُسجل بصمة حضور للشفت';
  } else {
    // فحص التأخير
    const { totalMinutes } = getBaghdadMinutes(slots.check_in);
    let shiftExpectedStartMins = 0;
    if (shiftType === 'morning') shiftExpectedStartMins = 8 * 60;
    else if (shiftType === 'evening' || shiftType === 'connected_evening_night') shiftExpectedStartMins = 14 * 60 + 30;
    else if (shiftType === 'night') shiftExpectedStartMins = 20 * 60;

    // المناوب ليس لديه سماحية 30 دقيقة
    const graceMinutes = 0;
    const allowedLimit = shiftExpectedStartMins + graceMinutes;

    if (totalMinutes > allowedLimit && !startTo) {
      status = 'late';
      const lateMins = totalMinutes - shiftExpectedStartMins;
      notes = `تأخر عن استلام الشفت بمقدار ${lateMins} دقيقة`;
    } else {
      status = 'present';
      notes = 'حضور مثبت للشفت';
    }

    if (startTo) {
      notes += ` | تغطية زمنية بداية الشفت (${startTo.time_duration_minutes || 0} دقيقة)`;
    }
    if (endTo) {
      notes += ` | مغادرة مبكرة معتمدة بزمنية (${endTo.time_duration_minutes || 0} دقيقة)`;
    }
  }

  // الملاحظة الإلزامية للـ PDF في حال وجود أكثر من 6 بصمات
  let pdfNote: string | undefined;
  if (hasOverflow) {
    pdfNote = 'تنبيه: هناك بصمات إضافية مؤرشفة في النظام لهذا اليوم';
    notes += ' | هناك بصمات أكثر من 6';
  }

  return {
    slots,
    rawPunches: filteredPunches,
    shiftType,
    status,
    notes,
    pdfNote,
    hasOverflowPunches: hasOverflow,
    midnightStatus,
    supervisorAlert
  };
}
