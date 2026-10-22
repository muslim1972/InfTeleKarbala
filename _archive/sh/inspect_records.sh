#!/bin/bash
docker exec -i supabase-db psql -U supabase_admin -d postgres << 'EOF'
\d attendance_records
SELECT * FROM attendance_records WHERE employee_id = 'd2c4eef8-72cc-4dd1-a734-00d5ebe94f6d' ORDER BY created_at DESC LIMIT 2;
EOF
