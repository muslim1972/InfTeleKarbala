$ErrorActionPreference = 'Stop'
$pw = $env:VPS_PW
if (-not $pw) {
    $pw = [Environment]::GetEnvironmentVariable('VPS_PW', 'User')
}
if (-not $pw) {
    Write-Error "VPS_PW not set"
    exit 1
}

$puttyDir = "C:\Program Files\PuTTY"
$pscp = Join-Path $puttyDir "pscp.exe"
$plink = Join-Path $puttyDir "plink.exe"

Write-Host "Uploading diagnose script..."
& $pscp -batch -pw $pw "D:\InfTeleKarbala\scripts\ops\diagnose-nibras.sh" "muslim@10.56.3.3:/tmp/diagnose-nibras.sh"

Write-Host "Executing diagnose script on VPS..."
& $plink -batch -pw $pw muslim@10.56.3.3 "chmod +x /tmp/diagnose-nibras.sh && /tmp/diagnose-nibras.sh"
