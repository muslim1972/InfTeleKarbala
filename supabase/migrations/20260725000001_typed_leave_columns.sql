-- ============================================================
-- Migration 1: typed_leave_columns
-- التاريخ: 2026-07-25
-- الهدف: إضافة أعمدة للأنواع السبعة الجديدة من الإجازات
--
-- ملاحظات:
--   * كل الأعمدة الجديدة nullable أو لها default (backward compatible)
--   * السجلات القديمة تأخذ leave_type = 'regular' افتراضياً
--   * لا تُغيّر على دوال موجودة، فقط تضيف أعمدة
-- ============================================================

-- ============================================================
-- القسم 1: الأعمدة الرئيسية في leave_requests
-- ============================================================

-- 1) نوع الإجازة (العمود الأهم)
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS leave_type TEXT NOT NULL DEFAULT 'regular';

-- 2) قيد التحقق على نوع الإجازة
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'leave_requests_leave_type_check'
    ) THEN
        ALTER TABLE public.leave_requests
        ADD CONSTRAINT leave_requests_leave_type_check
        CHECK (leave_type IN (
            'regular',         -- اعتيادية (1-9 أيام)
            'long_regular',    -- اعتيادية طويلة (>9 أيام)
            'sick',            -- مرضية (1-21 يوم)
            'long_sick',       -- مرضية طويلة (22 يوم - 6 أشهر)
            'time_off',        -- زمنية (30د - 2ساعة)
            'dispatch',        -- إيفاد
            'duty',            -- واجب (يوم واحد)
            'cumulative_time'  -- زمنيات تراكمية (داخلي - لا نموذج)
        ));
    END IF;
END $$;

-- 3) مدة الزمنية (بالدقائق - فقط لـ time_off)
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS time_duration_minutes INTEGER;

-- قيد: لا يُسمح بـ time_duration_minutes إلا إذا كان النوع time_off
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'leave_requests_time_duration_check'
    ) THEN
        ALTER TABLE public.leave_requests
        ADD CONSTRAINT leave_requests_time_duration_check
        CHECK (
            (leave_type = 'time_off' AND time_duration_minutes IS NOT NULL)
            OR (leave_type != 'time_off' AND time_duration_minutes IS NULL)
            OR (leave_type = 'time_off' AND time_duration_minutes BETWEEN 30 AND 120 AND time_duration_minutes % 30 = 0)
        );
    END IF;
END $$;

-- 4) الجهة الموفد إليها (للإيفاد والواجب)
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS destination TEXT;

-- 5) براتب / بدون راتب (toggle للأنواع الطويلة والمرضية)
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS with_pay BOOLEAN DEFAULT TRUE;

-- 6) صور داعمة من الموظف (حتى 3 صور)
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS supporting_image_urls TEXT[] DEFAULT '{}'::TEXT[];

-- قيد: لا أكثر من 3 صور
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'leave_requests_supporting_images_max_check'
    ) THEN
        ALTER TABLE public.leave_requests
        ADD CONSTRAINT leave_requests_supporting_images_max_check
        CHECK (array_length(supporting_image_urls, 1) IS NULL OR array_length(supporting_image_urls, 1) <= 3);
    END IF;
END $$;

-- ============================================================
-- القسم 2: حالة HR (للأنواع التي تتطلب تدخل HR)
-- ============================================================

-- 7) حالة معالجة HR
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS hr_status TEXT DEFAULT NULL;

-- قيد التحقق على hr_status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'leave_requests_hr_status_check'
    ) THEN
        ALTER TABLE public.leave_requests
        ADD CONSTRAINT leave_requests_hr_status_check
        CHECK (hr_status IS NULL OR hr_status IN ('pending', 'in_progress', 'completed'));
    END IF;
END $$;

-- 8) المكلف بمعالجة HR
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS hr_assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 9) تاريخ اكتمال معالجة HR
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS hr_completed_at TIMESTAMP WITH TIME ZONE;

-- ============================================================
-- القسم 3: حقول مستندات HR (تختلف حسب نوع الإجازة)
-- ============================================================

-- 10) الأمر الإداري (للاعتيادية الطويلة فقط)
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS admin_order_number TEXT;
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS admin_order_date DATE;
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS admin_order_image_url TEXT;

