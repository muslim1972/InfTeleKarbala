-- ==============================================================================
-- Migration: 20261125000000_att09_temporary_work_hours.sql
-- Kernel: BE-ATT-01 / BE-ATT-03 / FE-ATT-01
-- Purpose: Temporary work-hour overrides (Morning / Evening / Night Guard),
--          issuing entity memory, Governorate Director approval workflow,
--          and secure RPCs for creating, updating, and approving/rejecting.
-- ==============================================================================

-- 1. جدول أوامر تعديل ساعات الدوام المؤقتة
CREATE TABLE IF NOT EXISTS public.temporary_work_hour_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    governorate TEXT NOT NULL DEFAULT 'karbala',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    morning_start TIME NOT NULL DEFAULT '08:00:00'::time,
    morning_end TIME NOT NULL DEFAULT '15:00:00'::time,
    evening_start TIME NOT NULL DEFAULT '14:30:00'::time,
    evening_end TIME NOT NULL DEFAULT '20:00:00'::time,
    night_start TIME NOT NULL DEFAULT '20:00:00'::time,
    night_end TIME NOT NULL DEFAULT '08:00:00'::time,
    book_number TEXT NOT NULL,
    book_date DATE NOT NULL,
    issuing_entity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_director' CHECK (status IN ('pending_director', 'approved')),
    pending_revision JSONB DEFAULT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_temp_work_hours_date_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_temp_work_hours_lookup
ON public.temporary_work_hour_overrides (governorate, status, start_date, end_date);

-- 2. جدول ذاكرة الجهات المصدرة للكتب (تبقى محفوظة للفلترة الفورية من أول حرف)
CREATE TABLE IF NOT EXISTS public.work_hour_issuing_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    governorate TEXT NOT NULL DEFAULT 'karbala',
    name TEXT NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_work_hour_issuing_entity UNIQUE (governorate, name)
);

CREATE INDEX IF NOT EXISTS idx_work_hour_issuing_entities_gov
ON public.work_hour_issuing_entities (governorate, name);

-- 3. تفعيل أمان الصفوف RLS (القراءة للمصادق عليهم، والكتابة حصراً عبر دوال RPC)
ALTER TABLE public.temporary_work_hour_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_hour_issuing_entities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read temp work hours" ON public.temporary_work_hour_overrides;
CREATE POLICY "Authenticated read temp work hours"
ON public.temporary_work_hour_overrides
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated read work hour entities" ON public.work_hour_issuing_entities;
CREATE POLICY "Authenticated read work hour entities"
ON public.work_hour_issuing_entities
FOR SELECT
TO authenticated
USING (true);

-- 4. دالة التحقق من أن المستخدم هو «مدير المديرية» تحديداً (وليس المعاون أو غيره)
CREATE OR REPLACE FUNCTION public.is_governorate_director(p_user_id UUID, p_governorate TEXT DEFAULT 'karbala')
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_gov TEXT := COALESCE(NULLIF(trim(p_governorate), ''), 'karbala');
    v_is_director BOOLEAN := false;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN false;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = p_user_id
          AND COALESCE(NULLIF(trim(p.governorate), ''), 'karbala') = v_gov
          AND trim(COALESCE(p.position_title, '')) = 'مدير المديرية'
    ) INTO v_is_director;

    IF v_is_director THEN
        RETURN true;
    END IF;

    -- احتياطي من شجرة الهيكلية: مدير التشكيل الجذري لمديرية الاتصالات (باستثناء المعاون)
    SELECT EXISTS (
        SELECT 1
        FROM public.departments d
        WHERE d.manager_id = p_user_id
          AND COALESCE(NULLIF(trim(d.governorate), ''), 'karbala') = v_gov
          AND d.name ILIKE '%مدير المديرية%'
          AND d.name NOT ILIKE '%معاون%'
    ) INTO v_is_director;

    RETURN v_is_director;
END;
$$;

