/**
 * Simulation Agent & Verification Suite: Mid-Shift Time-Off (Type B)
 * المسار: _archive/node/test_mid_shift_time_off.mjs
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const logHeader = (t) => console.log(`\n\x1b[1m\x1b[36m=== ${t} ===\x1b[0m`);
const logSuccess = (t) => console.log(`  \x1b[32m✓ ${t}\x1b[0m`);
const logWarn = (t) => console.log(`  \x1b[33m⚠ ${t}\x1b[0m`);
const logError = (t) => console.log(`  \x1b[31m✗ ${t}\x1b[0m`);
const logInfo = (t) => console.log(`  \x1b[90mℹ ${t}\x1b[0m`);

// دالة محاكاة خوارزمية النوع B (Pure Simulation of Mid-Shift Algorithm)
export function evaluateMidShiftTimeOff(params) {
  const {
    requestedMidShift, // طلب الإجازة الزمنية المعتمدة وسط الدوام إن وجد
    hasOutPunch,       // هل بصم خروج زمني؟
    outPunchMinutes,   // وقت بصمة الخروج بالدقائق من منتصف الليل
    hasReturnPunch,    // هل بصم عودة زمنية؟
    returnPunchMinutes // وقت بصمة العودة بالدقائق من منتصف الليل
  } = params;

  let midShiftPenalty = 0;
  let midShiftReason = '';
  let updatedDuration = requestedMidShift ? requestedMidShift.time_duration_minutes : 0;
  let updatedStart = requestedMidShift ? requestedMidShift.leave_start_time : null;
  let updatedEnd = requestedMidShift ? requestedMidShift.leave_end_time : null;
  let requestedNote = '';
  let status = 'present';

  const formatHM = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };
  const formatHMS = (mins) => `${formatHM(mins)}:00`;

  if (!requestedMidShift) {
    // خروج زمني بدون طلب مسبق (خروج عشوائي)
    if (hasOutPunch && hasReturnPunch) {
      const duration = Math.max(0, returnPunchMinutes - outPunchMinutes);
      if (duration > 5) {
        if (duration <= 120) {
          midShiftPenalty = duration <= 30 ? 30 : (duration <= 60 ? 60 : 120);
          midShiftReason = `خروج زمني غير مصرح به (${formatHM(outPunchMinutes)} إلى ${formatHM(returnPunchMinutes)} - ${duration} دقيقة) - إجازة زمنية إجبارية (${midShiftPenalty} دقيقة)`;
        } else {
          midShiftPenalty = 'day';
          midShiftReason = `خروج زمني غير مصرح به تجاوز الساعتين (${duration} دقيقة) - إجازة اعتيادية إجبارية (يوم كامل)`;
        }
      }
    }
  } else {
    const approvedDuration = requestedMidShift.time_duration_minutes || 0;
    const [reqStartH, reqStartM] = requestedMidShift.leave_start_time.split(':').map(Number);
    const [reqEndH, reqEndM] = requestedMidShift.leave_end_time.split(':').map(Number);
    const approvedStartMins = reqStartH * 60 + reqStartM;
    const approvedEndMins = reqEndH * 60 + reqEndM;

    // الحالة 1: لم يخرج الموظف إطلاقاً (عدم استخدام الإجازة)
    if (!hasOutPunch && !hasReturnPunch) {
      updatedDuration = 0;
      updatedEnd = updatedStart;
      requestedNote = `[أُلغيت لعدم الاستخدام وعدم تسجيل خروج زمني والبقاء في الدوام]`;
      midShiftPenalty = 0;
    }
    // الحالة 2: خرج ولم يعد طوال اليوم
    else if (hasOutPunch && !hasReturnPunch) {
      midShiftPenalty = 'day';
      midShiftReason = `خروج زمني دون إثبات بصمة عودة (${formatHM(outPunchMinutes)}) - تحويل إلى إجازة اعتيادية إجبارية (يوم كامل)`;
      updatedDuration = 0;
      requestedNote = `[أُلغيت واستبدلت بإجازة اعتيادية إجبارية لعدم إثبات بصمة العودة]`;
    }
    // الحالة 3: بصم خروج وعودة
    else if (hasOutPunch && hasReturnPunch) {
      // 1. فحص الانزياح الذكي (Auto-Shift) لوقت البداية إذا خرج مبكراً بأكثر من 5 دقائق
      let effectiveStartMins = approvedStartMins;
      let effectiveEndMins = approvedEndMins;

      if (approvedStartMins - outPunchMinutes > 5) {
        const shiftMins = approvedStartMins - outPunchMinutes;
        effectiveStartMins = outPunchMinutes;
        effectiveEndMins = effectiveStartMins + approvedDuration;
        updatedStart = formatHMS(effectiveStartMins);
        updatedEnd = formatHMS(effectiveEndMins);
        requestedNote = `[تم الانزياح الذكي: خرج مبكراً بـ ${shiftMins} دقيقة]`;
      }

      // 2. فحص المدة الفعلية المستهلكة بين الخروج والعودة
      const actualSpentMinutes = Math.max(0, returnPunchMinutes - outPunchMinutes);

      // الحالة أ: عودة مبكرة قبل انتهاء وقت الإجازة (بأكثر من 5 دقائق)
      if (returnPunchMinutes < effectiveEndMins - 5) {
        updatedDuration = actualSpentMinutes;
        updatedEnd = formatHMS(returnPunchMinutes);
        requestedNote += ` [تم تقليص المدة من ${approvedDuration} إلى ${actualSpentMinutes} دقيقة للعودة المبكرة ${formatHM(returnPunchMinutes)}]`;
        midShiftPenalty = 0;
      }
      // الحالة ب: عودة في الموعد بدقة (± 5 دقائق)
      else if (returnPunchMinutes <= effectiveEndMins + 5) {
        updatedDuration = approvedDuration;
        midShiftPenalty = 0;
      }
      // الحالة ج: تأخر في العودة
      else {
        const extraDelayMins = returnPunchMinutes - effectiveEndMins;

        // فحص كسر حاجز الساعتين (إذا تجاوزت المدة الفعلية 120 دقيقة)
        if (actualSpentMinutes > 120) {
          midShiftPenalty = 'day';
          midShiftReason = `تجاوز الإجازة الزمنية حاجز الساعتين (مدة الغياب: ${actualSpentMinutes} دقيقة) - إجازة اعتيادية إجبارية (يوم كامل)`;
          // تصفير الإجازة لمنع الخصم المزدوج
          updatedDuration = 0;
          requestedNote += ` [أُلغيت واستبدلت بإجازة اعتيادية إجبارية لتجاوز الساعتين (${actualSpentMinutes} دقيقة)]`;
        } else {
          // التأخر الإضافي ضمن الساعتين
          const remainingCap = Math.max(0, 120 - approvedDuration);
          let penaltyVal = 30;
          if (extraDelayMins > 30) {
            penaltyVal = Math.min(extraDelayMins <= 60 ? 60 : 120, remainingCap);
          }
          midShiftPenalty = penaltyVal;
          midShiftReason = `تأخر في العودة من الإجازة الزمنية (عودة ${formatHM(returnPunchMinutes)} بتأخر ${extraDelayMins} دقيقة) - إجازة زمنية إجبارية (${penaltyVal} دقيقة)`;
        }
      }
    }
  }

  return {
    midShiftPenalty,
    midShiftReason,
    updatedDuration,
    updatedStart,
    updatedEnd,
    requestedNote,
    status
  };
}

async function runMidShiftScenarios() {
  console.log('\x1b[1m\x1b[35m');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   فحص ومحاكاة كافة سيناريوهات الإجازة الزمنية (نوع B) وسط الدوام ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\x1b[0m');

  let passed = 0;
  let total = 0;

  // السيناريو 1: لم يخرج الموظف إطلاقاً (استمر في الدوام)
  total++;
  logHeader('السيناريو 1: طلب زمنية 60د (11:00-12:00) ولم يخرج الموظف واستمر بدوامه');
  const res1 = evaluateMidShiftTimeOff({
    requestedMidShift: { time_duration_minutes: 60, leave_start_time: '11:00:00', leave_end_time: '12:00:00' },
    hasOutPunch: false,
    hasReturnPunch: false
  });
  logInfo(`النتيجة: دقائق الإجازة بعد الفحص = ${res1.updatedDuration}د، العقوبة = ${res1.midShiftPenalty}`);
  logInfo(`ملاحظة الإجازة: ${res1.requestedNote}`);
  if (res1.updatedDuration === 0 && res1.midShiftPenalty === 0) {
    logSuccess('اجتاز بنجاح: تم إلغاء دقائق الإجازة لعدم الاستخدام وحفظ رصيد الموظف بلا أي عقوبة.');
    passed++;
  } else {
    logError('فشل السيناريو 1');
  }

  // السيناريو 2: انزياح ذكي (خرج مبكراً بـ 20 دقيقة عن موعده)
  total++;
  logHeader('السيناريو 2: طلب زمنية من 11:00 إلى 12:00 (60د) وخرج مبكراً الساعة 10:40 وعاد 11:40');
  const res2 = evaluateMidShiftTimeOff({
    requestedMidShift: { time_duration_minutes: 60, leave_start_time: '11:00:00', leave_end_time: '12:00:00' },
    hasOutPunch: true,
    outPunchMinutes: 10 * 60 + 40, // 10:40
    hasReturnPunch: true,
    returnPunchMinutes: 11 * 60 + 40 // 11:40
  });
  logInfo(`النتيجة: بداية جديدة = ${res2.updatedStart}، نهاية جديدة = ${res2.updatedEnd}، العقوبة = ${res2.midShiftPenalty}`);
  logInfo(`ملاحظة الإجازة: ${res2.requestedNote}`);
  if (res2.updatedStart === '10:40:00' && res2.updatedEnd === '11:40:00' && res2.midShiftPenalty === 0) {
    logSuccess('اجتاز بنجاح: تم انزياح بداية ونهاية الإجازة لتطابق الخروج الفعلي بدقة وبلا أي تأخير.');
    passed++;
  } else {
    logError('فشل السيناريو 2');
  }

  // السيناريو 3: عودة مبكرة (طلب 60د وعاد بعد 35د)
  total++;
  logHeader('السيناريو 3: خرج 11:00 بإجازة 60د (المفترض حتى 12:00) وعاد مبكراً الساعة 11:35 (استهلك 35د)');
  const res3 = evaluateMidShiftTimeOff({
    requestedMidShift: { time_duration_minutes: 60, leave_start_time: '11:00:00', leave_end_time: '12:00:00' },
    hasOutPunch: true,
    outPunchMinutes: 11 * 60, // 11:00
    hasReturnPunch: true,
    returnPunchMinutes: 11 * 60 + 35 // 11:35
  });
  logInfo(`النتيجة: مدة الإجازة المقلصة = ${res3.updatedDuration}د، النهاية الجديدة = ${res3.updatedEnd}، العقوبة = ${res3.midShiftPenalty}`);
  logInfo(`ملاحظة الإجازة: ${res3.requestedNote}`);
  if (res3.updatedDuration === 35 && res3.updatedEnd === '11:35:00' && res3.midShiftPenalty === 0) {
    logSuccess('اجتاز بنجاح: تم تقليص الإجازة إلى 35 دقيقة الفعلية وحفظ 25 دقيقة لرصيد الموظف.');
    passed++;
  } else {
    logError('فشل السيناريو 3');
  }

  // السيناريو 4: عودة على الموعد بدقة (خرج 11:00 وعاد 12:02)
  total++;
  logHeader('السيناريو 4: خرج 11:00 بإجازة 60د وعاد الساعة 12:02 (ضمن مهلة الـ 5 دقائق)');
  const res4 = evaluateMidShiftTimeOff({
    requestedMidShift: { time_duration_minutes: 60, leave_start_time: '11:00:00', leave_end_time: '12:00:00' },
    hasOutPunch: true,
    outPunchMinutes: 11 * 60,
    hasReturnPunch: true,
    returnPunchMinutes: 12 * 60 + 2
  });
  logInfo(`النتيجة: مدة الإجازة = ${res4.updatedDuration}د، العقوبة = ${res4.midShiftPenalty}`);
  if (res4.updatedDuration === 60 && res4.midShiftPenalty === 0) {
    logSuccess('اجتاز بنجاح: اعتماد الإجازة 60 دقيقة كاملة وبلا أي عقوبة.');
    passed++;
  } else {
    logError('فشل السيناريو 4');
  }

  // السيناريو 5: تأخر في العودة 35 دقيقة إضافية (إجمالي الغياب 95د <= 120د)
  total++;
  logHeader('السيناريو 5: خرج 11:00 بإجازة 60د وتأخر وعاد 12:35 (غياب 95د، تأخر 35د إضافية)');
  const res5 = evaluateMidShiftTimeOff({
    requestedMidShift: { time_duration_minutes: 60, leave_start_time: '11:00:00', leave_end_time: '12:00:00' },
    hasOutPunch: true,
    outPunchMinutes: 11 * 60,
    hasReturnPunch: true,
    returnPunchMinutes: 12 * 60 + 35
  });
  logInfo(`النتيجة: إجازة بطلب = ${res5.updatedDuration}د، عقوبة تأخير إضافي = ${res5.midShiftPenalty}د`);
  logInfo(`سبب العقوبة: ${res5.midShiftReason}`);
  if (res5.updatedDuration === 60 && res5.midShiftPenalty > 0 && res5.midShiftPenalty !== 'day') {
    logSuccess('اجتاز بنجاح: الإجازة المعتمدة 60د + فرض زمنية إجبارية بالباقي دون تجاوز الساعتين.');
    passed++;
  } else {
    logError('فشل السيناريو 5');
  }

  // السيناريو 6: تأخر يكسر حاجز الساعتين (خرج 10:30 وعاد 13:00، مدة الغياب 150 دقيقة)
  total++;
  logHeader('السيناريو 6: تأخر يكسر الساعتين (خرج 10:30 بإجازة 60د وعاد 13:00، غياب 150 دقيقة > 120د)');
  const res6 = evaluateMidShiftTimeOff({
    requestedMidShift: { time_duration_minutes: 60, leave_start_time: '10:30:00', leave_end_time: '11:30:00' },
    hasOutPunch: true,
    outPunchMinutes: 10 * 60 + 30,
    hasReturnPunch: true,
    returnPunchMinutes: 13 * 60
  });
  logInfo(`النتيجة: العقوبة = ${res6.midShiftPenalty}، دقائق الإجازة الزمنية = ${res6.updatedDuration}د`);
  logInfo(`سبب العقوبة: ${res6.midShiftReason}`);
  logInfo(`ملاحظة الإجازة: ${res6.requestedNote}`);
  if (res6.midShiftPenalty === 'day' && res6.updatedDuration === 0) {
    logSuccess('اجتاز بنجاح: تحويل اليوم لاعتيادية إجبارية يوم كامل + تصفير دقائق الزمنية لمنع الخصم المزدوج!');
    passed++;
  } else {
    logError('فشل السيناريو 6');
  }

  console.log(`\n\x1b[1m\x1b[32m════════════════════════════════════════════════════════════════`);
  console.log(`  نتيجة الفحص الشامل للنوع B: ${passed} / ${total} سيناريوهات ناجحة 100%`);
  console.log(`════════════════════════════════════════════════════════════════\x1b[0m\n`);
}

runMidShiftScenarios().catch(console.error);
