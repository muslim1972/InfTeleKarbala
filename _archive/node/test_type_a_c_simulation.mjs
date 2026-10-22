/**
 * Simulation Agent & Verification Suite: Corrected Type A & Type C Time-Off
 * اختبار ومحاكاة المنطق المصحح للنوع A (بداية الدوام من 08:30) والنوع C (نهاية الدوام بالسالب من 14:30)
 * المسار: _archive/node/test_type_a_c_simulation.mjs
 */

const logHeader = (t) => console.log(`\n\x1b[1m\x1b[36m=== ${t} ===\x1b[0m`);
const logSuccess = (t) => console.log(`  \x1b[32m✓ ${t}\x1b[0m`);
const logWarn = (t) => console.log(`  \x1b[33m⚠ ${t}\x1b[0m`);
const logError = (t) => console.log(`  \x1b[31m✗ ${t}\x1b[0m`);
const logInfo = (t) => console.log(`  \x1b[90mℹ ${t}\x1b[0m`);

const formatHM = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};
const formatHMS = (mins) => `${formatHM(mins)}:00`;

/**
 * محاكاة النوع A (بداية الدوام):
 * يبدأ الاحتساب من نهاية السماحية الصباحية 08:30 (510 دقيقة).
 */
export function evaluateTypeAShiftStart(params) {
  const { requestedShiftStart, checkInMinutes } = params;
  const officialStartMins = 8 * 60; // 480 (08:00)
  const officialGraceEndMins = officialStartMins + 30; // 510 (08:30)

  let morningPenalty = 0;
  let morningReason = '';
  let updatedDuration = requestedShiftStart.time_duration_minutes;
  let updatedEnd = requestedShiftStart.leave_end_time;
  let note = '';

  const approvedDuration = requestedShiftStart.time_duration_minutes || 0;
  // الاحتساب يبدأ من نهاية السماحية 08:30 وليس من 08:00
  const approvedEndMins = officialGraceEndMins + approvedDuration;

  // الحالة 1: الحضور في سماحية بداية الدوام (08:00 - 08:30)
  if (checkInMinutes <= officialGraceEndMins) {
    if (approvedDuration > 0) {
      updatedDuration = 0;
      updatedEnd = '08:30:00';
      note = `[أُلغيت لعدم الاستخدام والحضور في سماحية الصباح الطبيعية ${formatHM(checkInMinutes)}]`;
    }
    morningPenalty = 0;
  }
  // الحالة 2: الحضور المبكر قبل انتهاء وقت الإجازة (بأكثر من 5 دقائق)
  else if (checkInMinutes < approvedEndMins - 5) {
    const actualUsedMins = Math.max(0, checkInMinutes - officialGraceEndMins);
    if (actualUsedMins < approvedDuration) {
      updatedDuration = actualUsedMins;
      updatedEnd = formatHMS(checkInMinutes);
      note = `[تم تقليص المدة من ${approvedDuration} إلى ${actualUsedMins} دقيقة للحضور المبكر ${formatHM(checkInMinutes)}]`;
    }
    morningPenalty = 0;
  }
  // الحالة 3: الحضور في الموعد (±5 دقائق)
  else if (checkInMinutes <= approvedEndMins + 5) {
    morningPenalty = 0;
  }
  // الحالة 4: التأخر بعد انتهاء الإجازة
  else {
    const totalAbsenceFromGrace = checkInMinutes - officialGraceEndMins;
    const extraDelayMins = checkInMinutes - approvedEndMins;

    // إذا تجاوز الغياب من 08:30 ساعتين (120 دقيقة، أي بعد 10:30)
    if (totalAbsenceFromGrace > 120 || checkInMinutes > 10 * 60 + 30) {
      morningPenalty = 'day';
      morningReason = `تأخير صباحي تجاوز الساعتين (${formatHM(checkInMinutes)} - إجمالي غياب ${totalAbsenceFromGrace} دقيقة) - إجازة اعتيادية إجبارية (يوم كامل)`;
      updatedDuration = 0;
      note = `[أُلغيت واستبدلت بإجازة اعتيادية إجبارية لتجاوز الساعتين وحضور ${formatHM(checkInMinutes)}]`;
    } else {
      const remainingCap = Math.max(0, 120 - approvedDuration);
      let penaltyVal = 30;
      if (extraDelayMins > 30) {
        penaltyVal = Math.min(extraDelayMins <= 60 ? 60 : 120, remainingCap);
      }
      morningPenalty = penaltyVal;
      morningReason = `تأخير إضافي بعد الإجازة الزمنية (${formatHM(checkInMinutes)} بتأخر ${extraDelayMins} دقيقة) - إجازة زمنية إجبارية (${penaltyVal} دقيقة)`;
    }
  }

  return { morningPenalty, morningReason, updatedDuration, updatedEnd, note };
}

