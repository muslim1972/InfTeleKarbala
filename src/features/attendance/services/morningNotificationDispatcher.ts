/**
 * morningNotificationDispatcher.ts
 * خدمة الإرسال والربط الهرمي لإشعارات البصمة مع منع التكرار (Idempotency)
 * مديرية اتصالات ومعلوماتية كربلاء — إطار عمل B.R.I.C.K (النواة المعمارية FE-ATT-01 / OPS-03)
 */

import { supabase } from '../../../lib/supabase';
import { sendPushNotification } from '../../../services/notifications';
import type {
  AttendanceNotificationCandidate,
  HierarchySupervisors,
  ApprovedTimeOffInfo
} from '../engines/morningAttendanceNotificationsEngine';
import {
  evaluateMorningLateArrival,
  evaluateMorningEarlyDeparture,
  evaluateMidShiftTimeOffPunches,
  buildMissingMorningEveningBridgeNotifications,
  buildMissingMidnightBridgeNotifications,
  buildOffDayPunchNotifications,
  buildEarlyMorningPunchNotifications
} from '../engines/morningAttendanceNotificationsEngine';
import { getBaghdadMinutes, createBaghdadIso } from '../engines/rosterAttendanceEngine';

/**
 * استخراج المسؤول المباشر والبديل للموظف استناداً إلى شجرة الهيكلية الإدارية
 * مع تطبيق قاعدة التصعيد الهرمي (Climbing hierarchy) إذا كان الموظف نفسه هو المسؤول
 * وقاعدة استثناء البديل إذا كان الحقل فارغاً أو كان هو نفس الموظف
 */
export async function resolveHierarchySupervisors(employeeId: string): Promise<HierarchySupervisors> {
  try {
    const { data: empProfile } = await supabase
      .from('profiles')
      .select('id, department_id, governorate')
      .eq('id', employeeId)
      .maybeSingle();

    if (!empProfile?.department_id) {
      return { managerId: null, deputyManagerId: null };
    }

    // جلب بيانات الأقسام بالكامل لتتبع الشجرة
    const { data: depts } = await supabase
      .from('departments')
      .select('id, name, parent_id, manager_id, deputy_manager_id');

    if (!depts || depts.length === 0) {
      return { managerId: null, deputyManagerId: null };
    }

    const currentDept = depts.find(d => d.id === empProfile.department_id);
    if (!currentDept) {
      return { managerId: null, deputyManagerId: null };
    }

    // 1. استخراج البديل من نفس تشكيل الموظف
    let rawDeputyId = currentDept.deputy_manager_id || null;
    // استثناء البديل إذا كان هو نفس الموظف
    if (rawDeputyId === employeeId) {
      rawDeputyId = null;
    }

    // 2. استخراج المسؤول المباشر مع التصعيد إذا كان الموظف هو المسؤول
    let managerId: string | null = null;
    let walkDept: any = currentDept;

    while (walkDept) {
      if (walkDept.manager_id && walkDept.manager_id !== employeeId) {
        managerId = walkDept.manager_id;
        break;
      }
      // إذا كان الموظف هو المسؤول، اصعد للقسم الأب
      walkDept = depts.find(d => d.id === walkDept.parent_id);
    }

    // إذا لم نجد مديراً في الشجرة، نأخذ مديراً عاماً كبديل احتياطي
    if (!managerId) {
      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('governorate', empProfile.governorate || 'karbala')
        .in('admin_role', ['general', 'attendance_supervisor', 'biometric'])
        .neq('id', employeeId)
        .limit(1);

      if (adminProfiles && adminProfiles.length > 0) {
        managerId = adminProfiles[0].id;
      }
    }

    // إذا كان البديل هو نفس المدير الذي تم اختياره، يُلغى البديل
    if (rawDeputyId && rawDeputyId === managerId) {
      rawDeputyId = null;
    }

    return {
      managerId,
      deputyManagerId: rawDeputyId
    };
  } catch (err) {
    console.error('Error in resolveHierarchySupervisors:', err);
    return { managerId: null, deputyManagerId: null };
  }
}

