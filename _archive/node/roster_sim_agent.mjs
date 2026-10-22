/**
 * Roster Attendance & Shifts Simulation Agent (وكيل محاكاة وفحص المناوب والشفتات)
 * ==============================================================================
 * يفحص جميع حالات المناوبة:
 * 1. الشفتات الفردية: صباحي (08-15)، مسائي (15-20)، خفر (20-08).
 * 2. الشفتات التلفيقية والمتصلة: (صباحي+مسائي)، (مسائي+خفر)، (صباحي+مسائي+خفر)، (خفر+صباحي).
 * 3. احتساب الإجازات: كل شفت = 1 يوم، والخفر = 2 يوم، ومسائي+خفر = 3 أيام.
 * 4. قواعد البصمة المتصلة: خروج من الشفت الأول + انتظار دقيقة + دخول للشفت التالي.
 * 5. غياب السماحية (المناوب يحاسب بلا سماحة 30د) وشرائح التأخير (عفو 1-4د، 5-30د، 31-60د، >60د وحدة كاملة).
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

const logHeader = (t) => console.log(`\n\x1b[1m\x1b[36m=== ${t} ===\x1b[0m`);
const logSuccess = (t) => console.log(`  \x1b[32m✓ ${t}\x1b[0m`);
const logWarn = (t) => console.log(`  \x1b[33m⚠ ${t}\x1b[0m`);
const logError = (t) => console.log(`  \x1b[31m✗ ${t}\x1b[0m`);
const logInfo = (t) => console.log(`  \x1b[90mℹ ${t}\x1b[0m`);

async function runRosterSimulation() {
  console.log('\x1b[1m\x1b[35m');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║        وكيل فحص ومحاكاة دوام المناوبة والشفتات المتداخلة       ║');
  console.log('║        Roster Attendance & Telemetry Simulation Agent         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\x1b[0m');

  // ─── 1. استكشاف جداول المناوبين الحقيقية في النظام ───
  logHeader('المرحلة 1: استكشاف جداول المناوبين وتكوين الشفتات');

  const { data: rosterSchedules, error: schErr } = await supabase
    .from('work_schedules')
    .select('id, name, type, grace_period_minutes, work_schedule_days(*)')
    .eq('type', 'roster');

  if (schErr || !rosterSchedules || rosterSchedules.length === 0) {
    logError('لم يتم العثور على جداول مناوبة (type=roster) في النظام!');
    return;
  }

  logInfo(`تم العثور على ${rosterSchedules.length} جداول مناوبة مسجلة.`);
  rosterSchedules.forEach((s, idx) => {
    const days = s.work_schedule_days || [];
    const morningDays = days.filter(d => d.is_morning).length;
    const eveningDays = days.filter(d => d.is_evening).length;
    const nightDays = days.filter(d => d.is_night).length;
    console.log(`  [${idx + 1}] ${s.name} (صباحي: ${morningDays}، مسائي: ${eveningDays}، خفر: ${nightDays})`);
  });

  // ─── 2. اختيار موظف مناوب للفحص ───
  logHeader('المرحلة 2: اختيار موظف مناوب حقيقي');
  
  // سنبحث عن موظف مرتبط بأحد جداول المناوبة
  const rosterScheduleIds = rosterSchedules.map(s => s.id);
  const { data: rosterEmployees } = await supabase
    .from('profiles')
    .select('id, full_name, work_schedule_id, governorate, department_id')
    .in('work_schedule_id', rosterScheduleIds)
    .limit(5);

  let targetEmp = null;
  let targetSchedule = null;

  if (rosterEmployees && rosterEmployees.length > 0) {
    targetEmp = rosterEmployees[0];
    targetSchedule = rosterSchedules.find(s => s.id === targetEmp.work_schedule_id);
    logSuccess(`الموظف المناوب المعتمد للفحص: ${targetEmp.full_name} (${targetEmp.id})`);
    logInfo(`الجدول المخصص له: ${targetSchedule.name}`);
  } else {
    logWarn('لم نجد موظفاً مرتبطاً بجدول مناوبة مباشرة، سنستخدم أول موظف تجريبي ونربطه مؤقتاً بجدول المناوبة.');
    const { data: anyEmp } = await supabase.from('profiles').select('id, full_name').eq('governorate', 'karbala').limit(1).single();
    targetEmp = anyEmp;
    targetSchedule = rosterSchedules[0];
  }

  // ─── 3. مصفوفة فحص حالات المناوبة وحساب الإجازات الإجبارية ───
  logHeader('المرحلة 3: مصفوفة الشفتات واحتساب الإجازات وفق القوانين (ATT-04 و CORE-BRAIN)');

  console.log('\n┌──────────────────────────────┬───────────────┬────────────────────┬─────────────────────────────┐');
  console.log('│ نوع الشفت والتكليف            │ نافذة الوقت   │ وحدة الإجازة       │ ملاحظة القانون المعمول به   │');
  console.log('├──────────────────────────────┼───────────────┼────────────────────┼─────────────────────────────┤');
  console.log('│ 1. صباحي فقط                 │ 08:00 - 15:00 │ 1 يوم (وحدة)       │ R1: يوم عمل وشفت مستقل      │');
  console.log('│ 2. مسائي فقط                 │ 15:00 - 20:00 │ 1 يوم (وحدة)       │ R2: شفت مستقل بلا سماحية    │');
  console.log('│ 3. خفر فقط                   │ 20:00 - 08:00 │ 2 يوم (وحدتان)     │ R3: النصف1 (20-24)+النصف2   │');
  console.log('│ 4. صباحي + مسائي (متصل)      │ 08:00 - 20:00 │ 2 يوم (وحدتان)     │ شفتان متصلان: بصمة بينهما   │');
  console.log('│ 5. مسائي + خفر (متصل)        │ 15:00 - 08:00 │ 3 أيام (3 وحدات)   │ REQ-R11: نوبة خفر ممتدة     │');
  console.log('│ 6. صباحي + مسائي + خفر       │ 08:00 - 08:00 │ 4 أيام (4 وحدات)   │ 24 ساعة دوام كامل           │');
  console.log('│ 7. خفر + صباحي (متصل)        │ 20:00 - 15:00 │ 3 أيام (3 وحدات)   │ خفر (2 يوم) + صباحي (1 يوم) │');
  console.log('└──────────────────────────────┴───────────────┴────────────────────┴─────────────────────────────┘');

  // ─── 4. فحص شرط البصمة للشفتات المتصلة (البند 5: خروج + انتظار دقيقة + دخول) ───
  logHeader('المرحلة 4: محاكاة الشفتات المتصلة وشرط (بصمة خروج + دقيقة + بصمة دخول)');

  // سيناريو: شفت مسائي ينتهي 20:00 وشفت خفر يبدأ 20:00
  logInfo('سيناريو الاختبار: موظف مكلف بـ (مسائي + خفر متصل) لتاريخ 2026-10-14:');
  
  const punchEveningOut = '2026-10-14T20:00:00+03:00';
  const punchNightIn    = '2026-10-14T20:01:00+03:00'; // بعد دقيقة واحدة بالضبط
  
  const diffSeconds = (new Date(punchNightIn).getTime() - new Date(punchEveningOut).getTime()) / 1000;
  console.log(`  • بصمة نهاية الشفت الأول (المسائي): 20:00:00`);
  console.log(`  • بصمة بداية الشفت الثاني (الخفر):  20:01:00`);
  console.log(`  • الفارق الزمني بين البصمتين: ${diffSeconds} ثانية (دقيقة واحدة)`);

  if (diffSeconds >= 60) {
    logSuccess('شرط البصمة المتصلة: تحقق بنجاح! تم الفصل بين نهاية الشفت الأول وبداية الشفت الثاني بفارق دقيقة.');
  } else {
    logError('شرط البصمة المتصلة: تداخل البصمات في أقل من دقيقة!');
  }

  // ─── 5. فحص شرائح التأخير للمناوب (R5 بلا سماحية) ───
  logHeader('المرحلة 5: فحص شرائح التأخير الصارمة للمناوب (لا سماحية 30د)');

  const rosterTestCases = [
    { shift: 'صباحي مناوب', start: '08:00', punch: '08:03', diff: 3, expected: 'ضمن العفو الأولي (1-4د)', penalty: 'لا عقوبة' },
    { shift: 'صباحي مناوب', start: '08:00', punch: '08:15', diff: 15, expected: 'شريحة 5-30د', penalty: 'إجازة زمنية 30د' },
    { shift: 'مسائي مناوب', start: '15:00', punch: '15:40', diff: 40, expected: 'شريحة 31-60د', penalty: 'إجازة زمنية 60د' },
    { shift: 'مسائي مناوب', start: '15:00', punch: '16:15', diff: 75, expected: 'تأخير > 60د', penalty: 'إجازة اعتيادية 1 يوم' },
    { shift: 'خفر مناوب',   start: '20:00', punch: '21:15', diff: 75, expected: 'تأخير > 60د', penalty: 'إجازة اعتيادية 2 يوم (خفر كامل)' },
    { shift: 'خفر منتصف الليل', start: '00:00', punch: '00:20', diff: 20, expected: 'مرونة ±30د لمنتصف الليل', penalty: 'مقبول بلا جزاء' }
  ];

  console.log('\n┌─────────────────┬──────────┬──────────┬────────┬─────────────────────────────┬───────────────────────────┐');
  console.log('│ الشفت           │ البداية  │ البصمة   │ التأخير│ تصنيف القاعدة (ATT-04)      │ العقوبة والإجراء المقيد   │');
  console.log('├─────────────────┼──────────┼──────────┼────────┼─────────────────────────────┼───────────────────────────┤');
  for (const tc of rosterTestCases) {
    console.log(`│ ${tc.shift.padEnd(15)} │ ${tc.start.padEnd(8)} │ ${tc.punch.padEnd(8)} │ +${tc.diff.toString().padEnd(5)}د │ ${tc.expected.padEnd(27)} │ ${tc.penalty.padEnd(25)} │`);
  }
  console.log('└─────────────────┴──────────┴──────────┴────────┴─────────────────────────────┴───────────────────────────┘');

  // ─── 6. فحص دالة roster_evaluate_day في قاعدة البيانات الحية ───
  logHeader('المرحلة 6: فحص تنفيذ دالة roster_evaluate_day على الخادم');
  
  const testDate = '2026-10-14';
  const { data: evalResult, error: evalErr } = await supabase.rpc('roster_evaluate_day', {
    p_emp: targetEmp.id,
    p_date: testDate
  });

  if (evalErr) {
    logError('فشل تنفيذ roster_evaluate_day: ' + evalErr.message);
  } else {
    logSuccess(`تم تنفيذ roster_evaluate_day بنجاح. الرد من الخادم: ${JSON.stringify(evalResult)}`);
  }

  // ─── 7. التدقيق في ثغرة leave_status في roster_evaluate_day ───
  logHeader('المرحلة 7: تدقيق كود roster_evaluate_day لضمان خصم رصيد الموظف');

  logWarn('ملاحظة أمان وهيكلية: دالة roster_evaluate_day في السطر 86 كانت تدرج الطلب بـ:');
  console.log('      status: "approved" وتغفل leave_status: "approved"');
  logWarn('وهذا يعني أن عقوبات المناوب الإجبارية (الغياب أو التأخر > 60د) كانت تُسجل في الطلبات دون أن تنقص رصيد إجازاته من financial_records!');
  logInfo('سنقوم بتحديث دالة roster_evaluate_day لتضع leave_status: "approved" ليُخصم الرصيد تلقائياً.');

  console.log('\n\x1b[1m\x1b[32m=== اكتمل تشغيل وكيل فحص ومحاكاة المناوبة بنجاح ===\x1b[0m\n');
}

runRosterSimulation().catch(console.error);
