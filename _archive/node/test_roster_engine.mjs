/**
 * _archive/node/test_roster_engine.mjs
 * فحص واختبار محرك المناوبين المستقل rosterAttendanceEngine.ts
 */

import {
  evaluateRosterAttendance,
  resolveRosterShiftType,
  getBaghdadMinutes,
  createBaghdadIso
} from '../../src/features/attendance/engines/rosterAttendanceEngine.ts';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('=== بدء اختبارات محرك المناوبين المستقل ===\n');

// 1. اختبار استنتاج نوع الشفت
console.log('Test 1: فحص أنواع الشفتات وأوزانها:');
assert(resolveRosterShiftType({ is_morning: true, is_evening: false, is_night: false, is_rest_day: false }) === 'morning', 'صباحي فقط');
assert(resolveRosterShiftType({ is_morning: false, is_evening: true, is_night: false, is_rest_day: false }) === 'evening', 'مسائي فقط');
assert(resolveRosterShiftType({ is_morning: false, is_evening: false, is_night: true, is_rest_day: false }) === 'night', 'خفر فقط');
assert(resolveRosterShiftType({ is_morning: false, is_evening: true, is_night: true, is_rest_day: false }) === 'connected_evening_night', 'مسائي + خفر');
assert(resolveRosterShiftType({ is_morning: false, is_evening: false, is_night: false, is_rest_day: true }) === 'rest', 'استراحة');

// 2. اختبار حالة المهندس مسلم (بصمات متعددة عصراً دون أن تصبح خروجاً نهائياً)
console.log('\nTest 2: منع بصمات العصر البينية (16:41 و 16:45) من احتلال الانصراف النهائي:');
const testPunches = [
  { time: createBaghdadIso('2026-11-16', 16, 10) }, // دخول
  { time: createBaghdadIso('2026-11-16', 16, 41) }, // نبضة تواجد
  { time: createBaghdadIso('2026-11-16', 16, 45) }  // نبضة تواجد بعد زمنية
];
const res2 = evaluateRosterAttendance(
  testPunches,
  '2026-11-16',
  { is_morning: false, is_evening: true, is_night: true, is_rest_day: false }
);
assert(res2.slots.check_in !== null, 'الدخول مسجل 16:10');
assert(res2.slots.check_out === null, 'الانصراف النهائي فارغ (لم يحن وقت خروج الشفت بعد!)');
assert(res2.slots.time_leave_out !== null, 'البصمة البينية 16:41 مسجلة في الاستراحة/النبضات البينية');
assert(res2.status !== 'early_leave', 'لا توجد عبارة مغادرة مبكرة كاذبة');

// 3. اختبار شفت الخفر مع إثبات بصمة منتصف الليل
console.log('\nTest 3: شفت الخفر مع إثبات بصمة منتصف الليل:');
const punches3 = [
  { time: createBaghdadIso('2026-11-16', 20, 5) },  // دخول الخفر
  { time: createBaghdadIso('2026-11-16', 23, 45) }, // بصمة منتصف الليل
  { time: createBaghdadIso('2026-11-17', 8, 5) }    // خروج صباحي
];
const res3 = evaluateRosterAttendance(
  punches3,
  '2026-11-16',
  { is_morning: false, is_evening: false, is_night: true, is_rest_day: false }
);
assert(res3.midnightStatus === 'verified', 'بصمة منتصف الليل مثبتة بنجاح');
assert(res3.slots.check_out !== null, 'الانصراف مسجل عند 08:05 صباحاً');
assert(res3.supervisorAlert === undefined, 'لا يوجد تنبيه كاميرات لأن البصمة مثبتة');

// 4. اختبار شفت الخفر عند فقدان بصمة منتصف الليل
console.log('\nTest 4: شفت الخفر عند فقدان بصمة منتصف الليل:');
const punches4 = [
  { time: createBaghdadIso('2026-11-16', 20, 5) }, // دخول الخفر
  { time: createBaghdadIso('2026-11-17', 8, 5) }   // خروج صباحي دون بصمة ليلية
];
const res4 = evaluateRosterAttendance(
  punches4,
  '2026-11-16',
  { is_morning: false, is_evening: false, is_night: true, is_rest_day: false },
  { is_night: false },
  [],
  [],
  true // نهاية اليوم
);
assert(res4.midnightStatus === 'missing_virtual_red', 'تم تشخيص فقدان بصمة منتصف الليل');
assert(res4.rawPunches.some(p => p.is_virtual && p.notes?.includes('افتراضية حمراء')), 'تم توليد البصمة الافتراضية الحمراء للأرشيف والتقرير');
assert(res4.supervisorAlert?.includes('مراجعة الكاميرات'), 'تم توليد تنبيه المشرف لمراجعة كاميرات المراقبة');