-- 11) براءة الذمة (للاعتيادية الطويلة فقط)
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS clearance_letter_number TEXT;
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS clearance_letter_date DATE;
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS clearance_letter_image_url TEXT;

-- 12) كتاب إرسال الموظف إلى المستشفى (للمرضية/الطويلة)
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS hospital_referral_letter_number TEXT;
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS hospital_referral_letter_date DATE;
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS hospital_referral_letter_image_url TEXT;

-- 13) رد المستشفى (يُملأ بعد عودة الموظف)
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS hospital_response_letter_number TEXT;
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS hospital_response_letter_date DATE;
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS hospital_response_letter_image_url TEXT;
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS hospital_response_days INTEGER;

-- 14) أمر الإيفاد (للإيفاد فقط)
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS dispatch_order_number TEXT;
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS dispatch_order_date DATE;
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS dispatch_order_image_url TEXT;

-- 15) كتاب إنهاء الإيفاد (يُملأ بعد عودة الموظف)
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS dispatch_end_letter_number TEXT;
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS dispatch_end_letter_date DATE;
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS dispatch_end_letter_image_url TEXT;
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS dispatch_actual_days INTEGER;

-- 16) ورقة الواجب (يُملأ من قِبل مسؤول البصمة)
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS duty_paper_image_url TEXT;
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS duty_paper_issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS duty_paper_issued_at TIMESTAMP WITH TIME ZONE;

-- ============================================================
-- القسم 4: حقول مساعدة
-- ============================================================

-- 17) ملاحظات عامة
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 18) هل هذا الطلب تم توليده تلقائياً من تحويل زمنيات
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS converted_to_cumulative BOOLEAN DEFAULT FALSE;

-- 19) معرف طلبات الزمنية المصدرية (للزمنيات التراكمية فقط)
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS source_time_off_ids UUID[] DEFAULT '{}'::UUID[];

-- ============================================================
-- القسم 5: عمود financial_records للزمنيات التراكمية
-- ============================================================

-- يحتفظ بالدقائق المتبقية من تحويل سابق (لتجنب ضياع الباقي)
ALTER TABLE public.financial_records
ADD COLUMN IF NOT EXISTS cumulative_minutes_remaining INTEGER NOT NULL DEFAULT 0;

-- قيد: لا يمكن أن يكون سالباً
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'financial_records_cumulative_minutes_check'
    ) THEN
        ALTER TABLE public.financial_records
        ADD CONSTRAINT financial_records_cumulative_minutes_check
        CHECK (cumulative_minutes_remaining >= 0);
    END IF;
END $$;

-- ============================================================
-- القسم 6: Indexes لتحسين الأداء
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_leave_requests_leave_type ON public.leave_requests(leave_type);
CREATE INDEX IF NOT EXISTS idx_leave_requests_hr_status ON public.leave_requests(hr_status) WHERE hr_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_type ON public.leave_requests(user_id, leave_type);
CREATE INDEX IF NOT EXISTS idx_leave_requests_converted ON public.leave_requests(converted_to_cumulative) WHERE converted_to_cumulative = FALSE;
CREATE INDEX IF NOT EXISTS idx_leave_requests_hr_assigned ON public.leave_requests(hr_assigned_to) WHERE hr_assigned_to IS NOT NULL;

-- ============================================================
-- القسم 7: تحديث السجلات الموجودة لتأخذ 'regular' صراحةً
-- ============================================================

-- ملاحظة: العمود NOT NULL DEFAULT 'regular' يضمن أن السجلات القديمة
-- تأخذ 'regular' تلقائياً. لا حاجة لـ UPDATE إضافي.

-- ============================================================
-- القسم 8: سياسات RLS إضافية (لكي يطّلع HR/Admin على كل الطلبات)
-- ============================================================

-- HR و Admin يستطيعون تحديث hr_status
DROP POLICY IF EXISTS "HR can update hr_status" ON public.leave_requests;
CREATE POLICY "HR can update hr_status"
ON public.leave_requests
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND (
            role = 'admin'
            OR admin_role = 'hr_supervisor'
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND (
            role = 'admin'
            OR admin_role = 'hr_supervisor'
        )
    )
);

-- ============================================================
-- نهاية Migration 1
-- ============================================================
-- الخطوة التالية: Migration 2 (submit_typed_leave_request RPC)
-- ============================================================
