/**
 * morningAttendanceEngine.ts
 * المحرك الحتمي النقي لمعالجة بصمات الحضور والانصراف للدوام الصباحي الاعتيادي لغير المناوبين
 * 
 * القواعد الحاكمة:
 * 1. استيعاب البصمات حتى 6 بصمات، وتسكينها تسلسلياً.
 * 2. البصمة السابعة وما بعدها تحل محل البصمة السادسة في خانة الانصراف النهائي (check_out)،
 *    مع الاحتفاظ بكافة البصمات وصورها في الأرشيف وتوليد تنبيه لتقرير الـ PDF.
 * 3. حظر البصمة قبل 6:00 ص: «الدوام الصباحي يبدأ على أقل تقدير عند الساعة 6:00 صباحاً».
 * 4. الحضور من 6:00 إلى 8:30 ص: حضور نظامي بدون أي إجراء.
 * 5. التأخير من 8:31 فما بعد: حساب التأخير بالدقيقة وتوليد تبليغ استيضاح لإداري القسم.
 * 6. الانصراف قبل 14:30: مغادرة مبكرة وتوليد تبليغ استيضاح لإداري القسم.
 * 7. عند غياب الانصراف في تقييم نهاية اليوم: حقن بصمة افتراضية حمراء عند الساعة 15:00.
 * 8. البصمات داخل الإجازة الزمنية المعتمدة: الأولى خروج والأخيرة عودة، وإلغاء ما بينهما.
 * 9. البصمات الوسطى بدون زمنية: وسمها خروج غير مبرر، مع دمج الإشعارين عند وجود مغادرتين.
 * 10. تخطي عطلات نهاية الأسبوع (الجمعة والسبت) والعطل الرسمية.
 * 11. نزع أي سلطة للتطبيق في كتابة أو إصدار إجازات إجبارية في جداول الإجازات.
 */

import { getBaghdadDate } from '../utils/shiftRules';
import type { RawPunch } from '../utils/punchCategorizer';

export interface MorningLeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date?: string | null;
  leave_start_time?: string | null; // HH:mm:ss
  leave_end_time?: string | null;   // HH:mm:ss
  time_duration_minutes?: number | null;
  status: string;
  reason?: string | null;
}

export interface MorningCalendarInfo {
  isRestDay: boolean;        // عطلة أسبوعية (جمعة / سبت)
  isOfficialHoliday: boolean; // عطلة رسمية عامة
  isCompensatory: boolean;   // يوم تعويضي
  label?: string;            // اسم العطلة أو نوع اليوم
}

export interface MorningViolation {
  type: 'late_entry' | 'early_leave' | 'unjustified_exit' | 'time_leave_late_return' | 'time_leave_early_exit';
  minutes?: number;
  punchTime: string;
  text: string;
}

export interface MorningSlots {
  check_in: string | null;
  check_in_location?: string | null;
  check_in_device_id?: string | null;
  check_in_snapshot_url?: string | null;
  check_in_verified_by_biometric?: boolean;

  time_leave_out: string | null;
  time_leave_return: string | null;
  time_leave_out_2: string | null;
  time_leave_return_2: string | null;

  check_out: string | null;
  check_out_location?: string | null;
  check_out_device_id?: string | null;
  check_out_snapshot_url?: string | null;
  check_out_verified_by_biometric?: boolean;
}

export interface MorningEvaluationResult {
  slots: MorningSlots;
  rawPunches: RawPunch[];
  virtualCheckOut: { time: string; reason: string } | null;
  violations: MorningViolation[];
  consolidatedNotifications: string[];
  hasMoreThanSixPunches: boolean;
  totalPunchesCount: number;
  pdfNote?: string;
  status: 'present' | 'late' | 'early_leave' | 'absent';
  notes: string;
}

const MORNING_DUTY_END = '15:00:00';

/**
 * تحويل تاريخ YYYY-MM-DD ووقت HH:mm:ss بتوقيت بغداد إلى ISO UTC String دقيق
 */
export function baghdadTimeToIso(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm, ss] = timeStr.split(':').map(Number);
  const utcMillis = Date.UTC(y, m - 1, d, hh, mm, ss || 0, 0) - (3 * 3600 * 1000);
  return new Date(utcMillis).toISOString();
}

