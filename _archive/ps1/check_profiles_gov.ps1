$ErrorActionPreference = 'Stop'
$pw = $env:VPS_PW
if (-not $pw) { $pw = [Environment]::GetEnvironmentVariable('VPS_PW', 'User') }
& 'C:\Program Files\PuTTY\pscp.exe' -batch -pw $pw "D:\InfTeleKarbala\_archive\sql\check_profiles_gov.sql" muslim@10.56.3.3:/tmp/check_profiles_gov.sql
& 'C:\Program Files\PuTTY\plink.exe' -batch -pw $pw muslim@10.56.3.3 'docker exec -i supabase-db psql -U postgres -d postgres < /tmp/check_profiles_gov.sql'
