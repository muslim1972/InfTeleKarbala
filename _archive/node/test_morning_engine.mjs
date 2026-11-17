/**
 * test_morning_engine.mjs
 * فحص حتمي شامل لمحرك الدوام الصباحي الجديد (morningAttendanceEngine)
 */

import { evaluateMorningAttendance, checkMorningEarlyPunchAllowed } from '../../src/features/attendance/engines/morningAttendanceEngine.ts';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ فشل الاختبار: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ نجح: ${message}`);
  }
}

console.log('--- بدء اختبارات محرك الدوام الصباحي النقي ---');

const dateStr = '2026-11-16';

// 1. فحص حظر ما قبل 6:00 ص
const pre6Check = checkMorningEarlyPunchAllowed('2026-11-16T02:45:00.000Z'); // 05:45 AM Baghdad
assert(pre6Check.allowed === false, 'حظر البصمة قبل 6:00 ص');
assert(pre6Check.message === 'الدوام الصباحي يبدأ على أقل تقدير عند الساعة 6:00 صباحاً', 'رسالة الحظر قبل 6:00 ص مطابقة');

const post6Check = checkMorningEarlyPunchAllowed('2026-11-16T04:15:00.000Z'); // 07:15 AM Baghdad
assert(post6Check.allowed === true, 'السماح بالبصمة بعد 6:00 ص');

// 2. فحص الدوام النظامي المكتمل (07:30 ص إلى 14:35 م)
const resOnTime = evaluateMorningAttendance([
  { time: '2026-11-16T04:30:00.000Z' }, // 07:30
  { time: '2026-11-16T11:35:00.000Z' }  // 14:35
], dateStr);

assert(resOnTime.status === 'present', 'حالة الدوام المكتمل present');
assert(resOnTime.violations.length === 0, 'صفر مخالفات في الدوام المكتمل');
assert(resOnTime.consolidatedNotifications.length === 0, 'صفر إشعارات في الدوام المكتمل');
assert(resOnTime.slots.check_in !== null, 'تسكين الدخول');
assert(resOnTime.slots.check_out !== null, 'تسكين الانصراف');

// 3. فحص التأخير الصباحي (09:15 ص) والانصراف المبكر (13:45 م)
const resLateEarly = evaluateMorningAttendance([
  { time: '2026-11-16T06:15:00.000Z' }, // 09:15 Baghdad (تأخير 45 دقيقة من 8:30)
  { time: '2026-11-16T10:45:00.000Z' }  // 13:45 Baghdad (مغادرة مبكرة 45 دقيقة عن 14:30)
], dateStr);

assert(resLateEarly.status === 'late', 'حالة التأخير الصباحي late');
assert(resLateEarly.violations.some(v => v.type === 'late_entry' && v.minutes === 45), 'تشخيص 45 دقيقة تأخير');
assert(resLateEarly.violations.some(v => v.type === 'early_leave' && v.minutes === 45), 'تشخيص 45 دقيقة مغادرة مبكرة');
assert(resLateEarly.consolidatedNotifications.length === 2, 'إشعاران للاستيضاح (تأخير + انصراف مبكر)');

// 4. فحص البصمة الواحدة مع تقييم نهاية اليوم (حقن بصمة افتراضية 15:00)
const resSinglePunch = evaluateMorningAttendance([
  { time: '2026-11-16T04:45:00.000Z' } // 07:45 Baghdad
], dateStr, [], undefined, true);

assert(resSinglePunch.virtualCheckOut !== null, 'حقن خروج افتراضي عند نهاية اليوم');
assert(resSinglePunch.slots.check_out.includes('12:00:00'), 'توقيت الخروج الافتراضي يطابق 15:00 بغداد (12:00 UTC)');

// 5. فحص الإجازة الزمنية مع تعدد البصمات داخل وقت الزمنية (10:00 إلى 12:00)
const approvedLeaves = [{
  id: 'leave-1',
  leave_type: 'time_off',
  start_date: dateStr,
  leave_start_time: '10:00:00',
  leave_end_time: '12:00:00',
  time_duration_minutes: 120,
  status: 'approved'
}];

const resTimeLeaveMulti = evaluateMorningAttendance([
  { time: '2026-11-16T05:00:00.000Z' }, // 08:00 دخول
  { time: '2026-11-16T07:05:00.000Z' }, // 10:05 خروج زمنية
  { time: '2026-11-16T07:30:00.000Z' }, // 10:30 بينية
  { time: '2026-11-16T08:15:00.000Z' }, // 11:15 بينية
  { time: '2026-11-16T09:00:00.000Z' }, // 12:00 عودة زمنية
  { time: '2026-11-16T11:40:00.000Z' }  // 14:40 انصراف
], dateStr, approvedLeaves);

assert(resTimeLeaveMulti.slots.time_leave_out === '2026-11-16T07:05:00.000Z', 'البصمة الأولى بالزمنية خروج');
assert(resTimeLeaveMulti.slots.time_leave_return === '2026-11-16T09:00:00.000Z', 'البصمة الأخيرة بالزمنية عودة');
assert(resTimeLeaveMulti.violations.length === 0, 'إلغاء أثر البصمات البينية داخل الزمنية دون مخالفات');

// 6. فحص عودة متأخرة من الزمنية (خرج 10:05 وعاد 12:20)
const resTimeLeaveLate = evaluateMorningAttendance([
  { time: '2026-11-16T05:00:00.000Z' }, // 08:00
  { time: '2026-11-16T07:05:00.000Z' }, // 10:05 خروج زمنية
  { time: '2026-11-16T09:20:00.000Z' }, // 12:20 عودة متأخرة 20 دقيقة
  { time: '2026-11-16T11:45:00.000Z' }  // 14:45 انصراف
], dateStr, approvedLeaves);

assert(resTimeLeaveLate.violations.some(v => v.type === 'time_leave_late_return' && v.minutes === 20), 'تشخيص 20 دقيقة عودة متأخرة');
assert(resTimeLeaveLate.consolidatedNotifications.some(n => n.includes('عودة متأخرة بعد الزمنية بمقدار 20 دقيقة')), 'صياغة إشعار العودة المتأخرة');

// 7. فحص 5 بصمات بدون إجازة زمنية (مغادرتان غير مبررتان مع دمج الإشعارين!)
const resTwoUnjustified = evaluateMorningAttendance([
  { time: '2026-11-16T05:00:00.000Z' }, // 08:00 دخول
  { time: '2026-11-16T06:30:00.000Z' }, // 09:30 خروج غير مبرر 1
  { time: '2026-11-16T07:15:00.000Z' }, // 10:15 عودة 1
  { time: '2026-11-16T08:45:00.000Z' }, // 11:45 خروج غير مبرر 2
  { time: '2026-11-16T09:30:00.000Z' }, // 12:30 عودة 2
  { time: '2026-11-16T11:45:00.000Z' }  // 14:45 انصراف
], dateStr, []);

assert(resTwoUnjustified.consolidatedNotifications.some(n => n.includes('لديك مغادرتان غير مبررتان')), 'دمج مغادرتين غير مبررتين في إشعار واحد');

// 8. فحص البصمة السابعة والثامنة واستبدال البصمة السادسة وتنبيه الـ PDF
const resEightPunches = evaluateMorningAttendance([
  { time: '2026-11-16T05:00:00.000Z' }, // 1: 08:00 دخول
  { time: '2026-11-16T06:30:00.000Z' }, // 2: 09:30 خروج 1
  { time: '2026-11-16T07:15:00.000Z' }, // 3: 10:15 عودة 1
  { time: '2026-11-16T08:45:00.000Z' }, // 4: 11:45 خروج 2
  { time: '2026-11-16T09:30:00.000Z' }, // 5: 12:30 عودة 2
  { time: '2026-11-16T11:30:00.000Z' }, // 6: 14:30 خروج سادس
  { time: '2026-11-16T11:45:00.000Z' }, // 7: 14:45 حلت محل السادس
  { time: '2026-11-16T12:00:00.000Z' }  // 8: 15:00 حلت محل السابع
], dateStr, []);

assert(resEightPunches.slots.check_out === '2026-11-16T12:00:00.000Z', 'البصمة الثامنة تحل محل ما قبلها في الانصراف النهائي');
assert(resEightPunches.hasMoreThanSixPunches === true, 'تأكيد وجود أكثر من 6 بصمات');
assert(resEightPunches.totalPunchesCount === 8, 'العدد الإجمالي 8 بصمات');
assert(resEightPunches.pdfNote.includes('العدد الإجمالي: 8'), 'توليد ملاحظة الـ PDF المشروطة برقم 8');

console.log('--- جميع اختبارات المحرك الصباحي نجحت بنسبة 100% ---');
