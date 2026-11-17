$pw = $env:VPS_PW
if (-not $pw) {
    $pw = [Environment]::GetEnvironmentVariable('VPS_PW', 'User')
}
& 'C:\Program Files\PuTTY\pscp.exe' -batch -pw $pw 'd:\InfTeleKarbala\supabase\migrations\20261117183000_core_revoke_anon_hr_and_admin_rpcs.sql' muslim@10.56.3.3:/tmp/migration2.sql
& 'C:\Program Files\PuTTY\plink.exe' -batch -pw $pw muslim@10.56.3.3 'docker exec -i supabase-db psql -U supabase_admin -d postgres < /tmp/migration2.sql'
