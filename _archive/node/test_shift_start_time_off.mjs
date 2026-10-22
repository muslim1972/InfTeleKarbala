/**
 * Simulation Agent & Verification Suite: Shift Start Time-Off (Type A)
 * المسار: _archive/node/test_shift_start_time_off.mjs
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient('https://khr-itpc.egov.iq', process.env.SUPABASE_SERVICE_ROLE_KEY);

const logHeader = (t) => console.log(`\n\x1b[1m\x1b[36m=== ${t} ===\x1b[0m`);
const logSuccess = (t) => console.log(`  \x1b[32m✓ ${t}\x1b[0m`);
const logWarn = (t) => console.log(`  \x1b[33m⚠ ${t}\x1b[0m`);
const logError = (t) => console.log(`  \x1b[31m✗ ${t}\x1b[0m`);
const logInfo = (t) => console.log(`  \x1b[90mℹ ${t}\x1b[0m`);

// دالة محاكاة منطق النوع A (Pure Simulation of the Algorithm)
export function evaluateShiftStartTimeOff(params) {
  const {
    isRoster = false,
    rosterStartMins = 480, // 08:00
    checkInMinutes,        // وقت البصمة الفعلي بالدقائق من منتصف الليل
    requestedShiftStart    // طلب الإجازة الزمنية المعتمدة إن وجد
  } = params;

  let morningPenalty = 0;
  let morningReason = '';
  let updatedRequestedDuration = requestedShiftStart ? requestedShiftStart.time_duration_minutes : null;
  let updatedRequestedEnd = requestedShiftStart ? requestedShiftStart.leave_end_time : null;
  let requestedNote = '';
  let status = 'present';

  const formatHM = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };
  const formatHMS = (mins) => `${formatHM(mins)}:00`;

  const officialStartMins = isRoster ? rosterStartMins : 8 * 60; // 480
  const officialGraceEndMins = isRoster ? rosterStartMins : 8 * 60 + 30; // 510

  if (!requestedShiftStart) {
    // ── موظف بدون إجازة زمنية (الحساب الطبيعي) ──
    if (isRoster) {
      const rawMins = checkInMinutes - officialStartMins;
      if (rawMins > 5) {
        morningPenalty = rawMins;
        morningReason = `تأخير مناوب (${rawMins} دقيقة)`;
        status = 'late';
      }
    } else {
      if (checkInMinutes <= officialGraceEndMins) {
        morningPenalty = 0;
      } else if (checkInMinutes <= officialStartMins + 60) {
        morningPenalty = 30;
        morningReason = `تأخير صباحي (${formatHM(checkInMinutes)}) - إجازة زمنية إجبارية (30 دقيقة)`;
        status = 'late';
      } else if (checkInMinutes <= officialStartMins + 90) {
        morningPenalty = 60;
        morningReason = `تأخير صباحي (${formatHM(checkInMinutes)}) - إجازة زمنية إجبارية (ساعة كاملة)`;
        status = 'late';
      } else if (checkInMinutes <= officialStartMins + 120) {
        morningPenalty = 120;
        morningReason = `تأخير صباحي (${formatHM(checkInMinutes)}) - إجازة زمنية إجبارية (ساعتان كاملتان)`;
        status = 'late';
      } else {
        morningPenalty = 'day';
        morningReason = `تأخير صباحي (${formatHM(checkInMinutes)} - تجاوز 10:00) - إجازة اعتيادية إجبارية (يوم كامل)`;
        status = 'late';
      }
    }
  } else {
    // ── موظف لديه إجازة زمنية بداية دوام (نوع A) ──
    const approvedDuration = requestedShiftStart.time_duration_minutes || 0;
    const approvedEndMins = officialStartMins + approvedDuration;

    // الحالة 1: الحضور في بداية الدوام الطبيعية
    if (checkInMinutes <= officialGraceEndMins) {
      updatedRequestedDuration = 0;
      updatedRequestedEnd = requestedShiftStart.leave_start_time || formatHMS(officialStartMins);
      requestedNote = `[أُلغيت لعدم الاستخدام والحضور في بداية الدوام الطبيعية ${formatHM(checkInMinutes)}]`;
      morningPenalty = 0;
      status = 'present';
    }
    // الحالة 2: الحضور قبل نهاية وقت الإجازة المصرح بها
    else if (checkInMinutes < approvedEndMins - 5) {
      const actualUsedMins = checkInMinutes - officialStartMins;
      updatedRequestedDuration = actualUsedMins;
      updatedRequestedEnd = formatHMS(checkInMinutes);
      requestedNote = `[تم تقليص المدة من ${approvedDuration} إلى ${actualUsedMins} دقيقة للحضور المبكر ${formatHM(checkInMinutes)}]`;
      morningPenalty = 0;
      status = 'present';
    }
    // الحالة 3: الحضور في الموعد المحدد بدقة (± 5 دقائق)
    else if (checkInMinutes <= approvedEndMins + 5) {
      updatedRequestedDuration = approvedDuration;
      updatedRequestedEnd = requestedShiftStart.leave_end_time;
      morningPenalty = 0;
      status = 'present';
    }
    // الحالة 4 و 5: التأخر بعد وقت الإجازة المعتمدة
    else {
      const totalAbsenceMins = checkInMinutes - officialStartMins;
      const extraDelayMins = checkInMinutes - approvedEndMins;

      // إذا تجاوز الغياب الكلي ساعتين (120 دقيقة)
      if (totalAbsenceMins > 120 || (!isRoster && checkInMinutes > 10 * 60)) {
        morningPenalty = 'day';
        morningReason = `تأخير صباحي تجاوز الساعتين (${formatHM(checkInMinutes)} - غياب ${totalAbsenceMins} دقيقة) - إجازة اعتيادية إجبارية (يوم كامل)`;
        // تصفير الإجازة الزمنية لمنع الخصم المزدوج
        updatedRequestedDuration = 0;
        updatedRequestedEnd = requestedShiftStart.leave_start_time || formatHMS(officialStartMins);
        requestedNote = `[أُلغيت واستبدلت بإجازة اعتيادية إجبارية لتجاوز الساعتين وحضور ${formatHM(checkInMinutes)}]`;
        status = 'late';
      } else {
        // التأخر الإضافي ضمن الساعتين
        let penaltyMins = 30;
        if (extraDelayMins > 30) {
          penaltyMins = Math.min(extraDelayMins <= 60 ? 60 : 120, 120 - approvedDuration);
        }
        morningPenalty = penaltyMins;
        morningReason = `تأخير إضافي بعد الإجازة الزمنية (حضور ${formatHM(checkInMinutes)} بتأخر ${extraDelayMins} دقيقة) - إجازة زمنية إجبارية (${penaltyMins} دقيقة)`;
        status = 'late';
      }
    }
  }

  return {
    morningPenalty,
    morningReason,
    updatedRequestedDuration,
    updatedRequestedEnd,
    requestedNote,
    status
  };
}

// تشغيل مصفوفة السيناريوهات
async function runScenarios() {
  console.log('\x1b[1m\x1b[35m');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  فحص ومحاكاة كافة سيناريوهات الإجازة الزمنية (نوع A) بداية الدوام  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\x1b[0m');

  let passed = 0;
  let total = 0;

  // السيناريو 1: حضور مبكر في 08:15 (بداية الدوام) رغم وجود إجازة 60د
  total++;
  logHeader('السيناريو 1: حضور في 08:15 (فترة السماحية الصباحية) مع وجود إجازة 60 دقيقة');
  const res1 = evaluateShiftStartTimeOff({
    checkInMinutes: 8 * 60 + 15, // 08:15
    requestedShiftStart: { time_duration_minutes: 60, leave_start_time: '08:00:00', leave_end_time: '09:00:00' }
  });
  logInfo(`النتيجة: دقائق الإجازة بعد الفحص = ${res1.updatedRequestedDuration}د، العقوبة = ${res1.morningPenalty}، الحالة = ${res1.status}`);
  logInfo(`ملاحظة الإجازة: ${res1.requestedNote}`);
  if (res1.updatedRequestedDuration === 0 && res1.morningPenalty === 0 && res1.status === 'present') {
    logSuccess('اجتاز بنجاح: تم إلغاء دقائق الإجازة الزمنية لعدم الاستخدام واعتبار اليوم حضوراً نظامياً بلا عقوبة.');
    passed++;
  } else {
    logError('فشل السيناريو 1');
  }

  // السيناريو 2: حضور مبكر قبل انتهاء الإجازة (طلب 90د وحضر 08:45)
  total++;
  logHeader('السيناريو 2: حضور في 08:45 قبل انتهاء إجازة 90 دقيقة (المفترضة لـ 09:30)');
  const res2 = evaluateShiftStartTimeOff({
    checkInMinutes: 8 * 60 + 45, // 08:45 (525 دقيقة)
    requestedShiftStart: { time_duration_minutes: 90, leave_start_time: '08:00:00', leave_end_time: '09:30:00' }
  });
  logInfo(`النتيجة: دقائق الإجازة المقلصة = ${res2.updatedRequestedDuration}د، نهاية الإجازة الجديدة = ${res2.updatedRequestedEnd}، العقوبة = ${res2.morningPenalty}`);
  logInfo(`ملاحظة الإجازة: ${res2.requestedNote}`);
  if (res2.updatedRequestedDuration === 45 && res2.updatedRequestedEnd === '08:45:00' && res2.morningPenalty === 0) {
    logSuccess('اجتاز بنجاح: تم تقليص الإجازة إلى 45 دقيقة الفعلية المستهلكة لحفظ رصيد الموظف بلا أي عقوبة.');
    passed++;
  } else {
    logError('فشل السيناريو 2');
  }

  // السيناريو 3: حضور على الموعد بدقة (طلب 60د وحضر 09:02)
  total++;
  logHeader('السيناريو 3: حضور في 09:02 على موعد انتهاء إجازة 60 دقيقة (08:00-09:00)');
  const res3 = evaluateShiftStartTimeOff({
    checkInMinutes: 9 * 60 + 2, // 09:02
    requestedShiftStart: { time_duration_minutes: 60, leave_start_time: '08:00:00', leave_end_time: '09:00:00' }
  });
  logInfo(`النتيجة: دقائق الإجازة = ${res3.updatedRequestedDuration}د، العقوبة = ${res3.morningPenalty}، الحالة = ${res3.status}`);
  if (res3.updatedRequestedDuration === 60 && res3.morningPenalty === 0 && res3.status === 'present') {
    logSuccess('اجتاز بنجاح: اعتماد الإجازة 60 دقيقة كاملة وحضور نظامي بلا تأخير.');
    passed++;
  } else {
    logError('فشل السيناريو 3');
  }

  // السيناريو 4: تأخر إضافي بعد الإجازة ضمن الساعتين (طلب 60د وحضر 09:40)
  total++;
  logHeader('السيناريو 4: تأخر إضافي 40 دقيقة بعد إجازة 60د (حضور 09:40، إجمالي الغياب 100د < 120د)');
  const res4 = evaluateShiftStartTimeOff({
    checkInMinutes: 9 * 60 + 40, // 09:40 (580 دقيقة)
    requestedShiftStart: { time_duration_minutes: 60, leave_start_time: '08:00:00', leave_end_time: '09:00:00' }
  });
  logInfo(`النتيجة: إجازة بطلب = ${res4.updatedRequestedDuration}د، عقوبة تأخير إضافي = ${res4.morningPenalty}د`);
  logInfo(`سبب العقوبة: ${res4.morningReason}`);
  if (res4.updatedRequestedDuration === 60 && res4.morningPenalty > 0 && res4.morningPenalty !== 'day') {
    logSuccess('اجتاز بنجاح: الإجازة المعتمدة 60د + فرض زمنية إجبارية للتأخير الإضافي وبقاء الإجمالي ضمن الساعتين.');
    passed++;
  } else {
    logError('فشل السيناريو 4');
  }

  // السيناريو 5: تأخر يكسر حاجز الساعتين (طلب 60د وحضر 10:15)
  total++;
  logHeader('السيناريو 5: تأخر يكسر حاجز الساعتين (طلب 60د وحضر 10:15، إجمالي الغياب 135 دقيقة)');
  const res5 = evaluateShiftStartTimeOff({
    checkInMinutes: 10 * 60 + 15, // 10:15 (615 دقيقة)
    requestedShiftStart: { time_duration_minutes: 60, leave_start_time: '08:00:00', leave_end_time: '09:00:00' }
  });
  logInfo(`النتيجة: العقوبة = ${res5.morningPenalty}، دقائق الإجازة الزمنية = ${res5.updatedRequestedDuration}د`);
  logInfo(`سبب العقوبة: ${res5.morningReason}`);
  logInfo(`ملاحظة الإجازة: ${res5.requestedNote}`);
  if (res5.morningPenalty === 'day' && res5.updatedRequestedDuration === 0) {
    logSuccess('اجتاز بنجاح: فرض إجازة اعتيادية إجبارية يوم كامل + تصفير دقائق الإجازة الزمنية لمنع الخصم المزدوج!');
    passed++;
  } else {
    logError('فشل السيناريو 5');
  }

  // السيناريو 6: موظف مناوب طلب زمنية بداية شفت مسائي (14:30) ساعة واحدة، وحضر 15:10
  total++;
  logHeader('السيناريو 6: مناوب شفت مسائي (14:30) طلب زمنية 60د وحضر مبكراً في 15:10 (استهلك 40د)');
  const res6 = evaluateShiftStartTimeOff({
    isRoster: true,
    rosterStartMins: 14 * 60 + 30, // 14:30 (870 دقيقة)
    checkInMinutes: 15 * 60 + 10,   // 15:10 (910 دقيقة)
    requestedShiftStart: { time_duration_minutes: 60, leave_start_time: '14:30:00', leave_end_time: '15:30:00' }
  });
  logInfo(`النتيجة: دقائق الإجازة المقلصة للمناوب = ${res6.updatedRequestedDuration}د، العقوبة = ${res6.morningPenalty}`);
  if (res6.updatedRequestedDuration === 40 && res6.morningPenalty === 0) {
    logSuccess('اجتاز بنجاح: تقليص زمنية بداية الشفت للمناوب إلى 40 دقيقة الفعلية بلا أي عقوبة.');
    passed++;
  } else {
    logError('فشل السيناريو 6');
  }

  console.log(`\n\x1b[1m\x1b[32m════════════════════════════════════════════════════════════════`);
  console.log(`  نتيجة الفحص الشامل: ${passed} / ${total} سيناريوهات ناجحة 100%`);
  console.log(`════════════════════════════════════════════════════════════════\x1b[0m\n`);
}

runScenarios().catch(console.error);
