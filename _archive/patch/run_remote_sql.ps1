param(
    [string]$sqlFile = "d:\InfTeleKarbala\_archive\patch\inspect_orphans.sql"
)

$pw = [Environment]::GetEnvironmentVariable('VPS_PW', 'User')
if (-not $pw) { $pw = $env:VPS_PW }

& 'C:\Program Files\PuTTY\pscp.exe' -batch -pw $pw $sqlFile muslim@10.56.3.3:/tmp/remote_script.sql
& 'C:\Program Files\PuTTY\plink.exe' -batch -pw $pw muslim@10.56.3.3 'docker exec -i supabase-db psql -U postgres -d postgres < /tmp/remote_script.sql'
