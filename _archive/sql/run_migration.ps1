param (
    [string]$file = 'D:\InfTeleKarbala\supabase\migrations\20261118000000_att01_work_schedules_exemptions_and_special.sql'
)
$ErrorActionPreference = 'Stop'
$pscp = 'C:\Program Files\PuTTY\pscp.exe'
$plink = 'C:\Program Files\PuTTY\plink.exe'
$pw = $env:VPS_PW; if (-not $pw) { $pw = [Environment]::GetEnvironmentVariable('VPS_PW','User') }
if (-not $pw) { throw 'VPS_PW غير مضبوط' }
$host_ = 'muslim@10.56.3.3'

Write-Host "Uploading migration $file..."
& $pscp -batch -pw $pw $file "$($host_):/tmp/migration.sql"

Write-Host "Executing migration on VPS as supabase_admin..."
& $plink -batch -pw $pw $host_ "docker exec -i supabase-db psql -U supabase_admin -d postgres < /tmp/migration.sql"