/**
 * إرسال الإشعارات مع التحقق الصارم من عدم التكرار (Idempotency Check)
 */
export async function dispatchAttendanceNotifications(
  candidates: AttendanceNotificationCandidate[]
): Promise<number> {
  if (!candidates || candidates.length === 0) return 0;

  try {
    // 1. تصفية المرشحين بناءً على وجود recipientId حقيقي
    const validCandidates = candidates.filter(c => Boolean(c.recipientId));
    if (validCandidates.length === 0) return 0;

    // 2. فحص الإشعارات المسجلة مسبقاً بنفس dedupKey
    const dedupKeys = validCandidates.map(c => c.dedupKey);
    const recipientIds = [...new Set(validCandidates.map(c => c.recipientId))];

    const { data: existingNotifs, error: checkErr } = await supabase
      .from('system_notifications')
      .select('id, recipient_id, metadata')
      .in('recipient_id', recipientIds)
      .in('metadata->>dedup_key', dedupKeys);

    if (checkErr) {
      console.warn('dispatchAttendanceNotifications: check existing error:', checkErr);
    }

    const alreadySentSet = new Set<string>();
    if (existingNotifs) {
      for (const n of existingNotifs) {
        const dKey = (n.metadata as any)?.dedup_key;
        if (dKey) {
          alreadySentSet.add(`${n.recipient_id}|${dKey}`);
        }
      }
    }

    // 3. عزل المرشحين الجدد فقط
    const newCandidates = validCandidates.filter(
      c => !alreadySentSet.has(`${c.recipientId}|${c.dedupKey}`)
    );

    if (newCandidates.length === 0) {
      return 0; // تم إرسال كافة الإشعارات مسبقاً
    }

    // 4. كتابة الإشعارات في system_notifications
    const insertRows = newCandidates.map(c => ({
      recipient_id: c.recipientId,
      type: c.type,
      title: c.title,
      content: c.content,
      is_read: false,
      metadata: {
        ...c.metadata,
        dedup_key: c.dedupKey
      }
    }));

    const { error: insertErr } = await supabase
      .from('system_notifications')
      .insert(insertRows);

    if (insertErr) {
      console.error('dispatchAttendanceNotifications: Insert error:', insertErr);
      return 0;
    }

    // 5. إرسال Push Notifications للمستلمين في الخلفية
    const pushPromises = newCandidates.map(c =>
      sendPushNotification(c.recipientId, c.content, {
        title: c.title,
        url: window?.location?.origin ? `${window.location.origin}/admin` : undefined
      }).catch(e => console.warn('Push error:', e))
    );
    await Promise.allSettled(pushPromises);

    return newCandidates.length;
  } catch (err) {
    console.error('Error in dispatchAttendanceNotifications:', err);
    return 0;
  }
}

/**
 * التدقيق البعدي بأثر رجعي للبصمات المفقودة (نهاية الصباحي المتصل بالمسائي، أو منتصف الخفر)
 * يُستدعى بعد انتهاء اليوم أو بعد 00:30 لتقييم اليوم السابق أو السجل المنتهي
 */
export async function auditRetroactiveMissingPunchesForEmployee(
  employeeId: string,
  recordDate: string,
  shiftType: 'connected_evening' | 'night_guard',
  hasPunchedInWindow: boolean
): Promise<void> {
  if (hasPunchedInWindow) return; // تم تثبيت البصمة ولا يوجد نقص

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', employeeId)
      .maybeSingle();

    const empName = profile?.full_name || 'موظف';
    const supervisors = await resolveHierarchySupervisors(employeeId);

    if (shiftType === 'connected_evening') {
      const candidates = buildMissingMorningEveningBridgeNotifications(
        employeeId,
        empName,
        recordDate,
        supervisors
      );
      await dispatchAttendanceNotifications(candidates);
    } else if (shiftType === 'night_guard') {
      const candidates = buildMissingMidnightBridgeNotifications(
        employeeId,
        empName,
        recordDate,
        supervisors
      );
      await dispatchAttendanceNotifications(candidates);
    }
  } catch (err) {
    console.error('Error in auditRetroactiveMissingPunchesForEmployee:', err);
  }
}

