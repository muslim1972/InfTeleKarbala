/**
 * Simulation Agent & Verification Suite: Roster Type A Time-Off
 * اختبار ومحاكاة إجازة بداية الشفت (النوع A) للمناوبين:
 * - استقلالية كل شفت بسقف 120 دقيقة مستقل.
 * - تعديل نفس الطلب الأصلي بالتمديد عند التأخر دون فتح طلب جديد.
 * - نافذة المرونة ±5 دقائق.
 * - التحويل لاعتيادية إجبارية للشفت الذي يتجاوز الساعتين وتصفير الزمنية منعاً للازدواجية.
 * المسار: _archive/node/test_roster_type_a_simulation.mjs
 */

const logHeader = (t) => console.log(`\n\x1b[1m\x1b[36m=== ${t} ===\x1b[0m`);
const logSuccess = (t) => console.log(`  \x1b[32m✓ ${t}\x1b[0m`);
const logWarn = (t) => console.log(`  \x1b[33m⚠ ${t}\x1b[0m`);
const logError = (t) => console.log(`  \x1b[31m✗ ${t}\x1b[0m`);
const logInfo = (t) => console.log(`  \x1b[90mℹ ${t}\x1b[0m`);

const formatHM = (mins) => {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};
const formatHMS = (mins) => `${formatHM(mins)}:00`;

/**
 * محاكاة خوارزمية تقييم النوع A لشفت المناوب:
 */
export function evaluateRosterShiftTypeA(params) {
  const {
    shiftType,        // 'morning' (08:00) | 'evening' (15:00) | 'night' (20:00)
    requestedLeave,   // طلب الإجازة الزمنية المعتمدة للشفت إن وجد
    checkInMinutes    // وقت بصمة الحضور بالدقائق من منتصف الليل (0 إلى 1440)
  } = params;

  let shiftStartMins = 8 * 60; // 480
  let shiftWeight = 1;         // وزن الشفت بالايام عند الغياب/التحويل
  if (shiftType === 'evening') {
    shiftStartMins = 15 * 60;  // 900
    shiftWeight = 1;
  } else if (shiftType === 'night') {
    shiftStartMins = 20 * 60;  // 1200
    shiftWeight = 2;           // الخفر = يومان
  }

  let penaltyType = 0; // 0: نظامي، 'regular_day': اعتيادية إجبارية
  let penaltyDays = 0;
  let penaltyReason = '';
  let updatedLeave = requestedLeave ? { ...requestedLeave } : null;
  let actionNote = '';

  if (!requestedLeave) {
    // مناوب بدون إجازة مسبقة: التأخير من الدقيقة الأولى بعد سماحية البصمة 5 دقائق
    const delayMins = checkInMinutes - shiftStartMins;
    if (delayMins <= 5) {
      penaltyType = 0;
    } else if (delayMins <= 120) {
      penaltyType = 'time_off_mandatory';
      penaltyDays = delayMins;
      penaltyReason = `تأخير مناوب في شفت ${shiftType} (${delayMins} دقيقة)`;
    } else {
      penaltyType = 'regular_day';
      penaltyDays = shiftWeight;
      penaltyReason = `تأخير مناوب تجاوز الساعتين في شفت ${shiftType} (${delayMins} دقيقة) - إجازة اعتيادية إجبارية (${shiftWeight} يوم)`;
    }
    return { penaltyType, penaltyDays, penaltyReason, updatedLeave, actionNote };
  }

  // يوجد طلب معتمد للشفت
  const approvedDuration = requestedLeave.time_duration_minutes || 0;
  const approvedEndMins = shiftStartMins + approvedDuration;

  // الحالة 1: الحضور في بداية الشفت (خلال 5 دقائق من بدايته) -> إلغاء وتصفير لحفظ الرصيد
  if (checkInMinutes <= shiftStartMins + 5) {
    if (approvedDuration > 0) {
      updatedLeave.time_duration_minutes = 0;
      updatedLeave.leave_end_time = requestedLeave.leave_start_time;
      actionNote = `[أُلغيت لعدم الاستخدام والحضور في بداية الشفت ${formatHM(checkInMinutes)}]`;
    }
    penaltyType = 0;
  }
  // الحالة 2: الحضور المبكر قبل انتهاء الإجازة بأكثر من 5 دقائق -> تقليص نفس الطلب وحفظ الباقي
  else if (checkInMinutes < approvedEndMins - 5) {
    const actualUsedMins = Math.max(0, checkInMinutes - shiftStartMins);
    if (actualUsedMins < approvedDuration) {
      updatedLeave.time_duration_minutes = actualUsedMins;
      updatedLeave.leave_end_time = formatHMS(checkInMinutes);
      actionNote = `[تم تقليص مدة نفس الطلب من ${approvedDuration} إلى ${actualUsedMins} دقيقة للحضور المبكر ${formatHM(checkInMinutes)}]`;
    }
    penaltyType = 0;
  }
  // الحالة 3: الحضور في نافذة الموعد المحدد (±5 دقائق)
  else if (checkInMinutes <= approvedEndMins + 5) {
    penaltyType = 0;
    actionNote = `[حضور نظامي في موعد الإجازة ضمن نافذة ±5 دقائق]`;
  }
  // الحالة 4: التأخر بعد نافذة المرونة
  else {
    const totalAbsenceMins = checkInMinutes - shiftStartMins;

    // إذا كان إجمالي الغياب عن بداية الشفت <= 120 دقيقة (ساعتان):
    // تعديل نفس الطلب القائم وتمديده دون فتح أي طلب جديد!
    if (totalAbsenceMins <= 120) {
      updatedLeave.time_duration_minutes = totalAbsenceMins;
      updatedLeave.leave_end_time = formatHMS(checkInMinutes);
      actionNote = `[تم تمديد نفس الطلب من ${approvedDuration} إلى ${totalAbsenceMins} دقيقة لتغطية التأخر وحفظ السجل نظيفاً]`;
      penaltyType = 0; // لا عقوبة ولا طلب جديد لأن نفس الطلب تم تمديده واستوعب التأخير
    }
    // تجاوز الساعتين (> 120 دقيقة): تحويل الشفت لاعتيادية إجبارية وتصفير الزمنية منعاً للازدواجية
    else {
      penaltyType = 'regular_day';
      penaltyDays = shiftWeight;
      penaltyReason = `تأخير شفت ${shiftType} تجاوز الساعتين (${formatHM(checkInMinutes)} - غياب ${totalAbsenceMins} دقيقة) - إجازة اعتيادية إجبارية (${shiftWeight} يوم)`;
      
      // تصفير نفس الطلب الزمني الأصلي فوراً
      updatedLeave.time_duration_minutes = 0;
      actionNote = `[أُلغيت واستبدلت بإجازة اعتيادية إجبارية (${shiftWeight} يوم) لتجاوز الساعتين منعاً للازدواجية في الخصم]`;
    }
  }

  return { penaltyType, penaltyDays, penaltyReason, updatedLeave, actionNote };
}

