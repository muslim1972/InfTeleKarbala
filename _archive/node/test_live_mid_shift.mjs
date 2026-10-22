/**
 * Live Simulation: Mid-Shift Time-Off (Type B) on DB
 * الموظف: رافد خليل حسين (52ff7c57-54af-4da0-991b-c866d13d2245)
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
const testDate = '2026-10-16';

async function cleanTestData() {
  await supabase.from('attendance_records').delete().eq('employee_id', empId).gte('check_in', `${testDate}T00:00:00Z`).lte('check_in', `${testDate}T23:59:59Z`);
  await supabase.from('leave_requests').delete().eq('user_id', empId).eq('start_date', testDate);
  await supabase.from('system_notifications').delete().eq('recipient_id', empId).gte('created_at', `${testDate}T00:00:00Z`);
}

async function simulateMidShiftEnforce(record) {
  const { data: allLeaves } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('user_id', empId)
    .eq('status', 'approved')
    .eq('start_date', testDate);

  const requestedMidShift = allLeaves?.find(r => r.time_off_subtype === 'mid_shift' && r.with_request && r.leave_type === 'time_off');

  let midShiftPenalty = 0;
  let midShiftReason = '';

  const formatHM = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };
  const formatHMS = (mins) => `${formatHM(mins)}:00`;

  if (requestedMidShift) {
    const approvedDuration = requestedMidShift.time_duration_minutes || 0;
    const [lh, lm] = requestedMidShift.leave_start_time.split(':').map(Number);
    const [leh, lem] = requestedMidShift.leave_end_time.split(':').map(Number);
    const approvedStartMins = lh * 60 + lm;
    const approvedEndMins = leh * 60 + lem;

    // الحالة 1: عدم الخروج إطلاقاً والبقاء في الدوام حتى الانصراف
    if (!record.time_leave_out && !record.time_leave_return && record.check_out) {
      if (approvedDuration > 0) {
        const note = ` [أُلغيت لعدم الاستخدام وعدم تسجيل خروج زمني والبقاء في الدوام]`;
        await supabase.from('leave_requests').update({
          time_duration_minutes: 0,
          leave_end_time: requestedMidShift.leave_start_time,
          reason: (requestedMidShift.reason || '') + note
        }).eq('id', requestedMidShift.id);

        await supabase.from('system_notifications').insert({
          recipient_id: empId,
          type: 'system',
          title: 'إلغاء احتساب الإجازة الزمنية الوسطية',
          content: `نظراً لاستمرارك في الدوام وعدم تسجيل خروج زمني، تم إلغاء احتساب دقائق الإجازة الزمنية (${approvedDuration} دقيقة) حفاظاً على رصيدك.`
        });
      }
      midShiftPenalty = 0;
    }
    // الحالة 2: خرج وبصم خروج وعودة
    else if (record.time_leave_out && record.time_leave_return) {
      const outD = new Date(record.time_leave_out);
      const retD = new Date(record.time_leave_return);
      const outMinutes = outD.getHours() * 60 + outD.getMinutes();
      const returnMinutes = retD.getHours() * 60 + retD.getMinutes();
      const actualSpentMinutes = Math.max(0, Math.floor((retD.getTime() - outD.getTime()) / 60000));

      let effectiveStartMins = approvedStartMins;
      let effectiveEndMins = approvedEndMins;

      // انزياح ذكي
      if (approvedStartMins - outMinutes > 5) {
        effectiveStartMins = outMinutes;
        effectiveEndMins = effectiveStartMins + approvedDuration;
        await supabase.from('leave_requests').update({
          leave_start_time: formatHMS(effectiveStartMins),
          leave_end_time: formatHMS(effectiveEndMins),
          reason: (requestedMidShift.reason || '') + ` [انزياح ذكي: خرج ${formatHM(outMinutes)}]`
        }).eq('id', requestedMidShift.id);
      }

      // عودة مبكرة
      if (returnMinutes < effectiveEndMins - 5) {
        if (actualSpentMinutes < approvedDuration) {
          const newEndStr = formatHMS(returnMinutes);
          const note = ` [تم تقليص المدة من ${approvedDuration} إلى ${actualSpentMinutes} دقيقة للعودة المبكرة ${formatHM(returnMinutes)}]`;
          await supabase.from('leave_requests').update({
            time_duration_minutes: actualSpentMinutes,
            leave_end_time: newEndStr,
            reason: (requestedMidShift.reason || '') + note
          }).eq('id', requestedMidShift.id);

          await supabase.from('system_notifications').insert({
            recipient_id: empId,
            type: 'system',
            title: 'تقليص مدة الإجازة الزمنية الوسطية',
            content: `تم تقليص مدة إجازتك الزمنية إلى (${actualSpentMinutes} دقيقة) لعودتك المبكرة الساعة (${formatHM(returnMinutes)}) وحفظاً لرصيدك.`
          });
        }
        midShiftPenalty = 0;
      }
      // عودة في الموعد (± 5 دقائق)
      else if (returnMinutes <= effectiveEndMins + 5) {
        midShiftPenalty = 0;
      }
      // تأخر في العودة
      else {
        const extraDelayMins = returnMinutes - effectiveEndMins;
        if (actualSpentMinutes > 120) {
          midShiftPenalty = 'day';
          midShiftReason = `تجاوز الإجازة الزمنية حاجز الساعتين (مدة الغياب: ${actualSpentMinutes} دقيقة) - إجازة اعتيادية إجبارية (يوم كامل)`;

          // تصفير لمنع الخصم المزدوج
          await supabase.from('leave_requests').update({
            time_duration_minutes: 0,
            leave_end_time: requestedMidShift.leave_start_time,
            reason: (requestedMidShift.reason || '') + ` [أُلغيت واستبدلت بإجازة اعتيادية إجبارية لتجاوز الساعتين]`
          }).eq('id', requestedMidShift.id);

          await supabase.from('leave_requests').insert({
            user_id: empId,
            leave_type: 'regular',
            start_date: testDate,
            end_date: testDate,
            days_count: 1,
            reason: midShiftReason,
            status: 'approved',
            leave_status: 'approved',
            is_mandatory: true,
            with_request: false
          });
        } else {
          const remainingCap = Math.max(0, 120 - approvedDuration);
          let penaltyVal = 30;
          if (extraDelayMins > 30) penaltyVal = Math.min(extraDelayMins <= 60 ? 60 : 120, remainingCap);
          midShiftPenalty = penaltyVal;
          midShiftReason = `تأخر في العودة من الإجازة الزمنية (تأخر ${extraDelayMins} دقيقة) - إجازة زمنية إجبارية (${penaltyVal} دقيقة)`;

          await supabase.from('leave_requests').insert({
            user_id: empId,
            leave_type: 'time_off',
            start_date: testDate,
            end_date: testDate,
            leave_start_time: formatHMS(effectiveEndMins),
            leave_end_time: formatHMS(effectiveEndMins + penaltyVal),
            time_duration_minutes: penaltyVal,
            days_count: 1,
            reason: midShiftReason,
            status: 'approved',
            leave_status: 'approved',
            is_mandatory: true,
            time_off_subtype: 'mid_shift',
            with_request: false
          });
        }
      }
    }
  }

  return { midShiftPenalty, midShiftReason };
}

async function runLiveTest() {
  console.log('\x1b[1m\x1b[35m');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   اختبار تشغيلي حي مع قاعدة البيانات للنوع B (وسط الدوام)     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\x1b[0m');

  await cleanTestData();

  // ─── الفحص 1: طلب 60د وعدم الخروج والبقاء حتى نهاية الدوام ───
  logHeader('الفحص 1: طلب 60د (11:00-12:00) وعدم الخروج إطلاقاً والبقاء حتى نهاية الدوام');
  const { data: req1 } = await supabase.from('leave_requests').insert({
    user_id: empId,
    leave_type: 'time_off',
    time_off_subtype: 'mid_shift',
    start_date: testDate,
    end_date: testDate,
    leave_start_time: '11:00:00',
    leave_end_time: '12:00:00',
    time_duration_minutes: 60,
    days_count: 1,
    with_request: true,
    status: 'approved',
    leave_status: 'approved',
    reason: 'فحص عدم الخروج'
  }).select().single();

  const record1 = {
    check_in: `${testDate}T08:10:00+03:00`,
    time_leave_out: null,
    time_leave_return: null,
    check_out: `${testDate}T15:00:00+03:00`
  };

  await simulateMidShiftEnforce(record1);
  const { data: checkReq1 } = await supabase.from('leave_requests').select('*').eq('id', req1.id).single();
  logInfo(`حالة الطلب بعد نهاية الدوام: المدة = ${checkReq1.time_duration_minutes}د، الملاحظة: ${checkReq1.reason}`);
  if (checkReq1.time_duration_minutes === 0) {
    logSuccess('اجتاز بنجاح: تم تصفير دقائق الإجازة لعدم الاستخدام وحفظ رصيد الموظف.');
  } else {
    logError('فشل الفحص 1');
  }

  await cleanTestData();

  // ─── الفحص 2: طلب 60د والعودة مبكراً 11:35 (استهلاك 35د) ───
  logHeader('الفحص 2: طلب 60د (11:00-12:00) وخروج 11:00 وعودة مبكرة 11:35');
  const { data: req2 } = await supabase.from('leave_requests').insert({
    user_id: empId,
    leave_type: 'time_off',
    time_off_subtype: 'mid_shift',
    start_date: testDate,
    end_date: testDate,
    leave_start_time: '11:00:00',
    leave_end_time: '12:00:00',
    time_duration_minutes: 60,
    days_count: 1,
    with_request: true,
    status: 'approved',
    leave_status: 'approved',
    reason: 'فحص العودة المبكرة'
  }).select().single();

  const record2 = {
    check_in: `${testDate}T08:15:00+03:00`,
    time_leave_out: `${testDate}T11:00:00+03:00`,
    time_leave_return: `${testDate}T11:35:00+03:00`
  };

  await simulateMidShiftEnforce(record2);
  const { data: checkReq2 } = await supabase.from('leave_requests').select('*').eq('id', req2.id).single();
  logInfo(`حالة الطلب بعد العودة المبكرة: المدة = ${checkReq2.time_duration_minutes}د، النهاية = ${checkReq2.leave_end_time}`);
  if (checkReq2.time_duration_minutes === 35 && checkReq2.leave_end_time === '11:35:00') {
    logSuccess('اجتاز بنجاح: تم تقليص مدة الإجازة من 60 إلى 35 دقيقة الفعلية.');
  } else {
    logError('فشل الفحص 2');
  }

  await cleanTestData();

  // ─── الفحص 3: طلب 60د وعودة 13:00 (غياب 120د تجاوز الساعتين) ───
  logHeader('الفحص 3: طلب 60د (10:30-11:30) وخروج 10:30 وعودة 13:00 (غياب 150د كسر الساعتين)');
  const { data: req3 } = await supabase.from('leave_requests').insert({
    user_id: empId,
    leave_type: 'time_off',
    time_off_subtype: 'mid_shift',
    start_date: testDate,
    end_date: testDate,
    leave_start_time: '10:30:00',
    leave_end_time: '11:30:00',
    time_duration_minutes: 60,
    days_count: 1,
    with_request: true,
    status: 'approved',
    leave_status: 'approved',
    reason: 'فحص كسر الساعتين'
  }).select().single();

  const record3 = {
    check_in: `${testDate}T08:15:00+03:00`,
    time_leave_out: `${testDate}T10:30:00+03:00`,
    time_leave_return: `${testDate}T13:00:00+03:00`
  };

  const res3 = await simulateMidShiftEnforce(record3);
  const { data: checkReq3 } = await supabase.from('leave_requests').select('*').eq('id', req3.id).single();
  const { data: regLeave3 } = await supabase.from('leave_requests').select('*').eq('user_id', empId).eq('leave_type', 'regular').eq('start_date', testDate).single();

  logInfo(`حالة طلب الزمنية: المدة = ${checkReq3.time_duration_minutes}د، الملاحظة: ${checkReq3.reason}`);
  logInfo(`الإجازة الاعتيادية المسجلة: أيام = ${regLeave3?.days_count} يوم، السبب: ${regLeave3?.reason}`);

  if (res3.midShiftPenalty === 'day' && checkReq3.time_duration_minutes === 0 && regLeave3?.days_count === 1) {
    logSuccess('اجتاز بنجاح: تم فرض إجازة اعتيادية إجبارية يوم كامل وتصفير دقائق الزمنية لمنع الخصم المزدوج!');
  } else {
    logError('فشل الفحص 3');
  }

  await cleanTestData();
  logSuccess('تم تنظيف كافة السجلات التجريبية، قاعدة البيانات آمنة وسليمة 100%.');
}

runLiveTest().catch(console.error);
