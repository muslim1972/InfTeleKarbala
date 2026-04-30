-- ===========================================
-- دالة الحذف الشاملة والآمنة للمستخدم (v3 - إصلاح أسماء الأعمدة)
-- Robust & Comprehensive User Deletion RPC (v3)
-- ===========================================

CREATE OR REPLACE FUNCTION public.rpc_delete_user_robust(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- تنفيذ بصلاحيات النظام لتجاوز RLS وحذف سجلات Auth
AS $$
DECLARE
    v_admin_check boolean;
BEGIN
    -- 1. التحقق من صلاحيات المشرف
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR full_name LIKE '%مسلم عقيل%')
    ) INTO v_admin_check;

    IF NOT v_admin_check THEN
        RAISE EXCEPTION 'عذراً، لا تملك صلاحية حذف المستخدمين نهائياً.';
    END IF;

    -- 2. منع حذف حسابات الحماية الخاصة بالمدير
    IF EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = p_user_id 
        AND (job_number = '103130486' OR full_name LIKE '%مسلم عقيل%')
    ) THEN
        RAISE EXCEPTION 'لا يمكن حذف حساب مدير النظام المطور لدواعي أمنية.';
    END IF;

    -- 3. حذف السجلات المرتبطة من الجداول التابعة
    
    -- السجلات المالية والإدارية
    DELETE FROM public.financial_records WHERE user_id = p_user_id;
    DELETE FROM public.administrative_summary WHERE user_id = p_user_id;
    DELETE FROM public.yearly_records WHERE user_id = p_user_id;
    
    -- السجلات التفصيلية
    DELETE FROM public.thanks_details WHERE user_id = p_user_id;
    DELETE FROM public.committees_details WHERE user_id = p_user_id;
    DELETE FROM public.penalties_details WHERE user_id = p_user_id;
    DELETE FROM public.leaves_details WHERE user_id = p_user_id;
    
    -- الطلبات (تم تصحيح اسم العمود من employee_id إلى user_id)
    DELETE FROM public.leave_requests WHERE user_id = p_user_id;
    
    -- الرسائل (حذف الرسائل الصادرة والواردة لهذا المستخدم)
    DELETE FROM public.messages WHERE sender_id = p_user_id OR receiver_id = p_user_id;
    
    -- التنبيهات (استخدام استعلام مرن للتأكد من وجود الجدول)
    BEGIN
        DELETE FROM public.notifications WHERE user_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN
        NULL; -- تجاهل إذا لم يكن الجدول موجوداً
    END;
    
    -- الاستطلاعات
    DELETE FROM public.poll_responses WHERE user_id = p_user_id;
    
    -- الصلاحيات الخاصة
    DELETE FROM public.supervisor_permissions WHERE user_id = p_user_id;
    DELETE FROM public.field_permissions WHERE user_id = p_user_id;
    
    -- تحديث سجلات الأنشطة
    UPDATE public.activity_logs SET user_id = NULL WHERE user_id = p_user_id;
    
    -- 4. حذف الملف الشخصي (Profile)
    DELETE FROM public.profiles WHERE id = p_user_id;

    -- 5. حذف حساب المصادقة (Auth User)
    DELETE FROM auth.users WHERE id = p_user_id;

END;
$$;

-- منح صلاحيات التنفيذ
REVOKE ALL ON FUNCTION public.rpc_delete_user_robust(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_delete_user_robust(uuid) TO authenticated;
