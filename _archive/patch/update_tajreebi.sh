docker exec -i supabase-db psql -U postgres -d postgres -c "UPDATE service_continuity_requests SET status = 'pending_hr' WHERE user_id = '4b16b87b-04ba-4bc7-8958-462f74b8c073';"