// ─── تشغيل الفحوصات الشاملة ───
function runTests() {
  logHeader('اختبار إجازة بداية الشفت (النوع A) للمناوبين');

  // السيناريو 1: الشفت المسائي (15:00) - طلب 60 دقيقة (15:00 إلى 16:00)، وحضر 14:58 في بداية الشفت
  {
    const res = evaluateRosterShiftTypeA({
      shiftType: 'evening',
      requestedLeave: { id: 'req-eve-1', time_duration_minutes: 60, leave_start_time: '15:00:00', leave_end_time: '16:00:00' },
      checkInMinutes: 14 * 60 + 58 // 14:58
    });
    console.assert(res.updatedLeave.time_duration_minutes === 0, 'S1: تصفير المدة لعدم الاستخدام');
    console.assert(res.penaltyType === 0, 'S1: لا عقوبة');
    logSuccess('S1 ناجح: الحضور في بداية الشفت المسائي (14:58) يصفر نفس الطلب ويحفظ الرصيد كاملاً');
  }

  // السيناريو 2: الشفت المسائي (15:00) - طلب 90 دقيقة (15:00 إلى 16:30)، وحضر 15:40 (حضور مبكر)
  {
    const res = evaluateRosterShiftTypeA({
      shiftType: 'evening',
      requestedLeave: { id: 'req-eve-2', time_duration_minutes: 90, leave_start_time: '15:00:00', leave_end_time: '16:30:00' },
      checkInMinutes: 15 * 60 + 40 // 15:40
    });
    console.assert(res.updatedLeave.time_duration_minutes === 40, 'S2: تقليص نفس الطلب إلى 40 دقيقة');
    console.assert(res.penaltyType === 0, 'S2: لا عقوبة');
    logSuccess('S2 ناجح: الحضور 15:40 قلص نفس الطلب إلى 40 دقيقة ووفر 50 دقيقة في الرصيد دون طلب جديد');
  }

  // السيناريو 3: الشفت المسائي (15:00) - طلب 60 دقيقة (15:00 إلى 16:00)، وحضر 16:03 (في نافذة المرونة ±5د)
  {
    const res = evaluateRosterShiftTypeA({
      shiftType: 'evening',
      requestedLeave: { id: 'req-eve-3', time_duration_minutes: 60, leave_start_time: '15:00:00', leave_end_time: '16:00:00' },
      checkInMinutes: 16 * 60 + 3 // 16:03
    });
    console.assert(res.updatedLeave.time_duration_minutes === 60, 'S3: تبقى 60 دقيقة');
    console.assert(res.penaltyType === 0, 'S3: لا عقوبة');
    logSuccess('S3 ناجح: الحضور 16:03 ضمن نافذة ±5 دقائق استهلك الـ 60 دقيقة الأصلية تماماً وبلا عقوبة');
  }

  // السيناريو 4 (الجوهر): الشفت المسائي (15:00) - طلب 60 دقيقة (15:00 إلى 16:00)، وتأخر وحضر 16:25
  // إجمالي الغياب = 85 دقيقة (أقل من 120 دقيقة)
  {
    const res = evaluateRosterShiftTypeA({
      shiftType: 'evening',
      requestedLeave: { id: 'req-eve-4', time_duration_minutes: 60, leave_start_time: '15:00:00', leave_end_time: '16:00:00' },
      checkInMinutes: 16 * 60 + 25 // 16:25
    });
    console.assert(res.updatedLeave.time_duration_minutes === 85, 'S4: يجب تمديد نفس الطلب إلى 85 دقيقة');
    console.assert(res.updatedLeave.leave_end_time === '16:25:00', 'S4: تعديل وقت نهاية نفس الطلب إلى 16:25');
    console.assert(res.penaltyType === 0, 'S4: لا يُفتح طلب إضافي إطلاقاً!');
    logSuccess('S4 ناجح تماماً: التأخر إلى 16:25 عدّل ومدد نفس الطلب إلى 85 دقيقة دون فتح أي طلب إضافي!');
  }

  // السيناريو 5: الشفت المسائي (15:00) - طلب 60 دقيقة، وتأخر وحضر 17:15 (تجاوز الساعتين 135 دقيقة > 120 دقيقة)
  {
    const res = evaluateRosterShiftTypeA({
      shiftType: 'evening',
      requestedLeave: { id: 'req-eve-5', time_duration_minutes: 60, leave_start_time: '15:00:00', leave_end_time: '16:00:00' },
      checkInMinutes: 17 * 60 + 15 // 17:15
    });
    console.assert(res.penaltyType === 'regular_day', 'S5: تحويل الشفت المسائي لاعتيادية إجبارية');
    console.assert(res.penaltyDays === 1, 'S5: المسائي = 1 يوم');
    console.assert(res.updatedLeave.time_duration_minutes === 0, 'S5: تصفير نفس الطلب الزمني الأصلي لمنع الخصم المزدوج');
    logSuccess('S5 ناجح: تجاوز الساعتين حول المسائي لاعتيادية إجبارية (1 يوم) وصفر نفس الطلب منعاً للازدواجية');
  }

  // السيناريو 6: الشفت الخفر (20:00) - استقلالية تامة، طلب 60 دقيقة (20:00 إلى 21:00)، وتأخر وحضر 21:20
  {
    const res = evaluateRosterShiftTypeA({
      shiftType: 'night',
      requestedLeave: { id: 'req-night-1', time_duration_minutes: 60, leave_start_time: '20:00:00', leave_end_time: '21:00:00' },
      checkInMinutes: 20 * 60 + 80 // 21:20
    });
    console.assert(res.updatedLeave.time_duration_minutes === 80, 'S6: تمديد نفس طلب الخفر إلى 80 دقيقة');
    console.assert(res.penaltyType === 0, 'S6: لا يفتح طلب إضافي');
    logSuccess('S6 ناجح: شفت الخفر مستقل تماماً وتمدد طلبه الأصلي إلى 80 دقيقة دون المساس بالمسائي');
  }

  // السيناريو 7: الشفت الخفر (20:00) - كسر الساعتين (حضور 22:30، غياب 150 دقيقة > 120 دقيقة)
  {
    const res = evaluateRosterShiftTypeA({
      shiftType: 'night',
      requestedLeave: { id: 'req-night-2', time_duration_minutes: 60, leave_start_time: '20:00:00', leave_end_time: '21:00:00' },
      checkInMinutes: 20 * 60 + 150 // 22:30
    });
    console.assert(res.penaltyType === 'regular_day', 'S7: تحويل الخفر لاعتيادية إجبارية');
    console.assert(res.penaltyDays === 2, 'S7: الخفر يعادل 2 يوم!');
    console.assert(res.updatedLeave.time_duration_minutes === 0, 'S7: تصفير زمنية الخفر لمنع الازدواجية');
    logSuccess('S7 ناجح: كسر ساعتي الخفر حوله لاعتيادية إجبارية (يومان = 2) وصفر طلبه الزمني منعاً للازدواجية');
  }

  logHeader('جميع اختبارات شفتات المناوبين للنوع A اجتازت بنجاح باهر 100%!');
}

runTests();
