import { supabase } from '../../../lib/supabase';
import { sendPushNotification } from '../../../services/notifications';
import { getBaghdadDate } from '../utils/shiftRules';

/**
 * rosterReminderService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * خدمة التذكير الذكي لجدول المناوبة:
 * تفحص جداول المناوبة الموشكة على الانتهاء (تحديداً صباح يوم الخميس أو عند اقتراب نهاية الأسبوع)،
 * وترسل إشعاراً للمشرفين والمسؤولين لتذكيرهم بتحديث جدول دوام الموظفين للفترة القادمة
 * أو استمرار اعتماد الجدول الحالي تلقائياً.
 */

export const rosterReminderService = {
  /**
   * فحص وإرسال إشعارات التذكير لجداول المناوبة
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

      // جلب المشرفين والمسؤولين المستلمين للإشعار
      const supervisorIdsSet = new Set<string>();
      try {
        const { data: rpcProfiles } = await supabase.rpc('get_available_profiles');
        if (rpcProfiles && Array.isArray(rpcProfiles)) {
          rpcProfiles.forEach((p: any) => {
            if (
              p.admin_role === 'general' ||
              p.admin_role === 'developer' ||
              p.role === 'admin'
            ) {
              if (p.id) supervisorIdsSet.add(p.id);
            }
          });
        }
      } catch (e) {
        console.error('Error getting supervisor profiles for roster reminder:', e);
      }

      const supervisorIds = Array.from(supervisorIdsSet);
      if (supervisorIds.length === 0) return;

      const todayStr = nowBaghdad.toISOString().split('T')[0];

      for (const sch of schedules) {
        if (!sch.valid_until) continue;

        // حساب عدد الأيام المتبقية على انتهاء فترة الجدول
        const validUntilDate = new Date(sch.valid_until);
        const diffDays = Math.ceil((validUntilDate.getTime() - nowBaghdad.getTime()) / (1000 * 3600 * 24));

        // إرسال التذكير إذا كان اليوم هو الخميس (أو الجمعة) أو إذا كانت الفترة تنتهي خلال 3 أيام
        const isEligibleDay = (currentDay === 4 || currentDay === 5 || (diffDays >= 0 && diffDays <= 3));
        if (!isEligibleDay) continue;

        // منع التكرار: فحص ما إذا كان التذكير قد أُرسل اليوم لهذه الفترة
        const storageKey = `roster_reminder_${sch.id}_${sch.valid_until}_${todayStr}`;
        if (typeof window !== 'undefined' && localStorage.getItem(storageKey)) {
          continue;
        }

        // جلب الموظفين المرتبطين بهذا الجدول
        const { data: emps } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('work_schedule_id', sch.id);

        if (!emps || emps.length === 0) continue;

        // صياغة النص بذكاء وفق عدد الموظفين
        let employeeListText = '';
        if (emps.length === 1) {
          employeeListText = `الموظف (${emps[0].full_name})`;
        } else {
          employeeListText = `الموظفين (${emps.map(e => e.full_name).join('، ')})`;
        }

        const title = '⏰ تذكير: تحديث جدول دوام المناوبة';
        const content = `يجب تحديث جدول دوام ${employeeListText} أو سيتم اعتماد الجدول الحالي للأسبوع القادم تلقائياً.`;

        // 1. تسجيل إشعار نظام داخلي
        const notifRows = supervisorIds.map(supId => ({
          recipient_id: supId,
          type: 'system',
          title,
          content,
          is_read: false,
          metadata: {
            schedule_id: sch.id,
            valid_until: sch.valid_until,
            type: 'roster_expiry_reminder'
          }
        }));

        await supabase.from('system_notifications').insert(notifRows).catch(console.warn);

        // 2. إرسال OneSignal Push Notification
        const pushPromises = supervisorIds.map(supId =>
          sendPushNotification(supId, content, { title })
        );
        await Promise.allSettled(pushPromises);

        // وضع علامة لمنع تكرار الإشعار في نفس اليوم
        if (typeof window !== 'undefined') {
          localStorage.setItem(storageKey, new Date().toISOString());
        }
      }
    } catch (err) {
      console.error('Error in checkAndSendRosterReminders:', err);
    }
  }
};
