$pw = [Environment]::GetEnvironmentVariable('VPS_PW', 'User')
if (-not $pw) { $pw = $env:VPS_PW }
& 'C:\Program Files\PuTTY\plink.exe' -batch -pw $pw muslim@10.56.3.3 "docker exec -i supabase-db psql -U postgres -d postgres -c \"SELECT public.verify_continuity_letter('6c685209-30ff-4899-a7f3-af8c5ebdefc8');\""
