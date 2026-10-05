-- ============================================================
-- اختفاء إشعارات الطلب عن جميع المسؤولين فور معالجته
-- مشكلة: إشعار «بصمة موظف لديه طلب قيد المراجعة» (وتوائم الطلب)
-- يُدرج لكل الإداريين العامين + مدير القسم، وعندما يعالج أحدهم الطلب
-- تبقى نسخ الباقين غير مقروءة وزر «مراجعة الطلب» يفشل.
-- الحل: trigger مستقل على leave_requests — عند خروج الطلب من حالة
-- المراجعة تُعلَّم كل إشعارات النظام الحاملة request_id كمقروءة للجميع.
-- + تنظيف لمرة واحدة للتوائم الراكدة الحالية.
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_request_notifications_on_process()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- يُفعَّل فقط عند انتقال حالة فعلية إلى (معتمد/مرفوض/ملغى)
    -- مسارات التعديل (approved → pending) لا تنظّف شيئاً
    IF (NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected','canceled'))
       OR (NEW.leave_status IS DISTINCT FROM OLD.leave_status AND NEW.leave_status IN ('approved','rejected'))
       OR (NEW.cancellation_status IS DISTINCT FROM OLD.cancellation_status AND NEW.cancellation_status IN ('approved','rejected'))
       OR (NEW.cut_status IS DISTINCT FROM OLD.cut_status AND NEW.cut_status IN ('approved','rejected'))
       OR (NEW.hr_cut_status IS DISTINCT FROM OLD.hr_cut_status AND NEW.hr_cut_status IN ('approved','rejected'))
    THEN
        UPDATE public.system_notifications
        SET is_read = true
        WHERE is_read = false
          AND metadata ->> 'request_id' = NEW.id::text;
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cleanup_request_notifications ON public.leave_requests;
CREATE TRIGGER trg_cleanup_request_notifications
AFTER UPDATE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_request_notifications_on_process();

-- تنظيف لمرة واحدة: إشعارات راكدة غير مقروءة لطلبات عولجت بالكامل
-- (سبب رسالة «الطلب لم يعد قيد المراجعة» عند فتحها)
UPDATE public.system_notifications sn
SET is_read = true
WHERE sn.is_read = false
  AND sn.metadata ->> 'request_id' IS NOT NULL
  AND EXISTS (
      SELECT 1 FROM public.leave_requests lr
      WHERE lr.id = (sn.metadata ->> 'request_id')::uuid
        AND ( lr.status IN ('approved','rejected','canceled')
           OR lr.leave_status IN ('approved','rejected')
           OR lr.cancellation_status IN ('approved','rejected')
           OR lr.cut_status IN ('approved','rejected')
           OR lr.hr_cut_status IN ('approved','rejected') )
  );
