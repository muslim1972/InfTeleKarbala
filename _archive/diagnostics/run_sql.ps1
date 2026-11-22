$ErrorActionPreference = 'Stop'
$pscp = 'C:\Program Files\PuTTY\pscp.exe'
$plink = 'C:\Program Files\PuTTY\plink.exe'
$pw = $env:VPS_PW; if (-not $pw) { $pw = [Environment]::GetEnvironmentVariable('VPS_PW','User') }
$host_ = 'muslim@10.56.3.3'
$localSql = 'D:\InfTeleKarbala\_archive\diagnostics\check_audit_emp.sql'
$remoteSql = '/tmp/check_audit_emp.sql'

& $pscp -batch -pw $pw $localSql "$($host_):$($remoteSql)"
$res = & $plink -batch -pw $pw $host_ "cat $remoteSql | docker exec -i supabase-db psql -U postgres -d postgres"
$res | Out-String
