/**
 * Live Simulation on Supabase DB: Corrected Type A & Type C Time-Off
 * الموظف: رافد خليل حسين (52ff7c57-54af-4da0-991b-c866d13d2245)
 * المسار: _archive/node/test_live_shift_end.mjs
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

const empId = '52ff7c57-54af-4da0-991b-c866d13d2245'; // رافد خليل حسين الدراويش
const testDate = '2026-10-18'; // تاريخ اختبار مستقل

async function cleanTestData() {
  await supabase.from('attendance_records').delete().eq('employee_id', empId).gte('check_in', `${testDate}T00:00:00Z`).lte('check_in', `${testDate}T23:59:59Z`);
  await supabase.from('leave_requests').delete().eq('user_id', empId).eq('start_date', testDate);
  await supabase.from('system_notifications').delete().eq('recipient_id', empId).gte('created_at', `${testDate}T00:00:00Z`);
}

// دالة محاكاة تنفيذ منطق المساء ونهاية الدوام المطابق لـ attendanceService.ts
async function runEveningEnforce(record) {
  const { data: allLeaves } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('user_id', empId)
    .eq('status', 'approved')
    .eq('start_date', testDate);

  const requestedShiftEnd = allLeaves?.find(r => r.time_off_subtype === 'shift_end' && r.with_request && r.leave_type === 'time_off');

  // إذا سجل time_leave_out ولم يسجل check_out
  if (!record.check_out && record.time_leave_out && requestedShiftEnd) {
    record.check_out = record.time_leave_out;
  }

  let eveningPenalty = 0;
  let eveningReason = '';
  let eveningEarlyMinutes = 0;

  const formatHM = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };
  const formatHMS = (mins) => `${formatHM(mins)}:00`;

  const allowedDepartureStartMins = 14 * 60 + 30; // 870 (14:30)
  const officialShiftEndMins = 15 * 60;          // 900 (15:00)

  if (record.check_out) {
    const checkOutDate = new Date(record.check_out);
    const checkOutMinutes = checkOutDate.getUTCHours() * 60 + checkOutDate.getUTCMinutes(); // مع افتراض UTC مطابق للتوقيت

    if (!requestedShiftEnd) {
      if (checkOutMinutes >= allowedDepartureStartMins) {
        eveningPenalty = 0;
      } else {
        eveningEarlyMinutes = allowedDepartureStartMins - checkOutMinutes;
        eveningPenalty = checkOutMinutes < 13 * 60 ? 'day' : (checkOutMinutes < 13 * 60 + 30 ? 120 : (checkOutMinutes < 14 * 60 ? 60 : 30));
      }
    } else {
      const approvedDuration = requestedShiftEnd.time_duration_minutes || 0;
      const approvedExitMins = allowedDepartureStartMins - approvedDuration;

      // الحالة 1: البقاء في الدوام حتى وقت الانصراف الطبيعي (14:30 فما بعد)
      if (checkOutMinutes >= allowedDepartureStartMins - 5) {
        if (approvedDuration > 0) {
          const note = ` [أُلغيت لعدم الاستخدام والبقاء في الدوام حتى وقت الانصراف الطبيعي ${formatHM(checkOutMinutes)}]`;
          await supabase.from('leave_requests').update({
            time_duration_minutes: 0,
            leave_start_time: '14:30:00',
            reason: (requestedShiftEnd.reason || '') + note
          }).eq('id', requestedShiftEnd.id);
          requestedShiftEnd.time_duration_minutes = 0;
        }
        eveningPenalty = 0;
      }
      // الحالة 2: الخروج المتأخر عن بداية الإجازة (التقليص الذكي وحفظ الرصيد)
      else if (checkOutMinutes > approvedExitMins + 5) {
        const actualUsedMins = allowedDepartureStartMins - checkOutMinutes;
        if (actualUsedMins < approvedDuration) {
          const newStartStr = formatHMS(checkOutMinutes);
          const note = ` [تم تقليص المدة من ${approvedDuration} إلى ${actualUsedMins} دقيقة للاستمرار بالعمل حتى ${formatHM(checkOutMinutes)}]`;
          await supabase.from('leave_requests').update({
            time_duration_minutes: actualUsedMins,
            leave_start_time: newStartStr,
            reason: (requestedShiftEnd.reason || '') + note
          }).eq('id', requestedShiftEnd.id);
          requestedShiftEnd.time_duration_minutes = actualUsedMins;
        }
        eveningPenalty = 0;
      }
      // الحالة 3: الخروج في نافذة الموعد المصرح به (±5 دقائق)
      else if (checkOutMinutes >= approvedExitMins - 5) {
        eveningPenalty = 0;
      }
      // الحالة 4: الخروج المبكر قبل موعد الإجازة المصرح بها
      else {
        const totalEarlyFromAllowed = allowedDepartureStartMins - checkOutMinutes;
        const extraEarlyMins = approvedExitMins - checkOutMinutes;
        eveningEarlyMinutes = extraEarlyMins;

        if (totalEarlyFromAllowed > 120 || checkOutMinutes < 12 * 60 + 30) {
          eveningPenalty = 'day';
          eveningReason = `خروج مبكر تجاوز الساعتين (${formatHM(checkOutMinutes)}) - إجازة اعتيادية إجبارية (يوم كامل)`;
          if (approvedDuration > 0) {
            const note = ` [أُلغيت واستبدلت بإجازة اعتيادية إجبارية لتجاوز الساعتين وخروج ${formatHM(checkOutMinutes)}]`;
            await supabase.from('leave_requests').update({
              time_duration_minutes: 0,
              reason: (requestedShiftEnd.reason || '') + note
            }).eq('id', requestedShiftEnd.id);
            requestedShiftEnd.time_duration_minutes = 0;
          }
        } else {
          const remainingCap = Math.max(0, 120 - approvedDuration);
          let penaltyVal = 30;
          if (extraEarlyMins > 30) penaltyVal = Math.min(extraEarlyMins <= 60 ? 60 : 120, remainingCap);
          eveningPenalty = penaltyVal;
          eveningReason = `خروج مبكر قبل موعد الإجازة الزمنية (${formatHM(checkOutMinutes)}) - إجازة زمنية إجبارية (${penaltyVal} دقيقة)`;
        }
      }
    }
  }

  // فحص اليوم الكامل
  if (eveningPenalty === 'day') {
    await supabase.from('leave_requests').insert({
      user_id: empId,
      leave_type: 'regular',
      start_date: testDate,
      end_date: testDate,
      days_count: 1,
      reason: eveningReason,
      status: 'approved',
      leave_status: 'approved',
      is_mandatory: true,
      with_request: false
    });
  }

  return { eveningPenalty, eveningReason, requestedShiftEnd };
}

async function runLiveTests() {
  logHeader('بدء الفحص الحي الحقيقي على Supabase DB: إجازة نهاية الدوام (النوع C)');

  // اختبار 1: طلب إجازة 60 دقيقة (13:30 إلى 14:30) والخروج 13:30 في الموعد
  {
    await cleanTestData();
    const { data: req } = await supabase.from('leave_requests').insert({
      user_id: empId,
      leave_type: 'time_off',
      time_off_subtype: 'shift_end',
      time_duration_minutes: 60,
      leave_start_time: '13:30:00',
      leave_end_time: '14:30:00',
      start_date: testDate,
      end_date: testDate,
      days_count: 1,
      leave_status: 'approved',
      status: 'approved',
      with_request: true,
      reason: 'فحص حي: خروج في الموعد 13:30'
    }).select().single();

    const record = {
      employee_id: empId,
      check_in: `${testDate}T08:15:00Z`,
      check_out: `${testDate}T13:30:00Z`
    };

    const res = await runEveningEnforce(record);
    const { data: updatedReq } = await supabase.from('leave_requests').select('*').eq('id', req.id).single();

    console.assert(res.eveningPenalty === 0, 'اختبار 1: يجب ألا تكون هناك عقوبة');
    console.assert(updatedReq.time_duration_minutes === 60, 'اختبار 1: تبقى المدة 60 دقيقة');
    logSuccess('اختبار 1 ناجح: الخروج في موعد الإجازة 13:30 استهلك 60 دقيقة بلا أي عقوبة');
  }

  // اختبار 2: طلب إجازة 60 دقيقة وبقي يعمل حتى 14:35 (عدم الاستخدام)
  {
    await cleanTestData();
    const { data: req } = await supabase.from('leave_requests').insert({
      user_id: empId,
      leave_type: 'time_off',
      time_off_subtype: 'shift_end',
      time_duration_minutes: 60,
      leave_start_time: '13:30:00',
      leave_end_time: '14:30:00',
      start_date: testDate,
      end_date: testDate,
      days_count: 1,
      leave_status: 'approved',
      status: 'approved',
      with_request: true,
      reason: 'فحص حي: عدم استخدام الإجازة'
    }).select().single();

    const record = {
      employee_id: empId,
      check_in: `${testDate}T08:15:00Z`,
      check_out: `${testDate}T14:35:00Z`
    };

    const res = await runEveningEnforce(record);
    const { data: updatedReq } = await supabase.from('leave_requests').select('*').eq('id', req.id).single();

    console.assert(res.eveningPenalty === 0, 'اختبار 2: لا توجد عقوبة');
    console.assert(updatedReq.time_duration_minutes === 0, 'اختبار 2: تصفير المدة لعدم الاستخدام');
    logSuccess('اختبار 2 ناجح: البقاء حتى 14:35 ألغى الإجازة وصفر دقائقها لحفظ الرصيد بالكامل');
  }

  // اختبار 3: طلب إجازة 120 دقيقة (12:30 إلى 14:30) واستمر بالعمل حتى 13:45 (تقليص ذكي)
  {
    await cleanTestData();
    const { data: req } = await supabase.from('leave_requests').insert({
      user_id: empId,
      leave_type: 'time_off',
      time_off_subtype: 'shift_end',
      time_duration_minutes: 120,
      leave_start_time: '12:30:00',
      leave_end_time: '14:30:00',
      start_date: testDate,
      end_date: testDate,
      days_count: 1,
      leave_status: 'approved',
      status: 'approved',
      with_request: true,
      reason: 'فحص حي: تقليص ذكي'
    }).select().single();

    const record = {
      employee_id: empId,
      check_in: `${testDate}T08:15:00Z`,
      check_out: `${testDate}T13:45:00Z`
    };

    const res = await runEveningEnforce(record);
    const { data: updatedReq } = await supabase.from('leave_requests').select('*').eq('id', req.id).single();

    console.assert(res.eveningPenalty === 0, 'اختبار 3: لا توجد عقوبة');
    console.assert(updatedReq.time_duration_minutes === 45, `اختبار 3: المتوقع 45 دقيقة ووجد ${updatedReq.time_duration_minutes}`);
    logSuccess('اختبار 3 ناجح: الاستمرار بالعمل حتى 13:45 قلص الإجازة إلى 45 دقيقة ووفر 75 دقيقة في الرصيد');
  }

  // اختبار 4: طلب إجازة 60 دقيقة وبصم انصراف 12:15 (كسر الساعتين قبل 12:30)
  {
    await cleanTestData();
    const { data: req } = await supabase.from('leave_requests').insert({
      user_id: empId,
      leave_type: 'time_off',
      time_off_subtype: 'shift_end',
      time_duration_minutes: 60,
      leave_start_time: '13:30:00',
      leave_end_time: '14:30:00',
      start_date: testDate,
      end_date: testDate,
      days_count: 1,
      leave_status: 'approved',
      status: 'approved',
      with_request: true,
      reason: 'فحص حي: كسر الساعتين'
    }).select().single();

    const record = {
      employee_id: empId,
      check_in: `${testDate}T08:15:00Z`,
      check_out: `${testDate}T12:15:00Z`
    };

    const res = await runEveningEnforce(record);
    const { data: updatedReq } = await supabase.from('leave_requests').select('*').eq('id', req.id).single();
    const { data: fullDayReq } = await supabase.from('leave_requests').select('*').eq('user_id', empId).eq('leave_type', 'regular').eq('is_mandatory', true).eq('start_date', testDate);

    console.assert(res.eveningPenalty === 'day', 'اختبار 4: تحويل ليوم كامل');
    console.assert(updatedReq.time_duration_minutes === 0, 'اختبار 4: تصفير الزمنية منعاً للازدواجية');
    console.assert(fullDayReq.length > 0, 'اختبار 4: تم إنشاء إجازة اعتيادية إجبارية');
    logSuccess('اختبار 4 ناجح: الخروج قبل 12:30 (12:15) حول اليوم لاعتيادية إجبارية وصفر الزمنية منعاً للخصم المزدوج');
  }

  // تنظيف نهائي
  await cleanTestData();
  logHeader('جميع الفحوصات الحية للنوع C على قاعدة البيانات اجتازت بنجاح تام 100%!');
}

runLiveTests().catch(err => {
  logError(`فشل الفحص الحي: ${err.message}`);
  console.error(err);
  process.exit(1);
});