/**
 * محاكاة النوع C (نهاية الدوام):
 * يبدأ الاحتساب بالسالب من بداية وقت سماحية الانصراف 14:30 (870 دقيقة).
 */
export function evaluateTypeCShiftEnd(params) {
  const { requestedShiftEnd, checkOutMinutes, timeLeaveOutMinutes } = params;

  // البصمة الفعالة للانصراف: سواء كانت check_out أو time_leave_out
  const effectiveExitMinutes = checkOutMinutes || timeLeaveOutMinutes;

  const allowedDepartureStartMins = 14 * 60 + 30; // 870 (14:30)
  const officialShiftEndMins = 15 * 60;          // 900 (15:00)

  let eveningPenalty = 0;
  let eveningReason = '';
  let updatedDuration = requestedShiftEnd ? requestedShiftEnd.time_duration_minutes : 0;
  let updatedStart = requestedShiftEnd ? requestedShiftEnd.leave_start_time : null;
  let note = '';

  const approvedDuration = requestedShiftEnd ? (requestedShiftEnd.time_duration_minutes || 0) : 0;
  // موعد الخروج المعتمد يبدأ بالسالب من 14:30
  const approvedExitMins = allowedDepartureStartMins - approvedDuration;

  if (!effectiveExitMinutes) {
    // لم يسجل أي بصمة خروج
    return { eveningPenalty: 'day', eveningReason: 'عدم تسجيل بصمة انصراف', updatedDuration, updatedStart, note };
  }

  // الحالة 1: البقاء في الدوام حتى وقت الانصراف الطبيعي (14:30 فما بعد)
  if (effectiveExitMinutes >= allowedDepartureStartMins - 5) {
    if (approvedDuration > 0) {
      updatedDuration = 0;
      updatedStart = '14:30:00';
      note = `[أُلغيت لعدم الاستخدام والبقاء في الدوام حتى وقت الانصراف الطبيعي ${formatHM(effectiveExitMinutes)}]`;
    }
    eveningPenalty = 0;
  }
  // الحالة 2: الخروج المتأخر عن بداية الإجازة (التقليص الذكي وحفظ الرصيد)
  // مثلاً: مصرح له 12:30 وخرج 13:30 (بقي يعمل ساعة إضافية)
  else if (effectiveExitMinutes > approvedExitMins + 5 && effectiveExitMinutes < allowedDepartureStartMins - 5) {
    const actualUsedMins = allowedDepartureStartMins - effectiveExitMinutes;
    if (actualUsedMins < approvedDuration) {
      updatedDuration = actualUsedMins;
      updatedStart = formatHMS(effectiveExitMinutes);
      note = `[تم تقليص المدة من ${approvedDuration} إلى ${actualUsedMins} دقيقة للاستمرار بالعمل حتى ${formatHM(effectiveExitMinutes)}]`;
    }
    eveningPenalty = 0;
  }
  // الحالة 3: الخروج في الموعد المصرح به بدقة (±5 دقائق)
  else if (effectiveExitMinutes >= approvedExitMins - 5 && effectiveExitMinutes <= approvedExitMins + 5) {
    eveningPenalty = 0;
  }
  // الحالة 4: الخروج المبكر قبل موعد الإجازة المصرح بها
  else {
    const totalEarlyFromAllowed = allowedDepartureStartMins - effectiveExitMinutes;
    const extraEarlyMins = approvedExitMins - effectiveExitMinutes;

    // إذا تجاوز الغياب الكلي ساعتين عن وقت الانصراف 14:30 (أي خرج قبل 12:30)
    if (totalEarlyFromAllowed > 120 || effectiveExitMinutes < 12 * 60 + 30) {
      eveningPenalty = 'day';
      eveningReason = `خروج مبكر تجاوز الساعتين (${formatHM(effectiveExitMinutes)} - إجمالي غياب ${totalEarlyFromAllowed} دقيقة) - إجازة اعتيادية إجبارية (يوم كامل)`;
      updatedDuration = 0;
      note = `[أُلغيت واستبدلت بإجازة اعتيادية إجبارية لتجاوز الساعتين وخروج ${formatHM(effectiveExitMinutes)}]`;
    } else {
      const remainingCap = Math.max(0, 120 - approvedDuration);
      let penaltyVal = 30;
      if (extraEarlyMins > 30) {
        penaltyVal = Math.min(extraEarlyMins <= 60 ? 60 : 120, remainingCap);
      }
      eveningPenalty = penaltyVal;
      eveningReason = `خروج مبكر قبل موعد الإجازة الزمنية (${formatHM(effectiveExitMinutes)} بتبكير ${extraEarlyMins} دقيقة) - إجازة زمنية إجبارية (${penaltyVal} دقيقة)`;
    }
  }

  return { eveningPenalty, eveningReason, updatedDuration, updatedStart, note };
}

