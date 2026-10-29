$ErrorActionPreference = 'Stop'
$pscp = 'C:\Program Files\PuTTY\pscp.exe'
$plink = 'C:\Program Files\PuTTY\plink.exe'
$pw = $env:VPS_PW; if (-not $pw) { $pw = [Environment]::GetEnvironmentVariable('VPS_PW','User') }
if (-not $pw) { throw 'VPS_PW غير مضبوط' }

$host_ = 'muslim@10.56.3.3'
$sqlLocal = 'D:\InfTeleKarbala\supabase\migrations\20261028140000_hr01_continuity_cc_recipients.sql'
$sqlRemote = '/tmp/20261028140000_hr01_continuity_cc_recipients.sql'

Write-Host "1. Uploading SQL migration..."
& $pscp -batch -pw $pw $sqlLocal "${host_}:${sqlRemote}"
if ($LASTEXITCODE -ne 0) { throw 'فشل رفع ملف SQL' }

Write-Host "2. Uploading runsql.sh..."
& $pscp -batch -pw $pw 'D:\InfTeleKarbala\scripts\ops\runsql.sh' "${host_}:/tmp/runsql.sh"
if ($LASTEXITCODE -ne 0) { throw 'فشل رفع runsql.sh' }

Write-Host "3. Executing SQL inside supabase-db..."
& $plink -batch -pw $pw $host_ "sed -i 's/\r$//' /tmp/runsql.sh; VPS_PW='$pw' bash /tmp/runsql.sh $sqlRemote supabase_admin"

Write-Host "Done."
