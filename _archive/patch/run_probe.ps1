$pw = [Environment]::GetEnvironmentVariable('VPS_PW', 'User')
if (-not $pw) { $pw = $env:VPS_PW }

& 'C:\Program Files\PuTTY\pscp.exe' -batch -pw $pw d:\InfTeleKarbala\_archive\patch\probe.sql muslim@10.56.3.3:/tmp/probe.sql
& 'C:\Program Files\PuTTY\plink.exe' -batch -pw $pw muslim@10.56.3.3 'docker exec -i supabase-db psql -U postgres -d postgres < /tmp/probe.sql'
