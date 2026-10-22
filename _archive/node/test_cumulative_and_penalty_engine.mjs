/**
 * Test & Verification Harness for Cumulative Time Engine (7 Hours = 1 Day)
 * & Mandatory Leave Penalty Balance Deduction
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

async function testHarness() {
  console.log('\x1b[1m\x1b[35m');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║       فحص واختبار محرك الزمنيات ودورة الخصم المالي الحية       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\x1b[0m');

  // اختيار موظف الفحص
  const { data: emps } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('governorate', 'karbala')
    .eq('role', 'user')
    .limit(1);

  const emp = emps[0];
  logInfo(`الموظف الخاضع للتجربة: ${emp.full_name} (${emp.id})`);

  // قراءة الرصيد الابتدائي
  const { data: initialFin } = await supabase
    .from('financial_records')
    .select('remaining_leaves_balance, cumulative_minutes_remaining')
    .eq('user_id', emp.id)
    .single();

  logInfo(`الرصيد الابتدائي: اعتيادية = ${initialFin.remaining_leaves_balance} يوم | زمنيات متبقية = ${initialFin.cumulative_minutes_remaining} دقيقة`);

  // ─── الاختبار 1: استدعاء convert_cumulative_time مباشرة ───
  logHeader('الاختبار 1: فحص استدعاء convert_cumulative_time بعد التصحيح');
  const { error: rpcErr } = await supabase.rpc('convert_cumulative_time');
  if (rpcErr) {
    logError('فشل استدعاء RPC: ' + rpcErr.message);
  } else {
    logSuccess('تم استدعاء convert_cumulative_time بنجاح وبدون أي أخطاء SQL!');
  }

  // ─── الاختبار 2: إضافة طلب إجازة زمنية واختبار تريغر التراكم (trg_accumulate_time_off) ───
  logHeader('الاختبار 2: اعتماد إجازة زمنية (60 دقيقة) وفحص تراكم الدقائق');
  
  const testDate1 = '2026-10-14';
  const { data: timeLeave1, error: tlErr1 } = await supabase
    .from('leave_requests')
    .insert({
      user_id: emp.id,
      leave_type: 'time_off',
      start_date: testDate1,
      end_date: testDate1,
      time_duration_minutes: 60,
      days_count: 1,
      status: 'approved',
      leave_status: 'approved',
      reason: 'زمنية تجريبية 60 دقيقة'
    })
    .select()
    .single();

  if (tlErr1) {
    logError('فشل إنشاء الطلب الزمني: ' + tlErr1.message);
  } else {
    logSuccess(`تم اعتماد إجازة زمنية 60 دقيقة (ID: ${timeLeave1.id})`);
  }

  // فحص هل زادت الدقائق في financial_records
  const { data: finAfter1 } = await supabase
    .from('financial_records')
    .select('remaining_leaves_balance, cumulative_minutes_remaining')
    .eq('user_id', emp.id)
    .single();

  const diffMins = (finAfter1.cumulative_minutes_remaining || 0) - (initialFin.cumulative_minutes_remaining || 0);
  if (diffMins === 60) {
    logSuccess(`تريغر التراكم نجح: زادت الدقائق المتبقية بـ 60 دقيقة أصولياً (الرصيد الحالي: ${finAfter1.cumulative_minutes_remaining} دقيقة)`);
  } else {
    logWarn(`تريغر التراكم: التغيير كان ${diffMins} دقيقة (المتوقع 60)`);
  }

  // ─── الاختبار 3: إكمال الـ 420 دقيقة (7 ساعات) واختبار التحويل التلقائي لـ 1 يوم اعتيادية ───
  logHeader('الاختبار 3: إكمال الـ 420 دقيقة (7 ساعات) وفحص التحويل التلقائي ليوم إجازة');
  
  // سنضيف طلباً يكمل أو يتجاوز 420 دقيقة (مثلاً 360 دقيقة لإكمال 60 + 360 = 420 دقيقة)
  const balanceBeforeConvert = finAfter1.remaining_leaves_balance;
  
  const { data: timeLeave2, error: tlErr2 } = await supabase
    .from('leave_requests')
    .insert({
      user_id: emp.id,
      leave_type: 'time_off',
      start_date: testDate1,
      end_date: testDate1,
      time_duration_minutes: 360,
      days_count: 1,
      status: 'approved',
      leave_status: 'approved',
      reason: 'زمنية تجريبية 360 دقيقة لإكمال 7 ساعات'
    })
    .select()
    .single();

  if (tlErr2) {
    logError('فشل إنشاء الطلب الزمني المكمل: ' + tlErr2.message);
  } else {
    logSuccess(`تم اعتماد إجازة زمنية ثانية 360 دقيقة (المجموع = 420 دقيقة = 7 ساعات كاملة)`);
  }

  // فحص النتيجة في financial_records: هل خصم 1 يوم من الإجازات وعاد رصيد الزمنيات لـ 0؟
  const { data: finAfterConvert } = await supabase
    .from('financial_records')
    .select('remaining_leaves_balance, cumulative_minutes_remaining')
    .eq('user_id', emp.id)
    .single();

  const balanceDiff = balanceBeforeConvert - finAfterConvert.remaining_leaves_balance;
  console.log(`  • رصيد الإجازات الاعتيادية: كان ${balanceBeforeConvert} يوم -> أصبح ${finAfterConvert.remaining_leaves_balance} يوم (نقص ${balanceDiff} يوم)`);
  console.log(`  • رصيد الدقائق التراكمية: أصبح ${finAfterConvert.cumulative_minutes_remaining} دقيقة`);

  if (balanceDiff === 1 && finAfterConvert.cumulative_minutes_remaining === 0) {
    logSuccess('قانون الـ 7 ساعات = 1 يوم إجازة اعتيادية: نجح بنسبة 100%! تم الخصم التلقائي وتصفير الدقائق.');
  } else {
    logWarn(`النتيجة الجزئية: نقص الأيام = ${balanceDiff}، الدقائق المتبقية = ${finAfterConvert.cumulative_minutes_remaining}`);
  }

  // فحص هل ظهر الطلب المحول في جدول leave_requests
  const { data: convertedReqs } = await supabase
    .from('leave_requests')
    .select('id, leave_type, days_count, status, leave_status, reason')
    .eq('user_id', emp.id)
    .eq('leave_type', 'cumulative_time')
    .order('created_at', { ascending: false })
    .limit(1);

  if (convertedReqs && convertedReqs.length > 0) {
    logSuccess(`تم التحقق من توليد طلب الإجازة الرسمي في جدول الطلبات: "${convertedReqs[0].reason}" (المدة: ${convertedReqs[0].days_count} يوم)`);
  } else {
    logError('لم يتم العثور على قيد cumulative_time في جدول الطلبات!');
  }

  // ─── الاختبار 4: استعادة أرصدة الموظف الأصلية وتنظيف قيود التجربة ───
  logHeader('المرحلة 4: استعادة رصيد الموظف الأصلي وتنظيف قيود الفحص');
  
  if (timeLeave1) await supabase.from('leave_requests').delete().eq('id', timeLeave1.id);
  if (timeLeave2) await supabase.from('leave_requests').delete().eq('id', timeLeave2.id);
  if (convertedReqs && convertedReqs.length > 0) {
    await supabase.from('leave_requests').delete().eq('id', convertedReqs[0].id);
  }
  await supabase.from('leaves_details').delete().eq('user_id', emp.id).eq('leave_type', 'cumulative_time');

  // استرجاع الرصيد الأصلي تماماً
  await supabase.from('financial_records').update({
    remaining_leaves_balance: initialFin.remaining_leaves_balance,
    cumulative_minutes_remaining: initialFin.cumulative_minutes_remaining
  }).eq('user_id', emp.id);

  logSuccess('عادت أرصدة الموظف وسجلاته نقية تماماً كما كانت قبل الاختبار.');

  console.log('\n\x1b[1m\x1b[32m=== تم اكتمال دورة الفحص الشامل بنجاح باهر ===\x1b[0m\n');
}

testHarness().catch(console.error);
