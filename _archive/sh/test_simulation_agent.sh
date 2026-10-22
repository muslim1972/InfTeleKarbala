#!/bin/bash
docker exec -i supabase-db psql -U supabase_admin -d postgres << 'EOF'
-- 1. تنظيف طلبات الإجازة الزمنية الملغاة لليوم 2026-10-15 حتى يبقى السجل نظيفاً تماماً
DELETE FROM leave_requests 
WHERE user_id = 'd2c4eef8-72cc-4dd1-a734-00d5ebe94f6d'
  AND leave_type = 'time_off'
  AND start_date = '2026-10-15';

-- 2. التحقق من السجلات المتبقية للموظف مسلم ليوم 2026-10-15
SELECT id, leave_type, days_count, status, is_mandatory, reason 
FROM leave_requests 
WHERE user_id = 'd2c4eef8-72cc-4dd1-a734-00d5ebe94f6d' AND start_date = '2026-10-15';

-- 3. محاكاة إنشاء إشعار غياب الشفت المسائي لمسؤول الموظف مسلم
DO $$
DECLARE
    v_mgr_id UUID;
    v_notif_id UUID;
BEGIN
    SELECT manager_id INTO v_mgr_id FROM departments WHERE id = '22222222-2222-2222-2222-222222222222';
    IF v_mgr_id IS NOT NULL THEN
        -- إنشاء إشعار قرار غياب الشفت المسائي
        INSERT INTO system_notifications (
            recipient_id, sender_id, type, title, content, is_read, metadata
        ) VALUES (
            v_mgr_id, 'd2c4eef8-72cc-4dd1-a734-00d5ebe94f6d', 'system',
            '🚨 قرار مطلوب: غياب الشفت المسائي (مسلم عقيل)',
            'الموظف (مسلم عقيل عبد الحسن) لم يسجل حضوراً في الشفت المسائي (15:00 - 20:00) ليوم 2026-10-15. يرجى اتخاذ القرار الإداري لاعتماد الغياب رسمياً بدون راتب أو تحويله إلى إجازة اعتيادية (1 يوم).',
            false,
            jsonb_build_object(
                'type', 'shift_absence_resolution',
                'employee_id', 'd2c4eef8-72cc-4dd1-a734-00d5ebe94f6d',
                'employee_name', 'مسلم عقيل عبد الحسن',
                'record_date', '2026-10-15',
                'shift_type', 'evening',
                'days_count', 1,
                'requires_decision', true
            )
        );

        -- إشعار الموظف بالعلم
        INSERT INTO system_notifications (
            recipient_id, sender_id, type, title, content, is_read, metadata
        ) VALUES (
            'd2c4eef8-72cc-4dd1-a734-00d5ebe94f6d', 'd2c4eef8-72cc-4dd1-a734-00d5ebe94f6d', 'system',
            'تنبيه إداري: عدم حضور الشفت المسائي',
            'للعلم: لم يتم تسجيل حضور لك في الشفت المسائي ليوم (2026-10-15). تم إشعار مسؤولك المباشر لاتخاذ القرار الإداري باعتماده إجازة اعتيادية أو غياباً رسمياً.',
            false,
            jsonb_build_object(
                'type', 'employee_shift_absence_notice',
                'record_date', '2026-10-15',
                'shift_type', 'evening',
                'days_count', 1
            )
        );
    END IF;
END $$;

-- 4. فحص الإشعارات المنشأة للمدير وللموظف
SELECT id, recipient_id, title, metadata->>'type' as notif_type, metadata->>'requires_decision' as req_dec
FROM system_notifications 
WHERE (recipient_id = 'd2c4eef8-72cc-4dd1-a734-00d5ebe94f6d' OR recipient_id IN (SELECT manager_id FROM departments WHERE id = '22222222-2222-2222-2222-222222222222'))
  AND created_at >= NOW() - INTERVAL '5 minutes';
EOF
