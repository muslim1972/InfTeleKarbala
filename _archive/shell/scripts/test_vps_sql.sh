#!/bin/bash
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT prosrc FROM pg_proc WHERE proname = 'submit_attendance_record_secure';"
