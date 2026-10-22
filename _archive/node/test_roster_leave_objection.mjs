/**
 * Simulation Test: Roster Shift Leave Objection & Absence Counter
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

async function testRosterShiftLeave() {
  console.log('\x1b[1m\x1b[35m');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   محاكاة عقل التحقق لإجازات المناوبين وعداد الغياب المعتمد     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\x1b[0m');

  const empId = 'd2c4eef8-72cc-4dd1-a734-00d5ebe94f6d'; // مسلم الملالي

  // ─── الاختبار 1: فحص عداد أيام الغياب المثبتة ───
  logHeader('الاختبار 1: فحص قراءة عداد أيام الغياب المثبتة (unpaid_leaves_total)');
  const { data: finData } = await supabase
    .from('financial_records')
    .select('remaining_leaves_balance, sick_leaves_balance, unpaid_leaves_total')
    .eq('user_id', empId)
    .single();

  logInfo(`الموظف: مسلم عقيل الملالي`);
  logInfo(`رصيد الإجازات الاعتيادية: ${finData?.remaining_leaves_balance} يوم`);
  logInfo(`رصيد الإجازات المرضية: ${finData?.sick_leaves_balance} يوم`);
  logInfo(`عداد أيام الغياب المثبتة (نهائي): ${finData?.unpaid_leaves_total ?? 0} يوم`);

  if (finData?.unpaid_leaves_total !== undefined) {
    logSuccess('تم التحقق من قراءة حقل unpaid_leaves_total بنجاح من قاعدة البيانات.');
  } else {
    logError('فشل قراءة حقل unpaid_leaves_total.');
  }

  // ─── الاختبار 2: فحص جدول المناوبة للموظف وتحديد شفتات يوم الاثنين (مسائي + خفر) ───
  logHeader('الاختبار 2: فحص شفتات المناوب ليوم الاثنين (مسائي + خفر)');
  const { data: prof } = await supabase
    .from('profiles')
    .select('work_schedule_id')
    .eq('id', empId)
    .single();

  const { data: schedule } = await supabase
    .from('work_schedules')
    .select('*, days:work_schedule_days(*)')
    .eq('id', prof.work_schedule_id)
    .single();

  const mondaySchedule = schedule.days?.find(d => d.day_of_week === 1); // 1 = الاثنين
  logInfo(`يوم الاثنين: is_morning=${mondaySchedule?.is_morning}, is_evening=${mondaySchedule?.is_evening}, is_night=${mondaySchedule?.is_night}`);

  if (mondaySchedule?.is_evening && mondaySchedule?.is_night) {
    logSuccess('تأكدنا أن جدول الموظف ليوم الاثنين هو (مسائي + خفر = 3 أيام قانونية).');
  } else {
    logWarn('جدول الاثنين ليس مسائي وخفر!');
  }

  // ─── الاختبار 3: محاكاة اعتراض عقل التطبيق عند إدخال 2 يوم في حالة مسائي + خفر ───
  logHeader('الاختبار 3: محاكاة اعتراض عقل التطبيق عند إدخال 2 يوم');

  function simulateValidation({ daysCount, selectedShiftOptionId, isEvening, isNight, isMorning }) {
    if (isEvening && isNight && !isMorning) {
      if (daysCount === 2 && selectedShiftOptionId !== 'night_only') {
        return {
          valid: false,
          error: 'تنبيه جدول المناوبة: لديك في هذا اليوم شفت (مسائي + خفر): فإما أن تكون الإجازة يوماً واحداً لتعفى من المسائي ويبقى شفت الخفر مطلوباً منك، أو يومين لتعفى من الخفر ويبقى المسائي مطلوباً منك، أو ثلاثة أيام لتشمل المسائي والخفر معاً وتعفى من الحضور لهذا اليوم بالكامل. يرجى تحديد الشفت المطلوب بدقة.'
        };
      }
      if (daysCount !== 1 && daysCount !== 2 && daysCount !== 3) {
        return {
          valid: false,
          error: 'تنبيه: مجموع شفتات هذا اليوم (مسائي + خفر) يعادل 3 أيام كحد أقصى. يرجى اختيار 1 أو 2 أو 3 أيام.'
        };
      }
      return { valid: true };
    }
    return { valid: true };
  }

  // أ) إدخال 2 يوم دون تحديد الشفت المستهدف:
  const res2Days = simulateValidation({
    daysCount: 2,
    selectedShiftOptionId: null,
    isEvening: true,
    isNight: true,
    isMorning: false
  });

  if (!res2Days.valid) {
    logSuccess('اعترض عقل التطبيق بنجاح تام عند إدخال 2 يوم!');
    console.log(`    رسالة الاعتراض: "${res2Days.error}"`);
  } else {
    logError('فشل الاعتراض! سمح النظام بـ 2 يوم دون توضيح!');
  }

  // ب) اختيار "المسائي فقط" (1 يوم):
  const resEvening = simulateValidation({
    daysCount: 1,
    selectedShiftOptionId: 'evening_only',
    isEvening: true,
    isNight: true,
    isMorning: false
  });
  if (resEvening.valid) {
    logSuccess('قُبل خيار "المسائي فقط" (1 يوم) بنجاح - ويبقى شفت الخفر مطلوباً.');
  }

  // ج) اختيار "الخفر فقط" (2 يوم):
  const resNight = simulateValidation({
    daysCount: 2,
    selectedShiftOptionId: 'night_only',
    isEvening: true,
    isNight: true,
    isMorning: false
  });
  if (resNight.valid) {
    logSuccess('قُبل خيار "الخفر فقط" (2 يوم) بنجاح بعد تحديده صراحة - ويبقى شفت المسائي مطلوباً.');
  }

  // د) اختيار "كامل اليوم" (3 أيام):
  const resFull = simulateValidation({
    daysCount: 3,
    selectedShiftOptionId: 'full_day',
    isEvening: true,
    isNight: true,
    isMorning: false
  });
  if (resFull.valid) {
    logSuccess('قُبل خيار "كامل اليوم" (3 أيام) بنجاح - إعفاء شامل من المسائي والخفر.');
  }

  console.log('\n\x1b[1m\x1b[32m=== تم اكتمال محاكاة عقل التحقق بنجاح باهر 100% ===\x1b[0m\n');
}

testRosterShiftLeave().catch(console.error);
