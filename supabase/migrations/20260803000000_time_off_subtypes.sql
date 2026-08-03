-- ============================================================
-- Migration: إضافة أعمدة نظام الزمنية المتقدم
-- التاريخ: 2026-08-03
-- الهدف: 
--   1) عمود نوع الزمنية الفرعي (وسط/بداية/نهاية الدوام)
--   2) عمود (بطلب/بدون طلب) لجميع الإجازات
-- ============================================================

-- ─── 1) نوع الزمنية الفرعي ──────────────────────────────────
-- يُستخدم فقط عندما يكون leave_type = 'time_off'
-- القيم: mid_shift (وسط الدوام) | shift_start (بداية الدوام) | shift_end (نهاية الدوام)
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS time_off_subtype TEXT;

-- قيد التحقق: القيم المسموحة فقط
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'leave_requests_time_off_subtype_check'
    ) THEN
        ALTER TABLE public.leave_requests
        ADD CONSTRAINT leave_requests_time_off_subtype_check
        CHECK (
            time_off_subtype IS NULL
            OR time_off_subtype IN ('mid_shift', 'shift_start', 'shift_end')
        );
    END IF;
END $$;

-- ─── 2) بطلب أو بدون طلب ────────────────────────────────────
-- TRUE  = الموظف قدّم طلباً رسمياً قبل حدوث الغياب/التأخير
-- FALSE = النظام أنشأ الإجازة تلقائياً بدون طلب مسبق من الموظف
-- NULL  = السجلات القديمة (قبل التحديث) — تُعامل كـ TRUE
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS with_request BOOLEAN DEFAULT true;

-- ─── 3) فهارس لتحسين أداء الفلترة والتقارير ─────────────────
CREATE INDEX IF NOT EXISTS idx_leave_requests_subtype
    ON public.leave_requests(time_off_subtype)
    WHERE time_off_subtype IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leave_requests_with_request
    ON public.leave_requests(with_request)
    WHERE with_request = false;

-- ─── 4) تحديث السجلات القديمة الإجبارية ──────────────────────
-- السجلات التي أنشأها النظام تلقائياً (is_mandatory = true) تُعلَّم كـ "بدون طلب"
UPDATE public.leave_requests
SET with_request = false
WHERE is_mandatory = true
  AND with_request IS DISTINCT FROM false;

-- ============================================================
-- انتهى السكريبت — نفّذه في SQL Editor في Supabase
-- ============================================================
