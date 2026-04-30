-- ===========================================
-- دالة الحذف الشاملة والآمنة للمستخدم (v5 - النسخة النهائية المؤكدة)
-- Robust & Comprehensive User Deletion RPC (v5)
-- بناءً على فحص شامل للهيكل (Schema Inspection)
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

    -- 3. حذف السجلات المرتبطة من الجداول التابعة (مؤكدة الوجود)
    
    -- السجلات المالية والإدارية والسنوية
    DELETE FROM public.financial_records WHERE user_id = p_user_id;
    DELETE FROM public.administrative_summary WHERE user_id = p_user_id;
    DELETE FROM public.yearly_records WHERE user_id = p_user_id;
    
    -- السجلات التفصيلية
    DELETE FROM public.thanks_details WHERE user_id = p_user_id;
    DELETE FROM public.committees_details WHERE user_id = p_user_id;
    DELETE FROM public.penalties_details WHERE user_id = p_user_id;
    DELETE FROM public.leaves_details WHERE user_id = p_user_id;
    
    -- الطلبات والإجازات
    DELETE FROM public.leave_requests WHERE user_id = p_user_id;
    DELETE FROM public.five_year_leaves WHERE user_id = p_user_id;
    
    -- الرسائل والمحادثات
    DELETE FROM public.messages WHERE sender_id = p_user_id;
    
    -- إزالة المستخدم من مصفوفة المشاركين في المحادثات (نوع JSONB)
    UPDATE public.conversations 
    SET participants = participants - p_user_id::text
    WHERE participants ? p_user_id::text;

    -- حذف المحادثات الفارغة
    DELETE FROM public.conversations 
    WHERE jsonb_array_length(participants) = 0 OR participants IS NULL;

    -- سجلات المكالمات
    DELETE FROM public.hr_audio_calls WHERE sender_id = p_user_id OR recipient_id = p_user_id;
    
    -- الاستطلاعات
    DELETE FROM public.poll_responses WHERE user_id = p_user_id;
    
    -- 4. تحديث سجلات الأنشطة (بدلاً من الحذف للحفاظ على التاريخ)
    -- ملاحظة: نستخدم EXCEPTION لضمان الاستمرار لو لم يوجد جدول الأنشطة
    BEGIN UPDATE public.activity_logs SET user_id = NULL WHERE user_id = p_user_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.field_change_logs SET changed_by = NULL WHERE changed_by = p_user_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.leave_history SET actor_id = NULL WHERE actor_id = p_user_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    
    -- 5. حذف الملف الشخصي (Profile)
    DELETE FROM public.profiles WHERE id = p_user_id;

    -- 6. حذف حساب المصادقة (Auth User)
    DELETE FROM auth.users WHERE id = p_user_id;

END;
$$;

-- منح صلاحيات التنفيذ
REVOKE ALL ON FUNCTION public.rpc_delete_user_robust(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_delete_user_robust(uuid) TO authenticated;
