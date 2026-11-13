-- supabase/migrations/20261113190000_att06_add_kiosk_delete_rpc.sql
-- إضافة دالة حذف طرفية البصمة البيومترية العامة بصلاحيات المشرف

CREATE OR REPLACE FUNCTION public.admin_delete_kiosk_device(p_device_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NOT public.is_privileged_user() THEN
        RETURN jsonb_build_object('success', false, 'message', 'غير مصرح لك بحذف الطرفيات');
    END IF;

    DELETE FROM public.kiosk_devices
    WHERE id = p_device_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'الطرفية غير موجودة أو تم حذفها مسبقاً');
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_delete_kiosk_device(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
