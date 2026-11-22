$ErrorActionPreference = 'Stop'
$plink = 'C:\Program Files\PuTTY\plink.exe'
$pw = $env:VPS_PW; if (-not $pw) { $pw = [Environment]::GetEnvironmentVariable('VPS_PW','User') }
$host_ = 'muslim@10.56.3.3'
$remoteSql = '/tmp/fix_cert_perc.sql'

$res = & $plink -batch -pw $pw $host_ "cat $remoteSql | docker exec -i supabase-db psql -U postgres -d postgres"
$res | Out-String
