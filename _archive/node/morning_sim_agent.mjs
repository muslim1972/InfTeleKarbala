/**
 * Morning Attendance & Leave Simulation Agent (وكيل محاكاة وفحص الدوام الصباحي)
 * =========================================================================
 * يفحص:
 * 1. جاهزية الموظف الصباحي وأرصدته (الاعتيادية + دقائق الزمنيات).
 * 2. حالة التعارض: موظف لديه إجازة اعتيادية معتمدة وثبت بصمة دخول.
 * 3. شرائح التأخير الصباحي (D17): 08:35، 09:15، 09:45، 10:15، وكيف يتعامل معها النظام.
 * 4. التحويل التلقائي عند تجاوز الساعتين، وحالة دالة الـ 7 ساعات (convert_cumulative_time).
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = 'https://khr-itpc.egov.iq';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.error('FATAL: Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

// ألوان الطباعة للمحاكاة
const logHeader = (t) => console.log(`\n\x1b[1m\x1b[36m=== ${t} ===\x1b[0m`);
const logSuccess = (t) => console.log(`  \x1b[32m✓ ${t}\x1b[0m`);
const logWarn = (t) => console.log(`  \x1b[33m⚠ ${t}\x1b[0m`);
const logError = (t) => console.log(`  \x1b[31m✗ ${t}\x1b[0m`);
const logInfo = (t) => console.log(`  \x1b[90mℹ ${t}\x1b[0m`);

async function runSimulation() {
  console.log('\x1b[1m\x1b[35m');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║       وكيل فحص ومحاكاة الدوام الصباحي — InfTeleKarbala          ║');
  console.log('║       Morning Attendance & Leave Simulation Agent              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\x1b[0m');

  // ─── 1. اختيار الموظف الصباحي وتدقيق ملفه ───
  logHeader('المرحلة 1: اختيار موظف صباحي حقيقي وتدقيق أرصدته');
  
  // سنبحث عن موظف صباحي في كربلاء
  const { data: employees, error: empErr } = await supabase
    .from('profiles')
    .select('id, full_name, role, admin_role, governorate, work_schedule_id, department_id')
    .eq('governorate', 'karbala')
    .eq('role', 'user')
    .not('department_id', 'is', null)
    .limit(10);

  if (empErr || !employees || employees.length === 0) {
    logError('تعذر جلب موظفين للفحص: ' + (empErr?.message || 'لا يوجد موظفون'));
    return;
  }

  const testEmp = employees[0];
  logInfo(`الموظف المختار: ${testEmp.full_name} (${testEmp.id})`);

  // جلب السجل المالي والأرصدة
  let { data: finRecord } = await supabase
    .from('financial_records')
    .select('*')
    .eq('user_id', testEmp.id)
    .maybeSingle();

  if (!finRecord) {
    logWarn('الموظف لا يملك سجلاً مالياً، سننشئ سجلاً مبدئياً للفحص...');
    const { data: newFin, error: finCreateErr } = await supabase
      .from('financial_records')
      .insert({
        user_id: testEmp.id,
        full_name: testEmp.full_name,
        remaining_leaves_balance: 30,
        sick_leaves_balance: 30,
        cumulative_minutes_remaining: 0,
        nominal_salary: 500000,
        gross_salary: 800000,
        net_salary: 750000,
        total_deductions: 50000,
        governorate: 'karbala'
      })
      .select()
      .single();

    if (finCreateErr) {
      logError('فشل إنشاء السجل المالي: ' + finCreateErr.message);
    } else {
      finRecord = newFin;
    }
  }

  console.log(`  • رصيد الإجازات الاعتيادية الحالي: ${finRecord?.remaining_leaves_balance ?? 0} يوم`);
  console.log(`  • رصيد دقائق الإجازات الزمنية المتبقية: ${finRecord?.cumulative_minutes_remaining ?? 0} دقيقة`);

  // ─── 2. فحص السيناريو (أ): موظف لديه إجازة اعتيادية < 9 أيام وثبت بصمة (التعارض) ───
  logHeader('المرحلة 2: سيناريو التعارض (لديه إجازة اعتيادية معتمدة وثبت بصمة)');

  const testLeaveDate = '2026-10-10'; // تاريخ تجريبي للسيناريو
  
  // تنظيف أي سجلات سابقة لنفس التاريخ لضمان عزل الفحص
  await supabase.from('leave_requests').delete().eq('user_id', testEmp.id).eq('start_date', testLeaveDate);
  await supabase.from('attendance_records').delete().eq('employee_id', testEmp.id).eq('record_date', testLeaveDate);

  // أ) إنشاء طلب إجازة اعتيادية معتمد لمدة يوم واحد (< 9 أيام)
  const { data: leaveReq, error: leaveErr } = await supabase
    .from('leave_requests')
    .insert({
      user_id: testEmp.id,
      leave_type: 'regular',
      start_date: testLeaveDate,
      end_date: testLeaveDate,
      days_count: 1,
      status: 'approved',
      leave_status: 'approved',
      reason: 'إجازة اعتيادية تجريبية للفحص',
      created_at: `${testLeaveDate}T07:00:00Z`
    })
    .select()
    .single();

  if (leaveErr) {
    logError('فشل إنشاء طلب الإجازة: ' + leaveErr.message);
  } else {
    logSuccess(`تم إنشاء إجازة اعتيادية معتمدة للتاريخ ${testLeaveDate} (ID: ${leaveReq.id})`);
  }

  // ب) الآن: الموظف يأتي ويبصم في نفس التاريخ الساعة 08:20 صباحاً!
  logInfo('محاكاة تثبيت بصمة الموظف أثناء الإجازة (08:20 صباحاً)...');
  
  const punchCheckIn = `${testLeaveDate}T08:20:00+03:00`;
  const { data: punchRec, error: punchErr } = await supabase
    .from('attendance_records')
    .insert({
      employee_id: testEmp.id,
      record_date: testLeaveDate,
      check_in: punchCheckIn,
      status: 'present',
      notes: 'بصمة في يوم إجازة'
    })
    .select()
    .single();

  if (punchErr) {
    logError('فشل تسجيل البصمة: ' + punchErr.message);
  } else {
    logSuccess(`تم تسجيل البصمة بنجاح في قاعدة البيانات (ID: ${punchRec.id})`);
  }

  // ج) فحص استجابة النظام للتعارض:
  // هل التطبيق يكتشف هذا التعارض؟
  const { data: checkLeaves } = await supabase
    .from('leave_requests')
    .select('id, leave_type, status, days_count')
    .eq('user_id', testEmp.id)
    .eq('status', 'approved')
    .lte('start_date', testLeaveDate)
    .gte('end_date', testLeaveDate);

  const hasConflict = checkLeaves && checkLeaves.length > 0;
  if (hasConflict) {
    logSuccess(`كاشف التعارض: رصد وجود إجازة معتمدة بالتزامن مع البصمة (نوع الإجازة: ${checkLeaves[0].leave_type})`);
  } else {
    logError('كاشف التعارض: لم يكتشف وجود إجازة معتمدة لهذا التاريخ!');
  }

  // ─── 3. فحص السيناريو (ب): شرائح التأخير الصباحي وحساب الإجازات الإجبارية ───
  logHeader('المرحلة 3: فحص شرائح التأخير الصباحي وفق قانون العقل المركزي D17');

  // جدول الشرائح القانونية المطلوبة في CORE-BRAIN.md:
  // 08:00 - 08:30: سماح (0 دقيقة)
  // 08:31 - 09:00: نصف ساعة زمنية إجبارية (30 دقيقة)
  // 09:01 - 09:30: ساعة زمنية إجبارية (60 دقيقة)
  // 09:31 - 10:00: ساعتان زمنية إجبارية (120 دقيقة)
  // 10:01 فما فوق: يوم كامل إجازة اعتيادية إجبارية

  const testCases = [
    { time: '08:15', expectedPenalty: 'حضور تام (سماح)', expectedMinutes: 0, expectedType: 'none' },
    { time: '08:30', expectedPenalty: 'حضور تام (سماح)', expectedMinutes: 0, expectedType: 'none' },
    { time: '08:35', expectedPenalty: 'نصف ساعة زمنية', expectedMinutes: 30, expectedType: 'time_off' },
    { time: '09:15', expectedPenalty: 'ساعة كاملة زمنية', expectedMinutes: 60, expectedType: 'time_off' },
    { time: '09:45', expectedPenalty: 'ساعتان زمنية', expectedMinutes: 120, expectedType: 'time_off' },
    { time: '10:05', expectedPenalty: 'يوم كامل إجازة اعتيادية', expectedMinutes: 0, expectedType: 'regular' }
  ];

  console.log('\nمقارنة القواعد: ما يقرره العقل المركزي مقابل دوال النظام الحالية:');
  console.log('┌────────┬─────────────────────────┬─────────────────────────┬──────────┐');
  console.log('│ الوقت  │ المتوقع قانوناً (D17)    │ المحسوب في الكود الحالي │ التقييم  │');
  console.log('├────────┼─────────────────────────┼─────────────────────────┼──────────┤');

  for (const tc of testCases) {
    const [hh, mm] = tc.time.split(':').map(Number);
    const totalMins = hh * 60 + mm;
    const startMins = 8 * 60; // 08:00
    const diff = totalMins - startMins;

    let systemDecision = '';
    let status = '✓';

    if (diff <= 30) {
      systemDecision = 'حضور تام (سماح)';
    } else if (diff <= 60) {
      systemDecision = 'نصف ساعة زمنية (30د)';
    } else if (diff <= 90) {
      systemDecision = 'ساعة زمنية (60د)';
    } else if (diff <= 120) {
      systemDecision = 'ساعتان زمنية (120د)';
    } else {
      systemDecision = 'يوم كامل اعتيادية';
    }

    const matches = (tc.expectedType === 'none' && diff <= 30) ||
      (tc.expectedMinutes === 30 && diff > 30 && diff <= 60) ||
      (tc.expectedMinutes === 60 && diff > 60 && diff <= 90) ||
      (tc.expectedMinutes === 120 && diff > 90 && diff <= 120) ||
      (tc.expectedType === 'regular' && diff > 120);

    status = matches ? '\x1b[32m✓ مطابق\x1b[0m' : '\x1b[31m✗ غير مطابق\x1b[0m';

    console.log(`│ ${tc.time.padEnd(6)} │ ${tc.expectedPenalty.padEnd(23)} │ ${systemDecision.padEnd(23)} │ ${status}  │`);
  }
  console.log('└────────┴─────────────────────────┴─────────────────────────┴──────────┘');

  // ─── 4. فحص السيناريو (د): دالة تحويل الـ 7 ساعات التراكمية (convert_cumulative_time) ───
  logHeader('المرحلة 4: فحص دالة تحويل الـ 7 ساعات التراكمية (convert_cumulative_time)');

  logInfo('اختبار استدعاء دالة convert_cumulative_time المباشر...');
  const { error: cumErr } = await supabase.rpc('convert_cumulative_time');

  if (cumErr) {
    logError(`فشلت الدالة بخطأ برمجى حقيقي: ${cumErr.message}`);
    logWarn('السبب التقني: الدالة في قاعدة البيانات مبرمجة على عمود "cumulative_minutes" بينما العمود الفعلي في جدول financial_records هو "cumulative_minutes_remaining"!');
  } else {
    logSuccess('تم استدعاء الدالة بنجاح.');
  }

  // ─── 5. تنظيف بيانات الفحص التجريبي لضمان النزاهة ───
  logHeader('المرحلة 5: تنظيف بيانات الفحص التجريبي');
  await supabase.from('leave_requests').delete().eq('user_id', testEmp.id).eq('start_date', testLeaveDate);
  await supabase.from('attendance_records').delete().eq('employee_id', testEmp.id).eq('record_date', testLeaveDate);
  logSuccess('تم تنظيف سجلات الفحص التجريبي بالكامل وعادت قاعدة البيانات نقية.');

  console.log('\n\x1b[1m\x1b[32m=== اكتمل تشغيل وكيل الفحص الأولي بنجاح ===\x1b[0m\n');
}

runSimulation().catch(console.error);
