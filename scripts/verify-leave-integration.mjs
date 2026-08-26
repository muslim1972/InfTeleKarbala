/**
 * سكربت تحقق مؤقت لمنطق تكامل الإجازات مع البصمة.
 * يطابق نسخةً حرفية للدوال النقية في leaveIntegrationService.ts
 * (لا يمكن استيراد الملف مباشرة في Node لاعتماده على import.meta.env).
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// ─── نسخ حرفية من الدوال النقية ───
const DAY_LEAVE_TYPES = ['regular', 'long_regular', 'sick', 'duty', 'dispatch'];
const LEAVE_OVERTIME_NOTE_PREFIX = 'دوام إضافي في يوم إجازة';

function isRequestedLeave(req) { return req.with_request !== false; }
function coversDate(req, dateStr) {
  // دلالة end_date في قاعدة البيانات: يوم المباشرة (حصري) متى تجاوز البداية، وإلا يوم واحد
  if (dateStr < req.start_date) return false;
  if (req.end_date && req.end_date > req.start_date) return dateStr < req.end_date;
  return dateStr === req.start_date;
}
function mergeNote(existing, addition) {
  if (!existing) return addition;
  if (existing.includes(addition)) return existing;
  return `${existing} | ${addition}`;
}
function buildLeaveDayOvertimeNote(label) { return `${LEAVE_OVERTIME_NOTE_PREFIX} (${label})`; }
function hasLeaveOvertimeNote(notes) { return !!notes && notes.includes(LEAVE_OVERTIME_NOTE_PREFIX); }

function evaluateTimeLeavePunches(record, timeLeaves) {
  if (!timeLeaves || timeLeaves.length === 0) return null;
  let needsOut = false, needsReturn = false, missingOut = false, missingReturn = false;
  for (const l of timeLeaves) {
    const leaveNeedsOut = l.subtype !== 'shift_start';
    const leaveNeedsReturn = l.subtype !== 'shift_end';
    needsOut = needsOut || leaveNeedsOut;
    needsReturn = needsReturn || leaveNeedsReturn;
    // بصمة خروج الراحة تُعتمد دائماً، أما الانصراف ففي "نهاية الدوام" فقط
    const hasOut = !!(record?.time_leave_out || record?.time_leave_out_2) ||
      (l.subtype === 'shift_end' && !!record?.check_out);
    // بصمة عودة الراحة تُعتمد دائماً، أما الوصول ففي "بداية الدوام" فقط
    const hasReturn = !!(record?.time_leave_return || record?.time_leave_return_2) ||
      (l.subtype === 'shift_start' && !!record?.check_in);
    if (leaveNeedsOut && !hasOut) missingOut = true;
    if (leaveNeedsReturn && !hasReturn) missingReturn = true;
  }
  let message = null;
  const totalMinutes = timeLeaves.reduce((s, l) => s + (l.minutes || 0), 0);
  const dur = totalMinutes > 0 ? ` (${totalMinutes} دقيقة)` : '';
  if (missingOut && missingReturn) message = `طلب إجازة زمنية${dur} لكنه لم يثبت بصمة خروج أو عودة`;
  else if (missingOut) message = `طلب إجازة زمنية${dur} لكنه لم يثبت بصمة خروج`;
  else if (missingReturn) message = `طلب إجازة زمنية${dur} لكنه لم يثبت بصمة عودة`;
  return { needsOut, needsReturn, hasOut: needsOut ? !missingOut : true, hasReturn: needsReturn ? !missingReturn : true, missingOut, missingReturn, message };
}

// ─── أداة الاختبار ───
let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.error(`  ❌ ${name}`); }
}

console.log('═══ 1) السيناريو الأول: إجازات اعتيادية (يوم كامل) ═══');
check('إجازة اعتيادية تُصنَّف يوم إجازة (تُستثنى من الغياب)', DAY_LEAVE_TYPES.includes('regular'));
check('الإجازة الزمنية ليست إجازة يوم كامل', !DAY_LEAVE_TYPES.includes('time_off'));
check('العقوبة التوليدية (with_request=false) ليست طلباً', isRequestedLeave({ with_request: false }) === false);
check('طلب الموظف (with_request=null) مقبول', isRequestedLeave({ with_request: null }) === true);

// ملاحظة الدوام الإضافي
const note1 = mergeNote(undefined, buildLeaveDayOvertimeNote('إجازة اعتيادية'));
check('ملاحظة الدوام الإضافي تُبنى بالنوع', note1 === 'دوام إضافي في يوم إجازة (إجازة اعتيادية)');
check('التقارير تكشف ملاحظة الدوام الإضافي', hasLeaveOvertimeNote(note1) === true);
check('ملاحظات عادية لا تُشعل كشف الدوام الإضافي', hasLeaveOvertimeNote('بصمة يدوية') === false);
check('الملاحظات الفارغة آمنة', hasLeaveOvertimeNote(undefined) === false && hasLeaveOvertimeNote('') === false);
const note2 = mergeNote(note1, buildLeaveDayOvertimeNote('إجازة اعتيادية'));
check('الدمج لا يكرر ملاحظة الدوام الإضافي', note2 === note1);
const note3 = mergeNote('(دخول: جهاز غير معتمد)', buildLeaveDayOvertimeNote('واجب رسمي'));
check('الدمج يحافظ على الملاحظات السابقة', note3 === '(دخول: جهاز غير معتمد) | دوام إضافي في يوم إجازة (واجب رسمي)');

// coversDate
check('coversDate: يوم داخل النطاق', coversDate({ start_date: '2026-08-10', end_date: '2026-08-15' }, '2026-08-12') === true);
check('coversDate: يوم قبل النطاق', coversDate({ start_date: '2026-08-10', end_date: '2026-08-15' }, '2026-08-09') === false);
check('coversDate: يوم بعد النطاق', coversDate({ start_date: '2026-08-10', end_date: '2026-08-15' }, '2026-08-16') === false);
check('coversDate: end_date فارغ = يوم واحد', coversDate({ start_date: '2026-08-10', end_date: null }, '2026-08-10') === true);
check('coversDate: end_date فارغ يستثني اليوم التالي', coversDate({ start_date: '2026-08-10', end_date: null }, '2026-08-11') === false);
// دلالة end_date = يوم المباشرة (حصري) — انحدار حالة الإصلاح
check('إجازة يوم واحد (26→27): يوم الإجازة نفسه مغطى', coversDate({ start_date: '2026-08-26', end_date: '2026-08-27' }, '2026-08-26') === true);
check('إجازة يوم واحد (26→27): يوم المباشرة 27 غير مغطى (الخلل المصحَّح)', coversDate({ start_date: '2026-08-26', end_date: '2026-08-27' }, '2026-08-27') === false);
check('إجازة 3 أيام (26→29): اليومان الأوسطان مغطيان', coversDate({ start_date: '2026-08-26', end_date: '2026-08-29' }, '2026-08-27') === true && coversDate({ start_date: '2026-08-26', end_date: '2026-08-29' }, '2026-08-28') === true);
check('إجازة 3 أيام (26→29): يوم المباشرة 29 غير مغطى', coversDate({ start_date: '2026-08-26', end_date: '2026-08-29' }, '2026-08-29') === false);
check('end_date = البداية (زمنية/واجب/إيفاد): يوم واحد فقط', coversDate({ start_date: '2026-08-26', end_date: '2026-08-26' }, '2026-08-26') === true && coversDate({ start_date: '2026-08-26', end_date: '2026-08-26' }, '2026-08-27') === false);

console.log('═══ 2) السيناريو الثاني: الإجازة الزمنية (mid_shift) ═══');
const mid = [{ id: '1', leaveType: 'time_off', subtype: 'mid_shift', minutes: 60 }];
// أ: لا بصمات إطلاقاً (دخل فقط)
let s = evaluateTimeLeavePunches({ check_in: '2026-08-25T08:00:00Z', check_out: null, time_leave_out: null, time_leave_return: null }, mid);
check('وسط الدوام بلا أي بصمة خروج/عودة → تحذير كلي', s.missingOut === true && s.missingReturn === true && s.message.includes('خروج أو عودة'));
check('الرسالة تتضمن المدة (60 دقيقة)', s.message.includes('(60 دقيقة)'));
// ب: بصمة خروج فقط
s = evaluateTimeLeavePunches({ check_in: 'T08:00', check_out: null, time_leave_out: 'T11:00', time_leave_return: null }, mid);
check('خروج فقط → تحذير عودة', s.missingOut === false && s.missingReturn === true && s.message.includes('لم يثبت بصمة عودة'));
// ج: بصمة عودة فقط
s = evaluateTimeLeavePunches({ check_in: 'T08:00', check_out: null, time_leave_out: null, time_leave_return: 'T12:00' }, mid);
check('عودة فقط → تحذير خروج', s.missingOut === true && s.missingReturn === false && s.message.includes('لم يثبت بصمة خروج'));
// د: البصمتان معاً
s = evaluateTimeLeavePunches({ check_in: 'T08:00', check_out: null, time_leave_out: 'T11:00', time_leave_return: 'T12:00' }, mid);
check('البصمتان معاً → لا تحذير', s.message === null);
// هـ: الدخول الرئيسي لا يعوّض بصمة العودة في الوسطى (إصلاح مهم)
s = evaluateTimeLeavePunches({ check_in: 'T08:00', check_out: null, time_leave_out: 'T11:00', time_leave_return: null }, mid);
check('الدخول الرئيسي لا يُعتمد عودةً في الوسطى', s.missingReturn === true);
// و: انصراف الموظف بعد خروجه للإجازة (لم يعد) — check_out يعوّض الخروج
s = evaluateTimeLeavePunches({ check_in: 'T08:00', check_out: 'T11:30', time_leave_out: 'T11:00', time_leave_return: null }, mid);
check('الانصراف يُعتمد خروجاً لكن يبقى تحذير العودة', s.missingOut === false && s.missingReturn === true);
// ز: البصمة الثانية
s = evaluateTimeLeavePunches({ check_in: 'T08:00', check_out: 'T15:00', time_leave_out: 'T10:00', time_leave_return: null, time_leave_out_2: 'T12:00', time_leave_return_2: 'T12:45' }, mid);
check('بصمات الراحة الثانية مقبولة', s.message === null);

console.log('═══ 3) الإجازة الزمنية (shift_start: إذن دخول متأخر) ═══');
const sStart = [{ id: '2', leaveType: 'time_off', subtype: 'shift_start', minutes: 45 }];
// أ: لم يحضر بعد
s = evaluateTimeLeavePunches({ check_in: null, check_out: null, time_leave_out: null, time_leave_return: null }, sStart);
check('لم يحضر بعد → يطالَب ببصمة عودة (وصول)', s.needsReturn === true && s.needsOut === false && s.missingReturn === true);
// ب: وصل الدوام (check_in يعوّض العودة في shift_start فقط)
s = evaluateTimeLeavePunches({ check_in: 'T09:45', check_out: null, time_leave_out: null, time_leave_return: null }, sStart);
check('بصمة الوصول تُعتمد عودةً في shift_start → لا تحذير', s.message === null && s.hasReturn === true);
// ج: تسجيل بصمة راحة خروج/عودة صريحة
s = evaluateTimeLeavePunches({ check_in: 'T09:45', check_out: 'T15:00', time_leave_out: 'T09:00', time_leave_return: 'T09:45' }, sStart);
check('البصمات الصريحة مقبولة أيضاً', s.message === null);

console.log('═══ 4) الإجازة الزمنية (shift_end: إذن خروج مبكر) ═══');
const sEnd = [{ id: '3', leaveType: 'time_off', subtype: 'shift_end', minutes: 30 }];
// أ: لم يخرج بعد
s = evaluateTimeLeavePunches({ check_in: 'T08:00', check_out: null, time_leave_out: null, time_leave_return: null }, sEnd);
check('لم ينصرف بعد → يطالَب ببصمة خروج', s.needsOut === true && s.needsReturn === false && s.missingOut === true);
// ب: انصراف = خروج معتمد
s = evaluateTimeLeavePunches({ check_in: 'T08:00', check_out: 'T14:30', time_leave_out: null, time_leave_return: null }, sEnd);
check('بصمة الانصراف تُعتمد خروجاً في shift_end → لا تحذير', s.message === null);
// ج: بصمة عودة وحدها لا تكفي
s = evaluateTimeLeavePunches({ check_in: 'T08:00', check_out: null, time_leave_out: null, time_leave_return: 'T14:30' }, sEnd);
check('بصمة عودة وحدها لا تكفي في shift_end', s.missingOut === true && s.missingReturn === false);

console.log('═══ 5) إجازات زمنية متعددة في نفس اليوم ═══');
const multi = [
  { id: '4', leaveType: 'time_off', subtype: 'shift_start', minutes: 30 },
  { id: '5', leaveType: 'time_off', subtype: 'shift_end', minutes: 30 },
];
// أ: دخل وانصرف فقط (بلا بصمات راحة)
s = evaluateTimeLeavePunches({ check_in: 'T08:30', check_out: 'T14:30', time_leave_out: null, time_leave_return: null }, multi);
check('دخول متأخر + خروج مبكر: الدخول عودة والانصراف خروج → لا تحذير', s.message === null);
// ب: لم ينصرف بعد
s = evaluateTimeLeavePunches({ check_in: 'T08:30', check_out: null, time_leave_out: null, time_leave_return: null }, multi);
check('بلا انصراف → تحذير خروج (بصمة العودة مغطاة بالدخول)', s.missingOut === true && s.missingReturn === false);
// ج: وسطية + بداية معاً → يلزم البصمتان
const midPlusStart = [
  { id: '6', leaveType: 'time_off', subtype: 'mid_shift', minutes: 60 },
  { id: '7', leaveType: 'time_off', subtype: 'shift_start', minutes: 30 },
];
s = evaluateTimeLeavePunches({ check_in: 'T09:00', check_out: 'T15:00', time_leave_out: null, time_leave_return: null }, midPlusStart);
check('وجود وسطية يفرض بصمة الخروج رغم الانصراف و بصمة العودة رغم الدخول', s.missingOut === true && s.missingReturn === true);
check('المدة المجمعة في الرسالة (90 دقيقة)', s.message.includes('(90 دقيقة)'));

console.log('═══ 6) حالات حدية ═══');
check('لا إجازات زمنية → null', evaluateTimeLeavePunches({ check_in: 'T08:00' }, []) === null);
check('سجل معدوم مع إجازات زمنية → يُعالَج دون انفجار', (() => { const r = evaluateTimeLeavePunches(undefined, mid); return r !== null && r.message !== null; })());
check('subtype غير معروف يُعامل كوسطية (بصمتان)', (() => { const r = evaluateTimeLeavePunches({ check_in: 'T08:00', check_out: 'T15:00' }, [{ subtype: null, minutes: 15 }]); return r.needsOut === true && r.needsReturn === true && r.message !== null; })());

console.log(`\n═══════════════════════════════════════`);
console.log(`النتيجة: ${passed} ناجح / ${failed} فاشل`);
process.exit(failed > 0 ? 1 : 0);