// 5. اختبار الشفت المتصل (مسائي + خفر = 17.5 ساعة)
console.log('\nTest 5: الشفت المتصل (مسائي + خفر = 17.5 ساعة):');
const punches5 = [
  { time: createBaghdadIso('2026-11-16', 14, 30) }, // دخول المسائي
  { time: createBaghdadIso('2026-11-16', 20, 0) },  // تسليم داخلي
  { time: createBaghdadIso('2026-11-17', 0, 10) },  // منتصف الليل
  { time: createBaghdadIso('2026-11-17', 8, 10) }   // خروج الخفر
];
const res5 = evaluateRosterAttendance(
  punches5,
  '2026-11-16',
  { is_morning: false, is_evening: true, is_night: true, is_rest_day: false }
);
assert(res5.shiftType === 'connected_evening_night', 'نوع الشفت متصل (مسائي + خفر)');
assert(res5.slots.check_in !== null, 'الدخول مسجل 14:30');
assert(res5.slots.check_out !== null, 'الانصراف مسجل 08:10 صباحاً');
assert(res5.midnightStatus === 'verified', 'بصمة منتصف الليل مثبتة');

// 6. اختبار الإجازة الزمنية في بداية الشفت (shift_start)
console.log('\nTest 6: إجازة زمنية معتمدة في بداية الشفت (shift_start):');
const punches6 = [
  { time: createBaghdadIso('2026-11-16', 15, 15) } // حضور متأخر 45 دقيقة
];
const res6 = evaluateRosterAttendance(
  punches6,
  '2026-11-16',
  { is_morning: false, is_evening: true, is_night: false, is_rest_day: false },
  { is_night: false },
  [],
  [{ id: '1', leave_type: 'time_off', time_off_subtype: 'shift_start', start_date: '2026-11-16', status: 'approved', time_duration_minutes: 60 }]
);
assert(res6.status === 'present', 'الحالة حضور مثبت (التأخير مغطى بالزمنية)');
assert(res6.notes.includes('تغطية زمنية بداية الشفت'), 'تم توثيق تغطية بداية الشفت');

// 7. اختبار يوم الاستراحة
console.log('\nTest 7: يوم استراحة في جدول المناوبة:');
const res7 = evaluateRosterAttendance(
  [],
  '2026-11-16',
  { is_morning: false, is_evening: false, is_night: false, is_rest_day: true }
);
assert(res7.status === 'rest_day', 'تم تشخيصه كيوم استراحة');

// 8. اختبار يوم إجازة اعتيادية
console.log('\nTest 8: تغطية إجازة اعتيادية معتمدة:');
const res8 = evaluateRosterAttendance(
  [],
  '2026-11-16',
  { is_morning: false, is_evening: true, is_night: false, is_rest_day: false },
  { is_night: false },
  [{ id: 'l1', leave_type: 'regular', start_date: '2026-11-16', end_date: '2026-11-16', status: 'approved', reason: 'إجازة اعتيادية' }]
);
assert(res8.status === 'on_leave', 'الحالة مجاز رسمياً');

// 9. اختبار تجاوز 6 بصمات وتوليد ملاحظة الـ PDF
console.log('\nTest 9: تجاوز 6 بصمات وتوليد ملاحظة الـ PDF:');
const punches9 = [
  { time: createBaghdadIso('2026-11-16', 14, 30) },
  { time: createBaghdadIso('2026-11-16', 15, 0) },
  { time: createBaghdadIso('2026-11-16', 16, 0) },
  { time: createBaghdadIso('2026-11-16', 17, 0) },
  { time: createBaghdadIso('2026-11-16', 18, 0) },
  { time: createBaghdadIso('2026-11-16', 19, 0) },
  { time: createBaghdadIso('2026-11-16', 20, 15) } // السابعة (انصراف)
];
const res9 = evaluateRosterAttendance(
  punches9,
  '2026-11-16',
  { is_morning: false, is_evening: true, is_night: false, is_rest_day: false }
);
assert(res9.hasOverflowPunches === true, 'تم رصد تجاوز 6 بصمات');
assert(res9.pdfNote?.includes('بصمات إضافية مؤرشفة'), 'توليد ملاحظة الـ PDF الأصولية');
assert(res9.slots.check_out !== null, 'البصمة السابعة استقرت في خانة الانصراف');

console.log(`\n========================================`);
console.log(`النتيجة الإجمالية: ${passed} ناجح | ${failed} فاشل`);
console.log(`========================================`);
if (failed > 0) process.exit(1);
