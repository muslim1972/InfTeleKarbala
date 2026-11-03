#!/bin/bash
docker exec -i $(docker ps --format '{{.Names}}' | grep -m1 db) psql -U postgres -d postgres -c "SELECT id, email, created_at, raw_user_meta_data FROM auth.users WHERE email LIKE '%103523%';"
docker exec -i $(docker ps --format '{{.Names}}' | grep -m1 db) psql -U postgres -d postgres -c "SELECT id, job_number, full_name, governorate FROM public.profiles WHERE job_number = '103523' OR full_name LIKE '%صابرين%';"
