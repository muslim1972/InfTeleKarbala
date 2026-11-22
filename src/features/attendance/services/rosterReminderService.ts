import { supabase } from '../../../lib/supabase';
import { sendPushNotification } from '../../../services/notifications';
import { getBaghdadDate } from '../utils/shiftRules';

/**
 * rosterReminderService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * خدمة التذكير الذكي لجدول المناوبة:
 * تفحص جداول المناوبة الموشكة على الانتهاء،
 * وتوجه التذكير حصراً إلى المسؤول المباشر للموظف المناوب،
 * وتحجبه كلياً عن معاون المدير، ومدير المديرية، وعن كافة المشرفين الآخرين.
 * النواة المعمارية FE-ATT-01 / إطار عمل B.R.I.C.K (القرار D91)
 */

export const rosterReminderService = {
  /**
   * فحص وإرسال إشعارات التذكير لجداول المناوبة للمسؤول المباشر حصراً
   */
  async checkAndSendRosterReminders(): Promise<void> {
    try {
      const nowBaghdad = getBaghdadDate();
      const currentDay = nowBaghdad.getDay(); // 0=Sun .. 4=Thu, 5=Fri, 6=Sat

      // جلب جميع جداول المناوبة النشطة
      const { data: schedules, error: schErr } = await supabase
        .from('work_schedules')
        .select('id, name, valid_from, valid_until')
        .eq('type', 'roster');

      if (schErr || !schedules || schedules.length === 0) return;

      // جلب بيانات التشكيلات الإدارية لتحديد المسؤول المباشر
      const { data: depts, error: deptsErr } = await supabase
        .from('departments')
        .select('id, name, manager_id, deputy_manager_id, parent_id');

      if (deptsErr || !depts || depts.length === 0) return;

      const todayStr = nowBaghdad.toISOString().split('T')[0];

      for (const sch of schedules) {
        if (!sch.valid_until) continue;

        // حساب عدد الأيام المتبقية على انتهاء فترة الجدول
        const validUntilDate = new Date(sch.valid_until);
        const diffDays = Math.ceil((validUntilDate.getTime() - nowBaghdad.getTime()) / (1000 * 3600 * 24));

        // إرسال التذكير إذا كان اليوم هو الخميس (أو الجمعة) أو إذا كانت الفترة تنتهي خلال 3 أيام
        const isEligibleDay = (currentDay === 4 || currentDay === 5 || (diffDays >= 0 && diffDays <= 3));
        if (!isEligibleDay) continue;

        // جلب الموظفين المرتبطين بهذا الجدول
        const { data: emps } = await supabase
          .from('profiles')
          .select('id, full_name, department_id')
          .eq('work_schedule_id', sch.id);

        if (!emps || emps.length === 0) continue;

        // تجميع الموظفين حسب المسؤول المباشر لتشكيلهم
        const supervisorMap = new Map<string, string[]>();

        for (const emp of emps) {
          if (!emp.department_id) continue;
          const empDept = depts.find(d => d.id === emp.department_id);
          if (!empDept) continue;

          // تحديد المسؤول المباشر (إن كان الموظف نفسه هو المسؤول، نلجأ للبديل أو الأب)
          let directManagerId: string | null = empDept.manager_id || null;
          if (directManagerId === emp.id) {
            directManagerId = empDept.deputy_manager_id || null;
          }

          if (!directManagerId && empDept.parent_id) {
            const parentDept = depts.find(d => d.id === empDept.parent_id);
            if (parentDept && parentDept.manager_id !== emp.id) {
              directManagerId = parentDept.manager_id;
            }
          }

          if (directManagerId) {
            const list = supervisorMap.get(directManagerId) || [];
            list.push(emp.full_name);
            supervisorMap.set(directManagerId, list);
          }
        }

        // إرسال الإشعار لكل مسؤول مباشر بحسب موظفيه فقط
        for (const [supervisorId, empNames] of supervisorMap.entries()) {
          const dedupKey = `roster_reminder_${sch.id}_${sch.valid_until}_${supervisorId}_${todayStr}`;

          // فحص التكرار محلياً وقاعدياً
          if (typeof window !== 'undefined' && localStorage.getItem(dedupKey)) {
            continue;
          }

          // فحص عدم التكرار الصارم في قاعدة البيانات
          const { data: existing } = await supabase
            .from('system_notifications')
            .select('id')
            .eq('recipient_id', supervisorId)
            .eq('metadata->>dedup_key', dedupKey)
            .maybeSingle();

          if (existing) {
            if (typeof window !== 'undefined') {
              localStorage.setItem(dedupKey, new Date().toISOString());
            }
            continue;
          }

          let employeeListText = '';
          if (empNames.length === 1) {
            employeeListText = `الموظف (${empNames[0]})`;
          } else {
            employeeListText = `الموظفين (${empNames.join('، ')})`;
          }

          const title = '⏰ تذكير: تحديث جدول دوام المناوبة';
          const content = `يجب تحديث جدول دوام ${employeeListText} أو سيتم اعتماد الجدول الحالي للأسبوع القادم تلقائياً.`;

          // 1. تسجيل إشعار نظام داخلي للمسؤول المباشر حصراً
          const { error: insertErr } = await supabase.from('system_notifications').insert([{
            recipient_id: supervisorId,
            type: 'system',
            title,
            content,
            is_read: false,
            metadata: {
              schedule_id: sch.id,
              valid_until: sch.valid_until,
              type: 'roster_expiry_reminder',
              dedup_key: dedupKey
            }
          }]);

          if (insertErr) {
            console.warn('Failed to insert roster reminder notification:', insertErr);
            continue;
          }

          // 2. إرسال OneSignal Push Notification للمسؤول المباشر فقط
          sendPushNotification(supervisorId, content, { title }).catch(e => console.warn('Push error:', e));

          if (typeof window !== 'undefined') {
            localStorage.setItem(dedupKey, new Date().toISOString());
          }
        }
      }
    } catch (err) {
      console.error('Error in checkAndSendRosterReminders:', err);
    }
  }
};