/**
 * استخراج وقت بغداد بالساعات والدقائق والثواني من ISO string
 */
export function getBaghdadTimeParts(isoString: string): { hours: number; minutes: number; totalMinutes: number; timeStr: string } {
  const d = getBaghdadDate(new Date(isoString));
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();
  const totalMinutes = hours * 60 + minutes;
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return { hours, minutes, totalMinutes, timeStr };
}

/**
 * فحص منع البصمة الصباحية قبل الساعة 6:00 ص
 */
export function checkMorningEarlyPunchAllowed(punchIsoString: string): { allowed: boolean; message?: string } {
  const { totalMinutes } = getBaghdadTimeParts(punchIsoString);
  const sixAmMinutes = 6 * 60; // 06:00
  if (totalMinutes < sixAmMinutes) {
    return {
      allowed: false,
      message: 'الدوام الصباحي يبدأ على أقل تقدير عند الساعة 6:00 صباحاً'
    };
  }
  return { allowed: true };
}

/**
 * المحرك الحتمي لمعالجة بصمات اليوم للدوام الصباحي
 */
export function evaluateMorningAttendance(
  rawPunchesInput: RawPunch[],
  dateStr: string, // YYYY-MM-DD
  approvedLeaves: MorningLeaveRequest[] = [],
  _calendarInfo?: MorningCalendarInfo,
  isEndOfDay: boolean = false
): MorningEvaluationResult {
  const sortedPunches = [...(rawPunchesInput || [])]
    .filter(p => !p.is_virtual && !p.notes?.includes('افتراضي'))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  // 1. تطبيق مهلة الأمان الصارمة (180 ثانية / 3 دقائق)
  const cooldownMs = 3 * 60 * 1000;
  const debouncedPunches: RawPunch[] = [];
  let i = 0;
  while (i < sortedPunches.length) {
    let j = i + 1;
    while (
      j < sortedPunches.length &&
      new Date(sortedPunches[j].time).getTime() - new Date(sortedPunches[j - 1].time).getTime() <= cooldownMs
    ) {
      j++;
    }
    // في مجموعة البصمات المتتالية ضمن 3 دقائق:
    // للبصمة الأولى (دخول) نعتمد الأسبق، ولباقي الحركات نعتمد الأحدث
    if (debouncedPunches.length === 0) {
      debouncedPunches.push(sortedPunches[i]);
    } else {
      debouncedPunches.push(sortedPunches[j - 1]);
    }
    i = j;
  }

  const totalPunchesCount = debouncedPunches.length;
  const hasMoreThanSixPunches = totalPunchesCount > 6;

  // إعداد حقول الخانات الست
  const slots: MorningSlots = {
    check_in: null,
    check_in_location: null,
    check_in_device_id: null,
    check_in_snapshot_url: null,
    check_in_verified_by_biometric: false,

    time_leave_out: null,
    time_leave_return: null,
    time_leave_out_2: null,
    time_leave_return_2: null,

    check_out: null,
    check_out_location: null,
    check_out_device_id: null,
    check_out_snapshot_url: null,
    check_out_verified_by_biometric: false,
  };

  const violations: MorningViolation[] = [];
  const consolidatedNotifications: string[] = [];
  let virtualCheckOut: { time: string; reason: string } | null = null;
  let status: 'present' | 'late' | 'early_leave' | 'absent' = 'present';
  const notesList: string[] = [];

  // إذا لم تكن هناك أي بصمة
  if (totalPunchesCount === 0) {
    return {
      slots,
      rawPunches: [],
      virtualCheckOut: null,
      violations,
      consolidatedNotifications,
      hasMoreThanSixPunches: false,
      totalPunchesCount: 0,
      status: 'absent',
      notes: ''
    };
  }

  // 2. تسكين البصمة الأولى (دخول رئيسي)
  const firstPunch = debouncedPunches[0];
  slots.check_in = firstPunch.time;
  slots.check_in_location = firstPunch.location;
  slots.check_in_device_id = firstPunch.device_id;
  slots.check_in_snapshot_url = firstPunch.snapshot_url;
  slots.check_in_verified_by_biometric = firstPunch.verified_by_biometric;

  const firstParts = getBaghdadTimeParts(firstPunch.time);
  const onTimeLimitMinutes = 8 * 60 + 30; // 08:30 (510 دقيقة)

  // فحص التأخير الصباحي (ابتداءً من 08:31)
  if (firstParts.totalMinutes > onTimeLimitMinutes) {
    const delayMins = firstParts.totalMinutes - onTimeLimitMinutes;
    const h = Math.floor(delayMins / 60);
    const m = delayMins % 60;
    const timeText = h > 0 ? `${h} ساعة و ${m} دقيقة` : `${m} دقيقة`;

    status = 'late';
    violations.push({
      type: 'late_entry',
      minutes: delayMins,
      punchTime: firstParts.timeStr,
      text: `لديك تأخير بمقدار ${timeText} في بداية الدوام ليوم ${dateStr}`
    });

    consolidatedNotifications.push(
      `لديك تأخير بمقدار ${timeText} في بداية الدوام ليوم ${dateStr}، وسيصلك استيضاح ورقي من قبل الإدارة، يرجى التوجه لإداري القسم للإجابة عليه بأسرع وقت.`
    );
    notesList.push(`تأخير صباحي (${timeText})`);
  }

  // 3. فحص الإجازة الزمنية المعتمدة لليوم (إن وجدت)
  const timeLeave = approvedLeaves.find(
    l => l.status === 'approved' &&
         l.leave_start_time &&
         l.leave_end_time &&
         (l.leave_type === 'time_off' || l.leave_type === 'time_leave' || (l.time_duration_minutes || 0) > 0)
  );

  let tlStartMinutes = 0;
  let tlEndMinutes = 0;
  if (timeLeave && timeLeave.leave_start_time && timeLeave.leave_end_time) {
    const [sh, sm] = timeLeave.leave_start_time.split(':').map(Number);
    const [eh, em] = timeLeave.leave_end_time.split(':').map(Number);
    tlStartMinutes = sh * 60 + sm;
    tlEndMinutes = eh * 60 + em;
  }

  // 4. معالجة وتسكين البصمات وفق الحالات المنصوص عليها
  if (totalPunchesCount === 1) {
    // بصمة واحدة فقط طوال اليوم
    if (isEndOfDay) {
      // حقن بصمة افتراضية حمراء عند الساعة 15:00 لغلق الدوام وحساب الساعات
      const virtualIso = baghdadTimeToIso(dateStr, MORNING_DUTY_END);
      virtualCheckOut = {
        time: virtualIso,
        reason: 'خروج افتراضي بنهاية الدوام الصباحي'
      };
      slots.check_out = virtualIso;
      notesList.push('(خروج نهائي افتراضي 15:00)');
    }
  } else if (totalPunchesCount === 2) {
    // بصمتان: الأولى دخول والثانية انصراف
    const p2 = debouncedPunches[1];
    slots.check_out = p2.time;
    slots.check_out_location = p2.location;
    slots.check_out_device_id = p2.device_id;
    slots.check_out_snapshot_url = p2.snapshot_url;
    slots.check_out_verified_by_biometric = p2.verified_by_biometric;

    const p2Parts = getBaghdadTimeParts(p2.time);
    const earlyLimitMinutes = 14 * 60 + 30; // 14:30
    if (p2Parts.totalMinutes < earlyLimitMinutes) {
      const earlyMins = earlyLimitMinutes - p2Parts.totalMinutes;
      const h = Math.floor(earlyMins / 60);
      const m = earlyMins % 60;
      const timeText = h > 0 ? `${h} ساعة و ${m} دقيقة` : `${m} دقيقة`;

      if (status !== 'late') status = 'early_leave';
      violations.push({
        type: 'early_leave',
        minutes: earlyMins,
        punchTime: p2Parts.timeStr,
        text: `لديك مغادرة مبكرة بمقدار ${timeText} في نهاية الدوام ليوم ${dateStr}`
      });

      consolidatedNotifications.push(
        `لديك مغادرة مبكرة بمقدار ${timeText} في نهاية الدوام ليوم ${dateStr}، وسيصلك استيضاح ورقي من قبل الإدارة، يرجى التوجه لإداري القسم للإجابة عليه بأسرع وقت.`
      );
      notesList.push(`مغادرة مبكرة (${timeText})`);
    }
  } else {
    // البصمات من 3 فما فوق
    // البصمة الأخيرة (أو السابعة فما بعدها المستبدلة) هي انصراف نهائي
    const lastPunch = debouncedPunches[debouncedPunches.length - 1];
    slots.check_out = lastPunch.time;
    slots.check_out_location = lastPunch.location;
    slots.check_out_device_id = lastPunch.device_id;
    slots.check_out_snapshot_url = lastPunch.snapshot_url;
    slots.check_out_verified_by_biometric = lastPunch.verified_by_biometric;

    const lastParts = getBaghdadTimeParts(lastPunch.time);
    const earlyLimitMinutes = 14 * 60 + 30; // 14:30
    if (lastParts.totalMinutes < earlyLimitMinutes) {
      const earlyMins = earlyLimitMinutes - lastParts.totalMinutes;
      const h = Math.floor(earlyMins / 60);
      const m = earlyMins % 60;
      const timeText = h > 0 ? `${h} ساعة و ${m} دقيقة` : `${m} دقيقة`;

      if (status !== 'late') status = 'early_leave';
      violations.push({
        type: 'early_leave',
        minutes: earlyMins,
        punchTime: lastParts.timeStr,
        text: `لديك مغادرة مبكرة بمقدار ${timeText} في نهاية الدوام ليوم ${dateStr}`
      });

      consolidatedNotifications.push(
        `لديك مغادرة مبكرة بمقدار ${timeText} في نهاية الدوام ليوم ${dateStr}، وسيصلك استيضاح ورقي من قبل الإدارة، يرجى التوجه لإداري القسم للإجابة عليه بأسرع وقت.`
      );
      notesList.push(`مغادرة مبكرة (${timeText})`);
    }

    // البصمات الوسطى بين الأولى والأخيرة
    // نأخذ البصمات حتى الفهرس 5 (البصمات من 2 إلى 5 قبل الانصراف)
    const middlePunches = debouncedPunches.slice(1, Math.min(totalPunchesCount - 1, 5));

    if (timeLeave && tlStartMinutes > 0 && tlEndMinutes > 0) {
      // ─── الحالة الأولى: لديه إجازة زمنية معتمدة ───
      // قاعدة الباحث م. مسلم: البصمات داخل قوس الزمنية تلغي ما بينها وتأخذ الأولى خروج والأخيرة عودة
      const punchesInsideLeave = middlePunches.filter(p => {
        const parts = getBaghdadTimeParts(p.time);
        return parts.totalMinutes >= tlStartMinutes - 5 && parts.totalMinutes <= tlEndMinutes;
      });

      const punchesAfterLeave = middlePunches.filter(p => {
        const parts = getBaghdadTimeParts(p.time);
        return parts.totalMinutes > tlEndMinutes;
      });

      if (punchesInsideLeave.length > 0) {
        slots.time_leave_out = punchesInsideLeave[0].time;
        if (punchesInsideLeave.length > 1) {
          slots.time_leave_return = punchesInsideLeave[punchesInsideLeave.length - 1].time;
        }
      }

      // إذا كان قد خرج في الزمنية، وجاءت عودته بعد نهاية وقت الزمنية
      if (slots.time_leave_out && !slots.time_leave_return && punchesAfterLeave.length > 0) {
        const returnPunch = punchesAfterLeave[0];
        slots.time_leave_return = returnPunch.time;

        const retParts = getBaghdadTimeParts(returnPunch.time);
        const lateMins = retParts.totalMinutes - tlEndMinutes;
        if (lateMins > 0) {
          const h = Math.floor(lateMins / 60);
          const m = lateMins % 60;
          const timeText = h > 0 ? `${h} ساعة و ${m} دقيقة` : `${m} دقيقة`;

          violations.push({
            type: 'time_leave_late_return',
            minutes: lateMins,
            punchTime: retParts.timeStr,
            text: `لديك عودة متأخرة بعد الزمنية بمقدار ${timeText} ليوم ${dateStr}`
          });

          consolidatedNotifications.push(
            `لديك عودة متأخرة بعد الزمنية بمقدار ${timeText} ليوم ${dateStr}، وسيصلك استيضاح ورقي من قبل الإدارة، يرجى التوجه لإداري القسم للإجابة عليه بأسرع وقت.`
          );
          notesList.push(`عودة متأخرة من الزمنية (${timeText})`);
        }
      }
    } else {
      // ─── الحالة الثانية: لا توجد إجازة زمنية معتمدة ───
      // كل زوج وسطي هو (خروج غير مبرر + عودة)
      const unjustifiedExits: Array<{ outTime: string; returnTime?: string }> = [];

      if (middlePunches.length >= 1) {
        // البصمة 2: خروج غير مبرر أول
        slots.time_leave_out = middlePunches[0].time;
        const outParts = getBaghdadTimeParts(middlePunches[0].time);
        unjustifiedExits.push({ outTime: outParts.timeStr });

        if (middlePunches.length >= 2) {
          // البصمة 3: عودة
          slots.time_leave_return = middlePunches[1].time;
          unjustifiedExits[0].returnTime = getBaghdadTimeParts(middlePunches[1].time).timeStr;
        }

        if (middlePunches.length >= 3) {
          // البصمة 4: خروج غير مبرر ثانٍ
          slots.time_leave_out_2 = middlePunches[2].time;
          const out2Parts = getBaghdadTimeParts(middlePunches[2].time);
          unjustifiedExits.push({ outTime: out2Parts.timeStr });

          if (middlePunches.length >= 4) {
            // البصمة 5: عودة ثانية
            slots.time_leave_return_2 = middlePunches[3].time;
            unjustifiedExits[1].returnTime = getBaghdadTimeParts(middlePunches[3].time).timeStr;
          }
        }
      }

      // صياغة ودمج إشعارات المغادرة غير المبررة
      if (unjustifiedExits.length === 1) {
        violations.push({
          type: 'unjustified_exit',
          punchTime: unjustifiedExits[0].outTime,
          text: `لديك مغادرة غير مبررة عند الساعة ${unjustifiedExits[0].outTime} ليوم ${dateStr}`
        });
        consolidatedNotifications.push(
          `لديك مغادرة غير مبررة عند الساعة ${unjustifiedExits[0].outTime} ليوم ${dateStr}، وسيصلك استيضاح ورقي من قبل الإدارة، يرجى التوجه لإداري القسم للإجابة عليه بأسرع وقت.`
        );
        notesList.push(`مغادرة غير مبررة (${unjustifiedExits[0].outTime})`);
      } else if (unjustifiedExits.length >= 2) {
        violations.push({
          type: 'unjustified_exit',
          punchTime: unjustifiedExits[0].outTime,
          text: `لديك مغادرتان غير مبررتان ليوم ${dateStr}`
        });
        // دمج الخروجين في إشعار واحد كما أمرت الإدارة
        consolidatedNotifications.push(
          `لديك مغادرتان غير مبررتان ليوم ${dateStr}، وسيصلك استيضاح ورقي من قبل الإدارة، يرجى التوجه لإداري القسم للإجابة عليه بأسرع وقت.`
        );
        notesList.push('مغادرتان غير مبررتان');
      }
    }
  }

  // 5. إذا كان هناك أكثر من 6 بصمات: تجهيز تنبيه الـ PDF
  let pdfNote: string | undefined;
  if (hasMoreThanSixPunches) {
    pdfNote = `تنبيه: توجد بصمات إضافية مسجلة بعد البصمة السادسة (العدد الإجمالي: ${totalPunchesCount})، يرجى مراجعة تفاصيل الحركات في النظام`;
    notesList.push(`بصمات إضافية مستبدلة (${totalPunchesCount})`);
  }

  // وسم البصمات المستبدلة في مصفوفة rawPunches
  const processedRawPunches: RawPunch[] = debouncedPunches.map((punch, idx) => {
    if (idx >= 6 && idx < totalPunchesCount - 1) {
      return { ...punch, superseded: true } as any;
    }
    return punch;
  });

  return {
    slots,
    rawPunches: processedRawPunches,
    virtualCheckOut,
    violations,
    consolidatedNotifications,
    hasMoreThanSixPunches,
    totalPunchesCount,
    pdfNote,
    status,
    notes: notesList.join(' | ')
  };
}
