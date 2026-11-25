-- استعادة أرصدة الإجازات الاعتيادية المتبقية التي تصفّرت بتاريخ 2026-11-22 14:19:25 أثناء مزامنة حزمة تشرين الثاني
BEGIN;

WITH zeroed AS (
    SELECT DISTINCT ON ((details->'old'->>'user_id')::uuid)
        (details->'old'->>'user_id')::uuid AS user_id,
        (details->'old'->>'remaining_leaves_balance')::integer AS old_balance
    FROM public.activity_logs
    WHERE target_table = 'financial_records'
      AND action = 'UPDATE'
      AND created_at::date = '2026-11-22'
      AND COALESCE((details->'old'->>'remaining_leaves_balance')::integer, 0) > 0
      AND COALESCE((details->'new'->>'remaining_leaves_balance')::integer, 0) = 0
    ORDER BY (details->'old'->>'user_id')::uuid, created_at ASC
),
post_nov22_deductions AS (
    SELECT
        user_id,
        COALESCE(SUM(GREATEST(0, COALESCE(days_count, 0) - COALESCE(unpaid_days, 0))), 0)::integer AS deducted_since
    FROM public.leave_requests
    WHERE created_at >= '2026-11-22 14:19:25+00'
      AND status = 'approved'
      AND is_deducted = TRUE
      AND leave_type IN ('regular', 'long_regular')
    GROUP BY user_id
),
restored_targets AS (
    SELECT
        z.user_id,
        GREATEST(0, z.old_balance - COALESCE(d.deducted_since, 0))::integer AS restored_balance
    FROM zeroed z
    LEFT JOIN post_nov22_deductions d ON d.user_id = z.user_id
)
UPDATE public.financial_records f
SET remaining_leaves_balance = rt.restored_balance,
    updated_at = NOW()
FROM restored_targets rt
WHERE f.user_id = rt.user_id
  AND COALESCE(f.remaining_leaves_balance, 0) = 0;

-- مزامنة النسخة الشهرية النشطة لتشرين الثاني حتى لا تضيع الأرصدة المستعادة عند تبديل/عرض النسخة
UPDATE public.monthly_snapshot_financials msf
SET data = msf.data || jsonb_build_object('remaining_leaves_balance', f.remaining_leaves_balance)
FROM public.financial_records f,
     public.monthly_snapshots ms
WHERE ms.id = msf.snapshot_id
  AND ms.is_active = TRUE
  AND msf.user_id = f.user_id
  AND COALESCE(f.remaining_leaves_balance, 0) > 0
  AND COALESCE((msf.data->>'remaining_leaves_balance')::integer, 0) = 0;

COMMIT;
