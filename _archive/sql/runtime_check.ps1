$ErrorActionPreference = 'Stop'
$plink = 'C:\Program Files\PuTTY\plink.exe'
$pw = $env:VPS_PW; if (-not $pw) { $pw = [Environment]::GetEnvironmentVariable('VPS_PW','User') }
if (-not $pw) { throw 'VPS_PW غير مضبوط' }
$host_ = 'muslim@10.56.3.3'

Write-Host "Running operational check on VPS..."
& $plink -batch -pw $pw $host_ "curl -s -I http://127.0.0.1/"
