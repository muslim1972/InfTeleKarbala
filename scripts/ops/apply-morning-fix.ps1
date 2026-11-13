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

Write-Host "Uploading updated SQL to VPS..."
& $pscp -batch -pw $pw "D:\InfTeleKarbala\scripts\sql\morning_shift_daily_evaluator.sql" "muslim@10.56.3.3:/tmp/morning_shift_daily_evaluator.sql"

Write-Host "Executing updated SQL on VPS inside supabase-db..."
& $plink -batch -pw $pw muslim@10.56.3.3 "docker exec -i supabase-db psql -U postgres -d postgres < /tmp/morning_shift_daily_evaluator.sql"
