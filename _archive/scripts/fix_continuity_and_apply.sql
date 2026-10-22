-- Fix the orphaned first request
UPDATE public.service_continuity_requests
SET supervisor_id = '2a24e7bf-357a-4587-9461-8289dfe802dc'
WHERE id = '3392976d-75f0-4810-8a91-261e342cf0aa' AND supervisor_id IS NULL;

-- Insert the notification for Basheer
INSERT INTO public.system_notifications (
    recipient_id,
    sender_id,
    title,
    content,
    type,
    metadata
) 
SELECT 
    '2a24e7bf-357a-4587-9461-8289dfe802dc',
    'd2c4eef8-72cc-4dd1-a734-00d5ebe94f6d',
    'طلب تأييد استمرارية بالخدمة جديد',
    'قدّم الموظف (مسلم عقيل عبد الحسن) طلباً لتأييد الاستمرارية بالخدمة معنوناً إلى: المصرف العقاري',
    'action_required',
    jsonb_build_object(
        'request_id', '3392976d-75f0-4810-8a91-261e342cf0aa',
        'request_type', 'service_continuity',
        'action_url', '/requests?request_id=3392976d-75f0-4810-8a91-261e342cf0aa'
    )
WHERE NOT EXISTS (
    SELECT 1 FROM public.system_notifications 
    WHERE recipient_id = '2a24e7bf-357a-4587-9461-8289dfe802dc'
    AND metadata->>'request_id' = '3392976d-75f0-4810-8a91-261e342cf0aa'
);
