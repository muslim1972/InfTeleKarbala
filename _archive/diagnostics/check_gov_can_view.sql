SELECT governorate, 
       count(*) as total, 
       count(*) FILTER (WHERE can_view_requests = true) as enabled,
       count(*) FILTER (WHERE can_view_requests IS NOT TRUE) as disabled
FROM profiles 
GROUP BY governorate;
