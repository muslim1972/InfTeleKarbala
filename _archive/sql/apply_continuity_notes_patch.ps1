$ErrorActionPreference = 'Stop'
$pscp = 'C:\Program Files\PuTTY\pscp.exe'
$plink = 'C:\Program Files\PuTTY\plink.exe'
$pw = $env:VPS_PW; if (-not $pw) { $pw = [Environment]::GetEnvironmentVariable('VPS_PW','User') }
if (-not $pw) { throw 'VPS_PW غير مضبوط' }
$host_ = 'muslim@10.56.3.3'

$localSql = 'D:\InfTeleKarbala\supabase\migrations\20261117193000_hr01_service_continuity_require_notes.sql'
$remoteSql = '/tmp/patch_continuity_require_notes.sql'

Write-Host "Uploading SQL patch to VPS..."
& $pscp -batch -pw $pw $localSql "$($host_):$remoteSql"

Write-Host "Executing SQL inside supabase-db as supabase_admin..."
& $plink -batch -pw $pw $host_ "docker exec -i supabase-db psql -U supabase_admin -d postgres < $remoteSql"

$checkSql = 'D:\InfTeleKarbala\_archive\sql\verify_notes_in_func.sql'
& $pscp -batch -pw $pw $checkSql "$($host_):/tmp/verify_notes_in_func.sql"
& $plink -batch -pw $pw $host_ "docker exec -i supabase-db psql -U postgres -d postgres < /tmp/verify_notes_in_func.sql"