export interface ProcessPunchParams {
  employeeId: string;
  employeeName: string;
  recordDate: string; // YYYY-MM-DD
  isMorningDuty: boolean; // صباحي اعتيادي أو مناوب لديه صباحي اليوم
  isFollowUpAfterNightShift: boolean; // صباحي ممتد بعد خفر ليلة أمس
  isFollowedByEveningShift: boolean; // صباحي متبوع بمسائي ممتد
  slots: {
    check_in: string | null;
    check_out: string | null;
    time_leave_out?: string | null;
    time_leave_return?: string | null;
  };
  isRestDay: boolean;
  isOfficialHoliday?: boolean;
  isCompensatory?: boolean;
  offDayLabel?: string;
  approvedLeaves: any[];
  isCheckInPunch: boolean;
  isCheckOutPunch: boolean;
}

/**
 * المعالج الرئيسي المتكامل لإطلاق إشعارات البصمة بعد كل حركة حضور أو انصراف
 */
export async function processAttendancePunchNotifications(params: ProcessPunchParams): Promise<void> {
  const {
    employeeId,
    employeeName,
    recordDate,
    isMorningDuty,
    isFollowUpAfterNightShift,
    isFollowedByEveningShift,
    slots,
    isRestDay,
    isOfficialHoliday,
    isCompensatory,
    offDayLabel,
    approvedLeaves,
    isCheckInPunch,
    isCheckOutPunch
  } = params;

  // 1. استخراج المسؤول المباشر والبديل من شجرة الهيكلية
  const supervisors = await resolveHierarchySupervisors(employeeId);
  const allCandidates: AttendanceNotificationCandidate[] = [];

  // 2. فحص البصمة في يوم غير يوم عمل (عطلة رسمية، يوم استراحة، إجازة معتمدة، تعويضي)
  const fullDayLeave = (approvedLeaves || []).find(
    l => l.status === 'approved' && l.leave_type !== 'time_off' && (l.time_duration_minutes || 0) === 0
  );
  const isOffDay = Boolean(isRestDay || isOfficialHoliday || isCompensatory || fullDayLeave);

  if (isOffDay && !isFollowUpAfterNightShift) {
    if (isCheckInPunch && slots.check_in) {
      // تحديد المسمى الدقيق ليوم العطلة أو الاستراحة أو الإجازة
      let resolvedLabel = offDayLabel;
      if (!resolvedLabel) {
        if (isOfficialHoliday) {
          resolvedLabel = 'عطلة رسمية';
        } else if (isCompensatory) {
          resolvedLabel = 'يوم تعويضي';
        } else if (fullDayLeave) {
          const ltype = fullDayLeave.leave_type;
          if (ltype === 'regular') resolvedLabel = 'يوم إجازته الاعتيادية';
          else if (ltype === 'sick') resolvedLabel = 'يوم إجازته المرضية';
          else if (ltype === 'duty') resolvedLabel = 'يوم واجبه الرسمي';
          else if (ltype === 'dispatch') resolvedLabel = 'يوم إيفاده الرسمي';
          else resolvedLabel = 'يوم إجازته الرسمية';
        } else if (isRestDay) {
          resolvedLabel = 'يوم استراحته الرسمية';
        } else {
          resolvedLabel = 'خارج أوقات الدوام الرسمي';
        }
      }

      const offDayCandidates = buildOffDayPunchNotifications({
        employeeId,
        employeeName,
        punchIso: slots.check_in,
        recordDate,
        offDayLabel: resolvedLabel,
        supervisors
      });
      allCandidates.push(...offDayCandidates);
      await dispatchAttendanceNotifications(allCandidates);
    }
    return; // لا تحسب تأخير أو مغادرة مبكرة أو مغادرة غير مبررة في يوم عطلة/استراحة/إجازة
  }

  // إذا لم يكن الموظف مكلفاً بدوام صباحي اليوم (ليس صباحياً ولا مناوباً لديه صباحي)
  if (!isMorningDuty) return;

  // 3. فحص البصمة قبل الساعة 06:00 صباحاً (قبل الدوام الرسمي) لموظف الصباحي
  if (isCheckInPunch && slots.check_in) {
    const { totalMinutes } = getBaghdadMinutes(slots.check_in);
    if (totalMinutes < 6 * 60) {
      const earlyMorningCandidates = buildEarlyMorningPunchNotifications({
        employeeId,
        employeeName,
        punchIso: slots.check_in,
        recordDate,
        supervisors
      });
      allCandidates.push(...earlyMorningCandidates);
    }
  }

  // 4. استخراج الإجازات الزمنية المعتمدة لليوم
  const timeOffs: ApprovedTimeOffInfo[] = (approvedLeaves || []).filter(
    l => l.status === 'approved' && (l.leave_type === 'time_off' || (l.time_duration_minutes || 0) > 0)
  );

  const startTimeOff = timeOffs.find(t => t.time_off_subtype === 'shift_start' || !t.time_off_subtype);
  const endTimeOff = timeOffs.find(t => t.time_off_subtype === 'shift_end');
  const midTimeOff = timeOffs.find(t => t.time_off_subtype === 'mid_shift');

  // 5. فحص التأخير الصباحي عند تسجيل بصمة الدخول
  if (isCheckInPunch && slots.check_in) {
    const lateCandidates = evaluateMorningLateArrival(
      slots.check_in,
      recordDate,
      employeeId,
      employeeName,
      supervisors,
      isFollowUpAfterNightShift,
      startTimeOff
    );
    allCandidates.push(...lateCandidates);
  }

  // 6. فحص الخروج المبكر عند تسجيل بصمة الانصراف
  if (isCheckOutPunch && slots.check_out) {
    const earlyCandidates = evaluateMorningEarlyDeparture(
      slots.check_out,
      recordDate,
      employeeId,
      employeeName,
      supervisors,
      isFollowedByEveningShift,
      endTimeOff
    );
    allCandidates.push(...earlyCandidates);
  }

  // 7. فحص الإجازة الزمنية وسط الدوام إن وجدت بصمات بينية
  if (midTimeOff && (slots.time_leave_out || slots.time_leave_return)) {
    const midCandidates = evaluateMidShiftTimeOffPunches(
      slots.time_leave_out || null,
      slots.time_leave_return || null,
      midTimeOff,
      recordDate,
      employeeId,
      employeeName,
      supervisors
    );
    allCandidates.push(...midCandidates);
  }

  // 8. إرسال المرشحين مع منع التكرار
  if (allCandidates.length > 0) {
    await dispatchAttendanceNotifications(allCandidates);
  }
}