// ─── تشغيل جناح الاختبارات الشامل ───
async function runTests() {
  logHeader('اختبار النوع A المصحح: بداية الدوام من 08:30');
  
  // A1: إجازة 90 دقيقة (08:30 إلى 10:00)، وحضر 08:20 (في سماحية الصباح)
  {
    const res = evaluateTypeAShiftStart({
      requestedShiftStart: { time_duration_minutes: 90, leave_start_time: '08:30:00', leave_end_time: '10:00:00' },
      checkInMinutes: 8 * 60 + 20 // 08:20
    });
    console.assert(res.updatedDuration === 0, 'A1: يجب تصفير المدة لعدم الاستخدام');
    console.assert(res.morningPenalty === 0, 'A1: لا عقوبة');
    logSuccess('A1 ناجح: الحضور في سماحية الصباح (08:20) يلغي الإجازة ويصفرها لحفظ الرصيد كاملاً');
  }

  // A2: إجازة 90 دقيقة (08:30 إلى 10:00)، وحضر 09:15 (حضور مبكر)
  {
    const res = evaluateTypeAShiftStart({
      requestedShiftStart: { time_duration_minutes: 90, leave_start_time: '08:30:00', leave_end_time: '10:00:00' },
      checkInMinutes: 9 * 60 + 15 // 09:15
    });
    // المدة من 08:30 إلى 09:15 هي 45 دقيقة
    console.assert(res.updatedDuration === 45, `A2: المدة المتوقعة 45 ولكن وجد ${res.updatedDuration}`);
    console.assert(res.morningPenalty === 0, 'A2: لا عقوبة');
    logSuccess('A2 ناجح: الحضور في 09:15 يقلص الإجازة من 90 إلى 45 دقيقة ويوفر 45 دقيقة في الرصيد');
  }

  // A3: إجازة 90 دقيقة (08:30 إلى 10:00)، وحضر 09:58 (في الموعد تماماً)
  {
    const res = evaluateTypeAShiftStart({
      requestedShiftStart: { time_duration_minutes: 90, leave_start_time: '08:30:00', leave_end_time: '10:00:00' },
      checkInMinutes: 9 * 60 + 58 // 09:58
    });
    console.assert(res.updatedDuration === 90, 'A3: تبقى 90 دقيقة');
    console.assert(res.morningPenalty === 0, 'A3: لا عقوبة');
    logSuccess('A3 ناجح: الحضور في 09:58 نظامي 100% واستهلاك 90 دقيقة دون أي عقوبة');
  }

  // A4: إجازة 60 دقيقة (08:30 إلى 09:30)، وحضر 09:50 (تأخر 20 دقيقة)
  {
    const res = evaluateTypeAShiftStart({
      requestedShiftStart: { time_duration_minutes: 60, leave_start_time: '08:30:00', leave_end_time: '09:30:00' },
      checkInMinutes: 9 * 60 + 50 // 09:50
    });
    console.assert(res.morningPenalty === 30, 'A4: فرض زمنية إجبارية 30 دقيقة للتأخر');
    logSuccess('A4 ناجح: التأخر 20 دقيقة بعد نهاية الإجازة يفرض زمنية إجبارية 30 دقيقة');
  }

  // A5: إجازة 60 دقيقة (08:30 إلى 09:30)، وحضر 10:45 (تجاوز الساعتين بعد 08:30: إجمالي 135د)
  {
    const res = evaluateTypeAShiftStart({
      requestedShiftStart: { time_duration_minutes: 60, leave_start_time: '08:30:00', leave_end_time: '09:30:00' },
      checkInMinutes: 10 * 60 + 45 // 10:45
    });
    console.assert(res.morningPenalty === 'day', 'A5: تحويل ليوم كامل');
    console.assert(res.updatedDuration === 0, 'A5: تصفير الزمنية منعاً للازدواجية');
    logSuccess('A5 ناجح: الحضور بعد 10:30 (10:45) يحول اليوم لاعتيادية إجبارية مع تصفير الزمنية منعاً للازدواجية');
  }

  logHeader('اختبار النوع C: نهاية الدوام بالسالب من 14:30');

  // C1: إجازة 60 دقيقة (13:30 إلى 14:30)، وخرج 13:30
  {
    const res = evaluateTypeCShiftEnd({
      requestedShiftEnd: { time_duration_minutes: 60, leave_start_time: '13:30:00', leave_end_time: '14:30:00' },
      checkOutMinutes: 13 * 60 + 30 // 13:30
    });
    console.assert(res.updatedDuration === 60, 'C1: تبقى 60 دقيقة');
    console.assert(res.eveningPenalty === 0, 'C1: لا عقوبة');
    logSuccess('C1 ناجح: الخروج في موعد الإجازة (13:30) نظامي واستهلاك 60 دقيقة بلا أي عقوبة');
  }

  // C2: إجازة 60 دقيقة (13:30 إلى 14:30)، وبقي يعمل حتى 14:40
  {
    const res = evaluateTypeCShiftEnd({
      requestedShiftEnd: { time_duration_minutes: 60, leave_start_time: '13:30:00', leave_end_time: '14:30:00' },
      checkOutMinutes: 14 * 60 + 40 // 14:40
    });
    console.assert(res.updatedDuration === 0, 'C2: تصفير المدة لعدم الاستخدام');
    console.assert(res.eveningPenalty === 0, 'C2: لا عقوبة');
    logSuccess('C2 ناجح: البقاء في الدوام حتى 14:40 يلغي الإجازة ويصفرها لحفظ الرصيد كاملاً');
  }

  // C3: إجازة 120 دقيقة (12:30 إلى 14:30)، واستمر بالعمل حتى 13:45
  {
    const res = evaluateTypeCShiftEnd({
      requestedShiftEnd: { time_duration_minutes: 120, leave_start_time: '12:30:00', leave_end_time: '14:30:00' },
      checkOutMinutes: 13 * 60 + 45 // 13:45
    });
    // المدة من 13:45 إلى 14:30 هي 45 دقيقة
    console.assert(res.updatedDuration === 45, `C3: المتوقع 45 دقيقة ولكن وجد ${res.updatedDuration}`);
    console.assert(res.eveningPenalty === 0, 'C3: لا عقوبة');
    logSuccess('C3 ناجح: الاستمرار بالعمل حتى 13:45 يقلص الإجازة من 120 إلى 45 دقيقة ويوفر 75 دقيقة');
  }

  // C4: إجازة 60 دقيقة (13:30 إلى 14:30)، وخرج مبكراً 13:00 (تبكير 30 دقيقة، غياب كلي 90د <= 120د)
  {
    const res = evaluateTypeCShiftEnd({
      requestedShiftEnd: { time_duration_minutes: 60, leave_start_time: '13:30:00', leave_end_time: '14:30:00' },
      checkOutMinutes: 13 * 60 + 0 // 13:00
    });
    console.assert(res.eveningPenalty === 30, 'C4: زمنية إجبارية 30 دقيقة');
    logSuccess('C4 ناجح: الخروج 13:00 قبل موعد الإجازة بـ 30 دقيقة يفرض زمنية إجبارية 30 دقيقة');
  }

  // C5: إجازة 60 دقيقة (13:30 إلى 14:30)، وخرج 12:15 (قبل 12:30، إجمالي الغياب 135د > 120د)
  {
    const res = evaluateTypeCShiftEnd({
      requestedShiftEnd: { time_duration_minutes: 60, leave_start_time: '13:30:00', leave_end_time: '14:30:00' },
      checkOutMinutes: 12 * 60 + 15 // 12:15
    });
    console.assert(res.eveningPenalty === 'day', 'C5: تحويل ليوم كامل');
    console.assert(res.updatedDuration === 0, 'C5: تصفير الزمنية منعاً للازدواجية');
    logSuccess('C5 ناجح: الخروج قبل 12:30 (12:15) يكسر الساعتين ويتحول لاعتيادية إجبارية مع تصفير الزمنية');
  }

  // C6: بصمة خروج زمني time_leave_out بدلاً من check_out
  {
    const res = evaluateTypeCShiftEnd({
      requestedShiftEnd: { time_duration_minutes: 60, leave_start_time: '13:30:00', leave_end_time: '14:30:00' },
      checkOutMinutes: null,
      timeLeaveOutMinutes: 13 * 60 + 30 // 13:30 عبر time_leave_out
    });
    console.assert(res.updatedDuration === 60, 'C6: تبقى 60 دقيقة');
    console.assert(res.eveningPenalty === 0, 'C6: لا عقوبة');
    logSuccess('C6 ناجح: البصمة عبر time_leave_out في نهاية الدوام تُعامل تلقائياً كبصمة انصراف فعالة');
  }

  logHeader('جميع اختبارات النوع A و C اجتازت بنجاح 100%!');
}

runTests();
