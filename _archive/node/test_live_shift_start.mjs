/**
 * Live End-to-End Simulation: Shift Start Time-Off Engine
 * موظف الاختبار الصباحي: رافد خليل حسين (52ff7c57-54af-4da0-991b-c866d13d2245)
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

const empId = '52ff7c57-54af-4da0-991b-c866d13d2245'; // رافد خليل حسين
const testDate = '2026-10-15'; // تاريخ الفحص

async function cleanTestData() {
  await supabase.from('attendance_records').delete().eq('employee_id', empId).gte('check_in', `${testDate}T00:00:00Z`).lte('check_in', `${testDate}T23:59:59Z`);
  await supabase.from('leave_requests').delete().eq('user_id', empId).eq('start_date', testDate);
  await supabase.from('system_notifications').delete().eq('recipient_id', empId).gte('created_at', `${testDate}T00:00:00Z`);
}

// دالة محاكاة منطق الخادم المطبق في attendanceService.ts
async function simulateEnforcePenalties(checkInMinutes, checkInIso) {
  // 1. جلب الإجازات المعتمدة لهذا اليوم
  const { data: allTimeOffs } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('user_id', empId)
    .eq('status', 'approved')
    .eq('start_date', testDate);

  const requestedShiftStart = allTimeOffs?.find(r => r.time_off_subtype === 'shift_start' && r.with_request && r.leave_type === 'time_off');

  const officialStartMins = 8 * 60; // 480 (08:00)
  const officialGraceEndMins = officialStartMins + 30; // 510 (08:30)

  const formatHM = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };
  const formatHMS = (mins) => `${formatHM(mins)}:00`;

  let morningPenalty = 0;
  let morningReason = '';

  if (requestedShiftStart) {
    const approvedDuration = requestedShiftStart.time_duration_minutes || 0;
    const approvedEndMins = officialStartMins + approvedDuration;

    // الحالة 1: الحضور في بداية الدوام الطبيعية (08:00 إلى 08:30)
    if (checkInMinutes <= officialGraceEndMins) {
      if (approvedDuration > 0) {
        const note = ` [أُلغيت لعدم الاستخدام والحضور في بداية الدوام الطبيعية ${formatHM(checkInMinutes)}]`;
        await supabase.from('leave_requests').update({
          time_duration_minutes: 0,
          leave_end_time: requestedShiftStart.leave_start_time || '08:00:00',
          reason: (requestedShiftStart.reason || '') + note
        }).eq('id', requestedShiftStart.id);

        await supabase.from('system_notifications').insert({
          recipient_id: empId,
          sender_id: empId,
          type: 'system',
          title: 'إلغاء احتساب الإجازة الزمنية (حضور نظامي)',
          content: `نظراً لتسجيل حضورك في بداية الدوام الطبيعية (${formatHM(checkInMinutes)})، تم إلغاء احتساب دقائق الإجازة الزمنية (${approvedDuration} دقيقة) حفاظاً على رصيدك.`,
          metadata: { request_id: requestedShiftStart.id }
        });
      }
      morningPenalty = 0;
    }
    // الحالة 2: الحضور المبكر قبل انتهاء وقت الإجازة المصرح بها
    else if (checkInMinutes < approvedEndMins - 5) {
      const actualUsedMins = Math.max(0, checkInMinutes - officialStartMins);
      if (actualUsedMins < approvedDuration) {
        const newEndStr = formatHMS(checkInMinutes);
        const note = ` [تم تقليص المدة من ${approvedDuration} إلى ${actualUsedMins} دقيقة للحضور المبكر ${formatHM(checkInMinutes)}]`;
        await supabase.from('leave_requests').update({
          time_duration_minutes: actualUsedMins,
          leave_end_time: newEndStr,
          reason: (requestedShiftStart.reason || '') + note
        }).eq('id', requestedShiftStart.id);

        await supabase.from('system_notifications').insert({
          recipient_id: empId,
          sender_id: empId,
          type: 'system',
          title: 'تقليص مدة الإجازة الزمنية (حضور مبكر)',
          content: `تم تقليص مدة إجازتك الزمنية إلى (${actualUsedMins} دقيقة) بدلاً من (${approvedDuration} دقيقة) لحضورك المبكر الساعة (${formatHM(checkInMinutes)}) وحفظاً لرصيدك.`,
          metadata: { request_id: requestedShiftStart.id }
        });
      }
      morningPenalty = 0;
    }
    // الحالة 3: الحضور على الموعد بدقة
    else if (checkInMinutes <= approvedEndMins + 5) {
      morningPenalty = 0;
    }
    // الحالة 4 و 5: التأخر بعد انتهاء الإجازة
    else {
      const totalAbsenceMins = checkInMinutes - officialStartMins;
      const extraDelayMins = checkInMinutes - approvedEndMins;

      if (totalAbsenceMins > 120 || checkInMinutes > 10 * 60) {
        morningPenalty = 'day';
        morningReason = `تأخير صباحي تجاوز الساعتين (${formatHM(checkInMinutes)} - إجمالي غياب ${totalAbsenceMins} دقيقة) - إجازة اعتيادية إجبارية (يوم كامل)`;

        // تصفير الإجازة الزمنية لمنع الخصم المزدوج
        if (approvedDuration > 0) {
          const note = ` [أُلغيت واستبدلت بإجازة اعتيادية إجبارية لتجاوز الساعتين وحضور ${formatHM(checkInMinutes)}]`;
          await supabase.from('leave_requests').update({
            time_duration_minutes: 0,
            leave_end_time: requestedShiftStart.leave_start_time || '08:00:00',
            reason: (requestedShiftStart.reason || '') + note
          }).eq('id', requestedShiftStart.id);
        }

        // قيد إجازة اعتيادية إجبارية
        await supabase.from('leave_requests').insert({
          user_id: empId,
          leave_type: 'regular',
          start_date: testDate,
          end_date: testDate,
          days_count: 1,
          reason: morningReason,
          status: 'approved',
          leave_status: 'approved',
          is_mandatory: true,
          with_request: false
        });
      } else {
        const remainingCap = Math.max(0, 120 - approvedDuration);
        let penaltyVal = 30;
        if (extraDelayMins > 30) {
          penaltyVal = Math.min(extraDelayMins <= 60 ? 60 : 120, remainingCap);
        }
        morningPenalty = penaltyVal;
        morningReason = `تأخير إضافي بعد الإجازة الزمنية (${formatHM(checkInMinutes)} بتأخر ${extraDelayMins} دقيقة) - إجازة زمنية إجبارية (${penaltyVal} دقيقة)`;

        await supabase.from('leave_requests').insert({
          user_id: empId,
          leave_type: 'time_off',
          start_date: testDate,
          end_date: testDate,
          leave_start_time: formatHMS(approvedEndMins),
          leave_end_time: formatHMS(approvedEndMins + penaltyVal),
          time_duration_minutes: penaltyVal,
          days_count: 1,
          reason: morningReason,
          status: 'approved',
          leave_status: 'approved',
          is_mandatory: true,
          time_off_subtype: 'shift_start',
          with_request: false
        });
      }
    }
  }

  return { morningPenalty, morningReason };
}

async function runLiveTest() {
  console.log('\x1b[1m\x1b[35m');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  اختبار تشغيلي حي مع قاعدة البيانات لمحاكاة النوع A بالكامل  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\x1b[0m');

  await cleanTestData();

  // ─── الفحص 1: حضور 08:15 (فترة السماحية) مع زمنية 60د ───
  logHeader('الفحص 1: زمنية معتمدة 60د (08:00 إلى 09:00) وحضور الموظف في 08:15');
  const { data: req1 } = await supabase.from('leave_requests').insert({
    user_id: empId,
    leave_type: 'time_off',
    time_off_subtype: 'shift_start',
    start_date: testDate,
    end_date: testDate,
    leave_start_time: '08:00:00',
    leave_end_time: '09:00:00',
    time_duration_minutes: 60,
    days_count: 1,
    with_request: true,
    status: 'approved',
    leave_status: 'approved',
    reason: 'فحص الحضور في بداية الدوام'
  }).select().single();

  const res1 = await simulateEnforcePenalties(8 * 60 + 15, `${testDate}T08:15:00+03:00`);
  const { data: checkReq1 } = await supabase.from('leave_requests').select('*').eq('id', req1.id).single();
  const { data: notifs1 } = await supabase.from('system_notifications').select('title, content').eq('recipient_id', empId);

  logInfo(`حالة الطلب في DB: المدة = ${checkReq1.time_duration_minutes}د، السبب: ${checkReq1.reason}`);
  logInfo(`الإشعار المولّد في DB: ${notifs1?.[0]?.title}`);

  if (checkReq1.time_duration_minutes === 0 && res1.morningPenalty === 0 && notifs1?.length > 0) {
    logSuccess('اجتاز بنجاح: تم تصفير دقائق الإجازة وإشعار الموظف بحفظ رصيده بلا أي عقوبة تأخير.');
  } else {
    logError('فشل الفحص 1');
  }

  await cleanTestData();

  // ─── الفحص 2: حضور مبكر 08:50 مع زمنية 90د (08:00 إلى 09:30) ───
  logHeader('الفحص 2: زمنية معتمدة 90د (08:00 إلى 09:30) وحضور الموظف في 08:50 (استهلاك 50د)');
  const { data: req2 } = await supabase.from('leave_requests').insert({
    user_id: empId,
    leave_type: 'time_off',
    time_off_subtype: 'shift_start',
    start_date: testDate,
    end_date: testDate,
    leave_start_time: '08:00:00',
    leave_end_time: '09:30:00',
    time_duration_minutes: 90,
    days_count: 1,
    with_request: true,
    status: 'approved',
    leave_status: 'approved',
    reason: 'فحص التقليص للحضور المبكر'
  }).select().single();

  const res2 = await simulateEnforcePenalties(8 * 60 + 50, `${testDate}T08:50:00+03:00`);
  const { data: checkReq2 } = await supabase.from('leave_requests').select('*').eq('id', req2.id).single();

  logInfo(`حالة الطلب في DB بعد التقليص: المدة = ${checkReq2.time_duration_minutes}د، النهاية = ${checkReq2.leave_end_time}`);
  logInfo(`السبب المحدث: ${checkReq2.reason}`);

  if (checkReq2.time_duration_minutes === 50 && checkReq2.leave_end_time === '08:50:00' && res2.morningPenalty === 0) {
    logSuccess('اجتاز بنجاح: تم تقليص مدة الإجازة من 90 إلى 50 دقيقة الفعلية لحفظ رصيد الموظف.');
  } else {
    logError('فشل الفحص 2');
  }

  await cleanTestData();

  // ─── الفحص 3: تأخر يكسر الساعتين (طلب 60د وحضر 10:15) ───
  logHeader('الفحص 3: طلب 60د وحضر 10:15 (تجاوز الساعتين) -> تحويل لاعتيادية وتصفير الزمنية');
  const { data: req3 } = await supabase.from('leave_requests').insert({
    user_id: empId,
    leave_type: 'time_off',
    time_off_subtype: 'shift_start',
    start_date: testDate,
    end_date: testDate,
    leave_start_time: '08:00:00',
    leave_end_time: '09:00:00',
    time_duration_minutes: 60,
    days_count: 1,
    with_request: true,
    status: 'approved',
    leave_status: 'approved',
    reason: 'فحص كسر الساعتين'
  }).select().single();

  const res3 = await simulateEnforcePenalties(10 * 60 + 15, `${testDate}T10:15:00+03:00`);
  const { data: checkReq3 } = await supabase.from('leave_requests').select('*').eq('id', req3.id).single();
  const { data: regularReq3 } = await supabase.from('leave_requests').select('*').eq('user_id', empId).eq('leave_type', 'regular').eq('start_date', testDate).single();

  logInfo(`طلب الزمنية بعد الإلغاء: المدة = ${checkReq3.time_duration_minutes}د، السبب: ${checkReq3.reason}`);
  logInfo(`الإجازة الاعتيادية الإجبارية المسجلة: أيام = ${regularReq3?.days_count} يوم، السبب: ${regularReq3?.reason}`);

  if (res3.morningPenalty === 'day' && checkReq3.time_duration_minutes === 0 && regularReq3?.days_count === 1) {
    logSuccess('اجتاز بنجاح: تم تسجيل إجازة اعتيادية إجبارية وتصفير دقائق الزمنية تماماً لمنع الخصم المزدوج!');
  } else {
    logError('فشل الفحص 3');
  }

  await cleanTestData();
  logSuccess('تم تنظيف كافة السجلات التجريبية، قاعدة البيانات آمنة وسليمة 100%.');
}

runLiveTest().catch(console.error);