/**
 * التدقيق البعدي بأثر رجعي للبصمات المفقودة (نهاية الصباحي المتصل بالمسائي، أو منتصف الخفر)
 * يبحث في اليوم السابق (أو التاريخ المحدد) عن أي موظف لم يثبت بصمة الحضور المطلوبة
 * فيحقن بصمة افتراضية حمراء ويرسل الإشعارات الرسمية للموظف والمسؤول والبديل
 */
export async function auditDailyPresenceBridgePunches(targetDate?: string): Promise<{ evaluated: number; redPunchesInjected: number }> {
  try {
    // 1. تحديد تاريخ التدقيق (الافتراضي هو يوم أمس بتوقيت بغداد)
    let auditDate = targetDate;
    if (!auditDate) {
      const now = new Date();
      // توقيت بغداد UTC+3
      const baghdadMillis = now.getTime() + 3 * 3600 * 1000;
      const baghdadNow = new Date(baghdadMillis);
      baghdadNow.setUTCDate(baghdadNow.getUTCDate() - 1);
      auditDate = baghdadNow.toISOString().split('T')[0];
    }

    // 2. جلب جميع سجلات الحضور لهذا اليوم
    const { data: records, error: recErr } = await supabase
      .from('attendance_records')
      .select('id, employee_id, raw_punches, notes, department_id, work_schedule_id')
      .gte('created_at', `${auditDate}T00:00:00.000Z`)
      .lte('created_at', `${auditDate}T23:59:59.999Z`);

    if (recErr || !records || records.length === 0) {
      return { evaluated: 0, redPunchesInjected: 0 };
    }

    // جلب جداول المناوبة وأيام الجداول
    const { data: scheduleDays } = await supabase
      .from('schedule_days')
      .select('schedule_id, day_of_week, is_morning, is_evening, is_night, is_rest_day');

    const dow = new Date(`${auditDate}T12:00:00.000Z`).getUTCDay(); // 0=Sun .. 6=Sat

    let redPunchesInjected = 0;

    for (const rec of records) {
      const schDay = (scheduleDays || []).find(
        (s: any) => s.schedule_id === rec.work_schedule_id && s.day_of_week === dow
      );
      if (!schDay) continue;

      const isConnectedEvening = Boolean(schDay.is_morning && schDay.is_evening);
      const isNightGuard = Boolean(schDay.is_night);

      if (!isConnectedEvening && !isNightGuard) continue;

      const rawPunches: any[] = Array.isArray(rec.raw_punches) ? rec.raw_punches : [];
      let needsRedPunch = false;
      let redPunchObj: any = null;
      let alertShiftType: 'connected_evening' | 'night_guard' | null = null;

      // فحص الحالة الأولى: صباحي متبوع بمسائي (14:30 إلى 15:30)
      if (isConnectedEvening) {
        const hasBridgePunch = rawPunches.some((p: any) => {
          if (p.is_virtual) return false;
          const { totalMinutes } = getBaghdadMinutes(p.time);
          return totalMinutes >= (14 * 60 + 30) && totalMinutes <= (15 * 60 + 30);
        });

        if (!hasBridgePunch) {
          const alreadyHasRed = rawPunches.some((p: any) => p.is_virtual && p.notes?.includes('بين الصباحي والمسائي'));
          if (!alreadyHasRed) {
            needsRedPunch = true;
            alertShiftType = 'connected_evening';
            redPunchObj = {
              time: createBaghdadIso(auditDate, 15, 0, 0),
              notes: '(بصمة إثبات حضور افتراضية حمراء - نقص بصمة بين الصباحي والمسائي)',
              is_virtual: true
            };
          }
        }
      }

      // فحص الحالة الثانية: خفر منتصف الليل (23:30 إلى 00:30)
      if (isNightGuard && !needsRedPunch) {
        const hasMidnightPunch = rawPunches.some((p: any) => {
          if (p.is_virtual) return false;
          const { hours, minutes } = getBaghdadMinutes(p.time);
          return (hours === 23 && minutes >= 30) || (hours === 0 && minutes <= 30);
        });

        if (!hasMidnightPunch) {
          const alreadyHasRed = rawPunches.some((p: any) => p.is_virtual && p.notes?.includes('نقص بصمة إثبات حضور الخفر'));
          if (!alreadyHasRed) {
            needsRedPunch = true;
            alertShiftType = 'night_guard';
            redPunchObj = {
              time: createBaghdadIso(auditDate, 23, 59, 59),
              notes: '(بصمة منتصف ليل افتراضية حمراء - نقص بصمة إثبات حضور الخفر)',
              is_virtual: true
            };
          }
        }
      }

      // إذا وُجد نقص وتم إعداد البصمة الافتراضية الحمراء:
      if (needsRedPunch && redPunchObj && alertShiftType) {
        const updatedPunches = [...rawPunches, redPunchObj];
        const newNotes = rec.notes ? `${rec.notes} | ${redPunchObj.notes}` : redPunchObj.notes;

        await supabase
          .from('attendance_records')
          .update({
            raw_punches: updatedPunches,
            notes: newNotes,
            updated_at: new Date().toISOString()
          })
          .eq('id', rec.id);

        redPunchesInjected++;

        // إطلاق الإشعارات فوراً للموظف والمسؤول والبديل
        await auditRetroactiveMissingPunchesForEmployee(
          rec.employee_id,
          auditDate,
          alertShiftType,
          false
        );
      }
    }

    return { evaluated: records.length, redPunchesInjected };
  } catch (err) {
    console.error('Error in auditDailyPresenceBridgePunches:', err);
    return { evaluated: 0, redPunchesInjected: 0 };
  }
}
