param (
    [string]$file = 'D:\InfTeleKarbala\_archive\sql\inspect_work_schedules.sql'
)
$ErrorActionPreference = 'Stop'
$pscp = 'C:\Program Files\PuTTY\pscp.exe'
$plink = 'C:\Program Files\PuTTY\plink.exe'
$pw = $env:VPS_PW; if (-not $pw) { $pw = [Environment]::GetEnvironmentVariable('VPS_PW','User') }
if (-not $pw) { throw 'VPS_PW غير مضبوط' }
$host_ = 'muslim@10.56.3.3'

& $pscp -batch -pw $pw $file "$($host_):/tmp/query.sql"
& $plink -batch -pw $pw $host_ "docker exec -i supabase-db psql -U postgres -d postgres < /tmp/query.sql"
