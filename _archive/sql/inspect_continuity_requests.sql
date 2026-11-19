SELECT r.id, r.user_id, p.full_name, r.governorate, r.destination_entity, r.created_at, r.status
FROM service_continuity_requests r
LEFT JOIN profiles p ON p.id = r.user_id;