REVOKE ALL ON FUNCTION public.is_governorate_director(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_governorate_director(UUID, TEXT) TO authenticated, service_role;

-- 5. دالة جلب معرف حساب «مدير المديرية» للمحافظة المعنية
CREATE OR REPLACE FUNCTION public.get_governorate_director_id(p_governorate TEXT DEFAULT 'karbala')
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_gov TEXT := COALESCE(NULLIF(trim(p_governorate), ''), 'karbala');
    v_director_id UUID;
BEGIN
    SELECT p.id INTO v_director_id
    FROM public.profiles p
    WHERE COALESCE(NULLIF(trim(p.governorate), ''), 'karbala') = v_gov
      AND trim(COALESCE(p.position_title, '')) = 'مدير المديرية'
    ORDER BY p.updated_at ASC NULLS LAST, p.id ASC
    LIMIT 1;

    IF v_director_id IS NOT NULL THEN
        RETURN v_director_id;
    END IF;

    SELECT d.manager_id INTO v_director_id
    FROM public.departments d
    WHERE COALESCE(NULLIF(trim(d.governorate), ''), 'karbala') = v_gov
      AND d.manager_id IS NOT NULL
      AND d.name ILIKE '%مدير المديرية%'
      AND d.name NOT ILIKE '%معاون%'
    LIMIT 1;

    RETURN v_director_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_governorate_director_id(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_governorate_director_id(TEXT) TO authenticated, service_role;

-- 6. دالة استرجاع ساعات الدوام الفعالة لتاريخ محدد (تُرجع صفاً فقط إذا وُجد أمر معتمد ساري المفعول)
CREATE OR REPLACE FUNCTION public.get_effective_work_hours(p_date DATE, p_governorate TEXT DEFAULT 'karbala')
RETURNS TABLE (
    id UUID,
    governorate TEXT,
    start_date DATE,
    end_date DATE,
    morning_start TIME,
    morning_end TIME,
    evening_start TIME,
    evening_end TIME,
    night_start TIME,
    night_end TIME,
    book_number TEXT,
    book_date DATE,
    issuing_entity TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        t.id,
        t.governorate,
        t.start_date,
        t.end_date,
        t.morning_start,
        t.morning_end,
        t.evening_start,
        t.evening_end,
        t.night_start,
        t.night_end,
        t.book_number,
        t.book_date,
        t.issuing_entity
    FROM public.temporary_work_hour_overrides t
    WHERE t.governorate = COALESCE(NULLIF(trim(p_governorate), ''), 'karbala')
      AND t.status = 'approved'
      AND p_date >= t.start_date
      AND p_date <= t.end_date
    ORDER BY t.updated_at DESC, t.created_at DESC
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_effective_work_hours(DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_effective_work_hours(DATE, TEXT) TO authenticated, service_role;

-- 7. دالة حفظ أو تعديل أمر ساعات الدوام المؤقتة (مع مسار اعتماد مدير المديرية)
CREATE OR REPLACE FUNCTION public.save_temporary_work_hour_override(
    p_override_id UUID DEFAULT NULL,
    p_governorate TEXT DEFAULT 'karbala',
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_morning_start TIME DEFAULT '08:00:00'::time,
    p_morning_end TIME DEFAULT '15:00:00'::time,
    p_evening_start TIME DEFAULT '14:30:00'::time,
    p_evening_end TIME DEFAULT '20:00:00'::time,
    p_night_start TIME DEFAULT '20:00:00'::time,
    p_night_end TIME DEFAULT '08:00:00'::time,
    p_book_number TEXT DEFAULT NULL,
    p_book_date DATE DEFAULT NULL,
    p_issuing_entity TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller UUID := auth.uid();
    v_gov TEXT := COALESCE(NULLIF(trim(p_governorate), ''), 'karbala');
    v_can_manage BOOLEAN := false;
    v_is_director BOOLEAN := false;
    v_director_id UUID;
    v_caller_name TEXT;
    v_tri_name TEXT;
    v_existing public.temporary_work_hour_overrides%ROWTYPE;
    v_conflict RECORD;
    v_override_id UUID;
    v_clean_book_no TEXT := trim(COALESCE(p_book_number, ''));
    v_clean_entity TEXT := trim(COALESCE(p_issuing_entity, ''));
    v_action_kind TEXT := CASE WHEN p_override_id IS NULL THEN 'create' ELSE 'update' END;
    v_notif_title TEXT;
    v_notif_content TEXT;
    v_payload JSONB;
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير مسجل الدخول';
    END IF;

    -- التحقق من الصلاحيات الإدارية أو صلاحية إدارة البصمة
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = v_caller
          AND (
              p.role = 'admin'
              OR p.admin_role IN ('developer', 'general', 'biometric', 'attendance_supervisor')
              OR COALESCE(p.has_attendance_access, false) = true
              OR p.username = 'attend'
          )
    ) INTO v_can_manage;

    IF NOT v_can_manage THEN
        RAISE EXCEPTION 'غير مصرح لك بتعديل ساعات الدوام الرسمي';
    END IF;

    IF p_start_date IS NULL OR p_end_date IS NULL THEN
        RAISE EXCEPTION 'يرجى تحديد تاريخ من وتاريخ إلى';
    END IF;
    IF p_end_date < p_start_date THEN
        RAISE EXCEPTION 'تاريخ غاية التأثير (إلى) يجب أن يكون مساوياً أو بعد تاريخ البداية (من)';
    END IF;
    IF v_clean_book_no = '' THEN
        RAISE EXCEPTION 'يرجى إدخال رقم الكتاب الرسمي';
    END IF;
    IF p_book_date IS NULL THEN
        RAISE EXCEPTION 'يرجى تحديد تاريخ الكتاب الرسمي';
    END IF;
    IF v_clean_entity = '' THEN
        RAISE EXCEPTION 'يرجى كتابة الجهة المصدرة للكتاب';
    END IF;

    -- تخزين الجهة المصدرة في الذاكرة الدائمة فورياً
    INSERT INTO public.work_hour_issuing_entities (governorate, name, created_by)
    VALUES (v_gov, v_clean_entity, v_caller)
    ON CONFLICT (governorate, name) DO NOTHING;

    -- التحقق من وجود السجل عند التعديل
    IF p_override_id IS NOT NULL THEN
        SELECT * INTO v_existing
        FROM public.temporary_work_hour_overrides
        WHERE id = p_override_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'السجل المطلوب تعديله غير موجود';
        END IF;
        v_gov := v_existing.governorate;
    END IF;

    -- التحقق من عدم تداخل الفترة مع أمر آخر معتمد في نفس المحافظة
    SELECT id, start_date, end_date, book_number
    INTO v_conflict
    FROM public.temporary_work_hour_overrides t
    WHERE t.governorate = v_gov
      AND t.status = 'approved'
      AND (p_override_id IS NULL OR t.id <> p_override_id)
      AND t.start_date <= p_end_date
      AND t.end_date >= p_start_date
    LIMIT 1;

    IF v_conflict.id IS NOT NULL THEN
        RAISE EXCEPTION 'الفترة المحددة تتداخل مع أمر معتمد سابق (الكتاب رقم % للفترة من % إلى %). يرجى تعديل تاريخ غاية التأثير للأمر السابق أولاً.',
            v_conflict.book_number, v_conflict.start_date, v_conflict.end_date;
    END IF;

    -- فحص هل المُدخل هو مدير المديرية نفسه
    v_is_director := public.is_governorate_director(v_caller, v_gov);

    IF v_is_director THEN
        -- مدير المديرية نفسه: اعتماد وتنفيذ فوري بدون إشعار
        IF p_override_id IS NULL THEN
            INSERT INTO public.temporary_work_hour_overrides (
                governorate, start_date, end_date,
                morning_start, morning_end,
                evening_start, evening_end,
                night_start, night_end,
                book_number, book_date, issuing_entity,
                status, pending_revision, created_by, approved_by, approved_at, updated_by
            ) VALUES (
                v_gov, p_start_date, p_end_date,
                p_morning_start, p_morning_end,
                p_evening_start, p_evening_end,
                p_night_start, p_night_end,
                v_clean_book_no, p_book_date, v_clean_entity,
                'approved', NULL, v_caller, v_caller, now(), v_caller
            )
            RETURNING id INTO v_override_id;
        ELSE
            UPDATE public.temporary_work_hour_overrides
            SET start_date = p_start_date,
                end_date = p_end_date,
                morning_start = p_morning_start,
                morning_end = p_morning_end,
                evening_start = p_evening_start,
                evening_end = p_evening_end,
                night_start = p_night_start,
                night_end = p_night_end,
                book_number = v_clean_book_no,
                book_date = p_book_date,
                issuing_entity = v_clean_entity,
                status = 'approved',
                pending_revision = NULL,
                approved_by = v_caller,
                approved_at = now(),
                updated_by = v_caller,
                updated_at = now()
            WHERE id = p_override_id
            RETURNING id INTO v_override_id;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'id', v_override_id,
            'status', 'approved',
            'direct_execution', true,
            'message', 'تم اعتماد وتنفيذ تعديل ساعات الدوام فوراً بنجاح'
        );
    END IF;

    -- لم يكن مدير المديرية: يلزم استخراج الاسم الثلاثي وإرسال إشعار الاعتماد لمدير المديرية
    SELECT full_name INTO v_caller_name FROM public.profiles WHERE id = v_caller;
    v_tri_name := COALESCE(NULLIF(trim(public.extract_tripartite_name(v_caller_name)), ''), COALESCE(v_caller_name, 'موظف'));
    v_director_id := public.get_governorate_director_id(v_gov);

    IF v_director_id IS NULL THEN
        RAISE EXCEPTION 'تعذر تحديد حساب السيد مدير المديرية لهذه المحافظة لإرسال طلب الاعتماد';
    END IF;

    v_payload := jsonb_build_object(
        'start_date', p_start_date::text,
        'end_date', p_end_date::text,
        'morning_start', to_char(p_morning_start, 'HH24:MI:SS'),
        'morning_end', to_char(p_morning_end, 'HH24:MI:SS'),
        'evening_start', to_char(p_evening_start, 'HH24:MI:SS'),
        'evening_end', to_char(p_evening_end, 'HH24:MI:SS'),
        'night_start', to_char(p_night_start, 'HH24:MI:SS'),
        'night_end', to_char(p_night_end, 'HH24:MI:SS'),
        'book_number', v_clean_book_no,
        'book_date', p_book_date::text,
        'issuing_entity', v_clean_entity,
        'requested_by', v_caller,
        'requester_name', v_tri_name,
        'requested_at', now()
    );

    IF p_override_id IS NULL THEN
        INSERT INTO public.temporary_work_hour_overrides (
            governorate, start_date, end_date,
            morning_start, morning_end,
            evening_start, evening_end,
            night_start, night_end,
            book_number, book_date, issuing_entity,
            status, pending_revision, created_by, updated_by
        ) VALUES (
            v_gov, p_start_date, p_end_date,
            p_morning_start, p_morning_end,
            p_evening_start, p_evening_end,
            p_night_start, p_night_end,
            v_clean_book_no, p_book_date, v_clean_entity,
            'pending_director', NULL, v_caller, v_caller
        )
        RETURNING id INTO v_override_id;
    ELSIF v_existing.status = 'pending_director' THEN
        -- السجل ما زال معلقاً: نحدّثه مباشرة
        UPDATE public.temporary_work_hour_overrides
        SET start_date = p_start_date,
            end_date = p_end_date,
            morning_start = p_morning_start,
            morning_end = p_morning_end,
            evening_start = p_evening_start,
            evening_end = p_evening_end,
            night_start = p_night_start,
            night_end = p_night_end,
            book_number = v_clean_book_no,
            book_date = p_book_date,
            issuing_entity = v_clean_entity,
            updated_by = v_caller,
            updated_at = now()
        WHERE id = p_override_id
        RETURNING id INTO v_override_id;
    ELSE
        -- السجل معتمد حالياً: نحفظ مقترح التعديل في pending_revision ليبقى السجل الحالي سارياً لحين موافقة المدير
        UPDATE public.temporary_work_hour_overrides
        SET pending_revision = v_payload,
            updated_by = v_caller,
            updated_at = now()
        WHERE id = p_override_id
        RETURNING id INTO v_override_id;
    END IF;

    -- تعليم أي إشعار اعتماد سابق لنفس الأمر كمقروء لمنع تضارب الأزرار القديمة
    UPDATE public.system_notifications
    SET is_read = true
    WHERE recipient_id = v_director_id
      AND type = 'work_hours_approval'
      AND (metadata->>'override_id') = v_override_id::text
      AND is_read = false;

    v_notif_title := CASE
        WHEN p_override_id IS NULL THEN '⏱️ طلب اعتماد تعديل ساعات الدوام'
        ELSE '⏱️ طلب تعديل فترة/بيانات ساعات الدوام'
    END;

    v_notif_content := 'قام الموظف ' || v_tri_name || ' بإدخال تعديل على ساعات الدوام للفترة من ' ||
        to_char(p_start_date, 'YYYY-MM-DD') || ' إلى ' || to_char(p_end_date, 'YYYY-MM-DD') ||
        ' فهل تعتمد هذا الإجراء ؟';

    INSERT INTO public.system_notifications (recipient_id, sender_id, type, title, content, is_read, metadata)
    VALUES (
        v_director_id,
        v_caller,
        'work_hours_approval',
        v_notif_title,
        v_notif_content,
        false,
        v_payload || jsonb_build_object(
            'type', 'work_hours_approval',
            'override_id', v_override_id,
            'action_kind', v_action_kind,
            'governorate', v_gov,
            'morning_start', to_char(p_morning_start, 'HH24:MI'),
            'morning_end', to_char(p_morning_end, 'HH24:MI'),
            'evening_start', to_char(p_evening_start, 'HH24:MI'),
            'evening_end', to_char(p_evening_end, 'HH24:MI'),
            'night_start', to_char(p_night_start, 'HH24:MI'),
            'night_end', to_char(p_night_end, 'HH24:MI')
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'id', v_override_id,
        'status', 'pending_director',
        'direct_execution', false,
        'message', 'تم حفظ الطلب وإرسال إشعار الاعتماد إلى السيد مدير المديرية'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.save_temporary_work_hour_override(UUID, TEXT, DATE, DATE, TIME, TIME, TIME, TIME, TIME, TIME, TEXT, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_temporary_work_hour_override(UUID, TEXT, DATE, DATE, TIME, TIME, TIME, TIME, TIME, TIME, TEXT, DATE, TEXT) TO authenticated, service_role;

-- 8. دالة قرار مدير المديرية (موافق / رفض)
CREATE OR REPLACE FUNCTION public.respond_temporary_work_hour_override(
    p_override_id UUID,
    p_decision TEXT,
    p_notification_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller UUID := auth.uid();
    v_rec public.temporary_work_hour_overrides%ROWTYPE;
    v_rev JSONB;
    v_target_user UUID;
    v_rej_start TEXT;
    v_rej_end TEXT;
    v_conflict RECORD;
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير مسجل الدخول';
    END IF;

    IF p_decision NOT IN ('approve', 'reject') THEN
        RAISE EXCEPTION 'قرار غير صالح';
    END IF;

    SELECT * INTO v_rec
    FROM public.temporary_work_hour_overrides
    WHERE id = p_override_id;

    IF NOT FOUND THEN
        -- تعليم الإشعار كمقروء إذا كان السجل محذوفاً مسبقاً
        IF p_notification_id IS NOT NULL THEN
            UPDATE public.system_notifications SET is_read = true WHERE id = p_notification_id AND recipient_id = v_caller;
        END IF;
        RAISE EXCEPTION 'الطلب غير موجود أو تمت معالجته مسبقاً';
    END IF;

    IF NOT public.is_governorate_director(v_caller, v_rec.governorate) THEN
        RAISE EXCEPTION 'غير مصرح: هذا الإجراء محصور بحساب السيد مدير المديرية فقط';
    END IF;

    IF p_decision = 'approve' THEN
        IF v_rec.pending_revision IS NOT NULL THEN
            v_rev := v_rec.pending_revision;

            SELECT id, book_number, start_date, end_date INTO v_conflict
            FROM public.temporary_work_hour_overrides t
            WHERE t.governorate = v_rec.governorate
              AND t.status = 'approved'
              AND t.id <> v_rec.id
              AND t.start_date <= (v_rev->>'end_date')::date
              AND t.end_date >= (v_rev->>'start_date')::date
            LIMIT 1;

            IF v_conflict.id IS NOT NULL THEN
                RAISE EXCEPTION 'يوجد تداخل مع أمر معتمد آخر (الكتاب % للفترة % إلى %)', v_conflict.book_number, v_conflict.start_date, v_conflict.end_date;
            END IF;

            UPDATE public.temporary_work_hour_overrides
            SET start_date = (v_rev->>'start_date')::date,
                end_date = (v_rev->>'end_date')::date,
                morning_start = (v_rev->>'morning_start')::time,
                morning_end = (v_rev->>'morning_end')::time,
                evening_start = (v_rev->>'evening_start')::time,
                evening_end = (v_rev->>'evening_end')::time,
                night_start = (v_rev->>'night_start')::time,
                night_end = (v_rev->>'night_end')::time,
                book_number = v_rev->>'book_number',
                book_date = (v_rev->>'book_date')::date,
                issuing_entity = v_rev->>'issuing_entity',
                status = 'approved',
                pending_revision = NULL,
                approved_by = v_caller,
                approved_at = now(),
                updated_by = COALESCE((v_rev->>'requested_by')::uuid, v_rec.updated_by),
                updated_at = now()
            WHERE id = p_override_id;
        ELSE
            SELECT id, book_number, start_date, end_date INTO v_conflict
            FROM public.temporary_work_hour_overrides t
            WHERE t.governorate = v_rec.governorate
              AND t.status = 'approved'
              AND t.id <> v_rec.id
              AND t.start_date <= v_rec.end_date
              AND t.end_date >= v_rec.start_date
            LIMIT 1;

            IF v_conflict.id IS NOT NULL THEN
                RAISE EXCEPTION 'يوجد تداخل مع أمر معتمد آخر (الكتاب % للفترة % إلى %)', v_conflict.book_number, v_conflict.start_date, v_conflict.end_date;
            END IF;

            UPDATE public.temporary_work_hour_overrides
            SET status = 'approved',
                pending_revision = NULL,
                approved_by = v_caller,
                approved_at = now(),
                updated_at = now()
            WHERE id = p_override_id;
        END IF;

        UPDATE public.system_notifications
        SET is_read = true
        WHERE (id = p_notification_id OR (type = 'work_hours_approval' AND (metadata->>'override_id') = p_override_id::text));

        RETURN jsonb_build_object(
            'success', true,
            'decision', 'approve',
            'message', 'تمت الموافقة وتطبيق تعديل ساعات الدوام بنجاح'
        );
    ELSE
        -- قرار الرفض: حذف الإدخال (أو مسح المقترح المعلق مع بقاء الأمر السابق الساري) + إشعار للمدخل مع زر «اطلعت»
        IF v_rec.pending_revision IS NOT NULL AND v_rec.status = 'approved' THEN
            v_rev := v_rec.pending_revision;
            v_target_user := COALESCE((v_rev->>'requested_by')::uuid, v_rec.updated_by, v_rec.created_by);
            v_rej_start := v_rev->>'start_date';
            v_rej_end := v_rev->>'end_date';

            UPDATE public.temporary_work_hour_overrides
            SET pending_revision = NULL,
                updated_at = now()
            WHERE id = p_override_id;
        ELSE
            v_target_user := v_rec.created_by;
            v_rej_start := to_char(v_rec.start_date, 'YYYY-MM-DD');
            v_rej_end := to_char(v_rec.end_date, 'YYYY-MM-DD');

            DELETE FROM public.temporary_work_hour_overrides
            WHERE id = p_override_id;
        END IF;

        UPDATE public.system_notifications
        SET is_read = true
        WHERE (id = p_notification_id OR (type = 'work_hours_approval' AND (metadata->>'override_id') = p_override_id::text));

        IF v_target_user IS NOT NULL THEN
            INSERT INTO public.system_notifications (recipient_id, sender_id, type, title, content, is_read, metadata)
            VALUES (
                v_target_user,
                v_caller,
                'work_hours_rejected',
                '❌ رفض تعديل ساعات الدوام',
                'إن السيد مدير المديرية لم يوافق على إدخال التعديل على ساعات الدوام للفترة من ' ||
                COALESCE(v_rej_start, '') || ' إلى ' || COALESCE(v_rej_end, '') || '.',
                false,
                jsonb_build_object(
                    'type', 'work_hours_rejected',
                    'start_date', v_rej_start,
                    'end_date', v_rej_end
                )
            );
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'decision', 'reject',
            'message', 'تم رفض الطلب وحذف الإدخال وإبلاغ الموظف بذلك'
        );
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_temporary_work_hour_override(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_temporary_work_hour_override(UUID, TEXT, UUID) TO authenticated, service_role;
