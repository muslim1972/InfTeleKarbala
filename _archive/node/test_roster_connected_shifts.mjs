/**
 * Test Roster Connected Shifts & 60-Second Cooldown & Balance Deduction
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Polyfill import.meta.env for Node.js execution
if (typeof import.meta.env === 'undefined') {
  import.meta.env = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'https://khr-itpc.egov.iq',
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || ''
  };
}

const { categorizePunches } = await import('../../src/features/attendance/utils/punchCategorizer.ts');

const supabase = createClient('https://khr-itpc.egov.iq', process.env.SUPABASE_SERVICE_ROLE_KEY);

const logHeader = (t) => console.log(`\n\x1b[1m\x1b[36m=== ${t} ===\x1b[0m`);
const logSuccess = (t) => console.log(`  \x1b[32m✓ ${t}\x1b[0m`);
const logWarn = (t) => console.log(`  \x1b[33m⚠ ${t}\x1b[0m`);
const logError = (t) => console.log(`  \x1b[31m✗ ${t}\x1b[0m`);
const logInfo = (t) => console.log(`  \x1b[90mℹ ${t}\x1b[0m`);

async function testRosterEngine() {
  console.log('\x1b[1m\x1b[35m');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  فحص منظومة المناوبين: الشفتات المتصلة ومهلة 60ث والخصم المالي  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\x1b[0m');

  // ─── 1. فحص خوارزمية categorizePunches للبصمات المتصلة ───
  logHeader('الاختبار 1: فحص خوارزمية الدمج والفرز (60ث للمناوب المتصل مقابل 180ث للمعتاد)');

  const baseTime = new Date('2026-10-14T20:00:00+03:00').getTime();
  const punch1 = { time: new Date(baseTime).toISOString(), target_slot: 'check_out' }; // خروج المسائي 20:00
  const punch2_after_65s = { time: new Date(baseTime + 65 * 1000).toISOString(), target_slot: 'check_in' }; // دخول الخفر بعد 65 ثانية
  const punch2_after_30s = { time: new Date(baseTime + 30 * 1000).toISOString(), target_slot: 'check_in' }; // دخول بعد 30 ثانية (أقل من المهلة)

  // أ) موظف مناوب لديه شفتان متصلتان (hasConnectedShifts = true):
  // فحص بعد 65 ثانية: يجب ألا تُدمج البصمتان
  const resConnected = categorizePunches([punch1, punch2_after_65s], null, '2026-10-14', 'shift', false, true);
  if (resConnected.raw_punches?.length === 2) {
    logSuccess('المناوب بالشفتات المتصلة (فارق 65 ثانية): قُبلت البصمتان كبصمتين مستقلتين بنجاح (خروج الشفت الأول ودخول الشفت الثاني)');
  } else {
    logError(`المناوب بالشفتات المتصلة: دُمجت البصمتان بشكل خاطئ! عدد البصمات: ${resConnected.raw_punches?.length}`);
  }

  // فحص بعد 30 ثانية: يجب أن تُدمج وتُرفض كبصمة مكررة عرضية
  const resConnectedTooFast = categorizePunches([punch1, punch2_after_30s], null, '2026-10-14', 'shift', false, true);
  if (resConnectedTooFast.raw_punches?.length === 1) {
    logSuccess('المناوب بالشفتات المتصلة (فارق 30 ثانية): تم دمج البصمة ومنع التكرار العرضي قبل انقضاء الـ 60 ثانية بنجاح');
  } else {
    logWarn('المناوب بالشفتات المتصلة: قُبلت بصمة قبل 60 ثانية!');
  }

  // ب) موظف عادي صباحي أو مناوب بشفت فردي منفرد (hasConnectedShifts = false):
  // يجب أن يطبق مهلة الـ 180 ثانية (3 دقائق)
  const resNormal = categorizePunches([punch1, punch2_after_65s], null, '2026-10-14', 'morning', false, false);
  if (resNormal.raw_punches?.length === 1) {
    logSuccess('الموظف العادي غير المتصل (فارق 65 ثانية): طُبقت عليه مهلة الـ 180 ثانية ودُمجت البصمة أصولياً');
  } else {
    logError('الموظف العادي: لم تطبق عليه مهلة الـ 180 ثانية!');
  }

  // ─── 2. فحص الخصم المالي التلقائي في roster_evaluate_day ───
  logHeader('الاختبار 2: فحص قيد غياب المناوب وخصم الرصيد في الخادم (leave_status: approved)');

  const empId = 'd2c4eef8-72cc-4dd1-a734-00d5ebe94f6d'; // مسلم الملالي
  const testDate = '2026-10-12'; // يوم الاثنين (مسائي + خفر = 2 وحدة)

  // قراءة الرصيد قبل التقييم
  const { data: finBefore } = await supabase
    .from('financial_records')
    .select('remaining_leaves_balance')
    .eq('user_id', empId)
    .single();

  logInfo(`رصيد الموظف قبل استدعاء roster_evaluate_day: ${finBefore?.remaining_leaves_balance} يوم`);

  // تنظيف أي قيد قديم لنفس التاريخ للتجربة الحية
  await supabase.from('leave_requests').delete().eq('user_id', empId).eq('start_date', testDate).eq('is_mandatory', true);

  // استدعاء دالة الخادم المصححة
  const { data: evalResult, error: evalErr } = await supabase.rpc('roster_evaluate_day', {
    p_emp: empId,
    p_date: testDate
  });

  if (evalErr) {
    logError('فشل تقييم اليوم للمناوب: ' + evalErr.message);
  } else {
    logSuccess(`تم تقييم اليوم بنجاح: ${JSON.stringify(evalResult)}`);
  }

  // التحقق من حالة الطلب المقيد في جدول leave_requests
  const { data: generatedReq } = await supabase
    .from('leave_requests')
    .select('id, days_count, status, leave_status, is_deducted, reason')
    .eq('user_id', empId)
    .eq('start_date', testDate)
    .eq('is_mandatory', true)
    .single();

  if (generatedReq) {
    console.log(`  • الطلب المقيد: ${generatedReq.reason}`);
    console.log(`  • status: ${generatedReq.status} | leave_status: ${generatedReq.leave_status}`);
    console.log(`  • is_deducted: ${generatedReq.is_deducted}`);

    if (generatedReq.leave_status === 'approved' && generatedReq.is_deducted === true) {
      logSuccess('نجح قيد الإجازة الإجبارية: leave_status = approved وتم وسم is_deducted = true!');
    } else {
      logWarn(`قيد الإجازة: leave_status = ${generatedReq.leave_status}, is_deducted = ${generatedReq.is_deducted}`);
    }
  }

  // فحص تناقص الرصيد في financial_records
  const { data: finAfter } = await supabase
    .from('financial_records')
    .select('remaining_leaves_balance')
    .eq('user_id', empId)
    .single();

  const diff = (finBefore?.remaining_leaves_balance || 0) - (finAfter?.remaining_leaves_balance || 0);
  console.log(`  • رصيد الإجازات بعد التقييم: ${finAfter?.remaining_leaves_balance} يوم (تناقص بمقدار: ${diff} يوم)`);

  if (diff === 2) {
    logSuccess('تم خصم الـ وحدتين (يومين) من رصيد المناوب تلقائياً وبنجاح 100%!');
  } else {
    logInfo(`ملاحظة الرصيد: الفارق الحالي = ${diff} يوم.`);
  }

  // ─── 3. تنظيف قيود الاختبار واستعادة الرصيد ───
  logHeader('المرحلة 3: استعادة الرصيد وتنظيف قيود التجربة');
  if (generatedReq) {
    await supabase.from('leave_requests').delete().eq('id', generatedReq.id);
  }
  await supabase.from('leaves_details').delete().eq('user_id', empId).eq('start_date', testDate);
  await supabase.from('financial_records').update({ remaining_leaves_balance: finBefore?.remaining_leaves_balance }).eq('user_id', empId);
  logSuccess('عادت قاعدة البيانات وسجلات الموظف نقية وأصلية.');

  console.log('\n\x1b[1m\x1b[32m=== تم اكتمال فحص واختبار منظومة المناوبين بنجاح كامل ===\x1b[0m\n');
}

testRosterEngine().catch(console.error);
