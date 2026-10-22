$ErrorActionPreference = 'Stop'
$pw = $env:VPS_PW
if (-not $pw) { $pw = [Environment]::GetEnvironmentVariable('VPS_PW', 'User') }
& 'C:\Program Files\PuTTY\pscp.exe' -batch -pw $pw "D:\InfTeleKarbala\_archive\sql\verify_karbala_locations.sql" muslim@10.56.3.3:/tmp/verify_karbala_locations.sql
& 'C:\Program Files\PuTTY\plink.exe' -batch -pw $pw muslim@10.56.3.3 'docker exec -i supabase-db psql -U postgres -d postgres < /tmp/verify_karbala_locations.sql'
