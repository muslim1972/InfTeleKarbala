#!/bin/bash
docker exec -i $(docker ps --format '{{.Names}}' | grep -m1 db) psql -U postgres -d postgres -c "
SELECT 'profiles' as tbl, count(*) FROM public.profiles WHERE id IN ('f89abd8e-8562-4686-9d17-360476c871e2', '289de663-2e4c-47dc-8998-6b76d3463f7e', '2cdec3ad-a34d-49a3-adbc-36f2e7c472dc')
UNION ALL
SELECT 'financial_records', count(*) FROM public.financial_records WHERE user_id IN ('f89abd8e-8562-4686-9d17-360476c871e2', '289de663-2e4c-47dc-8998-6b76d3463f7e', '2cdec3ad-a34d-49a3-adbc-36f2e7c472dc');
"
