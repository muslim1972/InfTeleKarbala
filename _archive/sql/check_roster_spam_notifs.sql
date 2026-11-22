SELECT recipient_id, count(*) 
FROM system_notifications 
WHERE metadata->>'type' = 'roster_expiry_reminder' OR title LIKE '%تحديث جدول دوام المناوبة%'
GROUP BY recipient_id;
