$pw = [Environment]::GetEnvironmentVariable('VPS_PW', 'User')
if (-not $pw) { $pw = $env:VPS_PW }
& 'C:\Program Files\PuTTY\plink.exe' -batch -pw $pw muslim@10.56.3.3 "docker exec -i supabase-db psql -U postgres -d postgres -c 'SELECT id, full_name, job_number, dept_text FROM profiles WHERE id = '\''4b16b87b-04ba-4bc7-8958-462f74b8c073'\'';'"
