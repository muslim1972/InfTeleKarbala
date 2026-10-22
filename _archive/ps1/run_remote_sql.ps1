param(
    [string]$SqlFile
)
$ErrorActionPreference = 'Stop'
$pscp = 'C:\Program Files\PuTTY\pscp.exe'
$plink = 'C:\Program Files\PuTTY\plink.exe'
$pw = $env:VPS_PW
if (-not $pw) { $pw = [Environment]::GetEnvironmentVariable('VPS_PW','User') }
if (-not $pw) { throw 'VPS_PW not set' }

& $pscp -batch -pw $pw $SqlFile "muslim@10.56.3.3:/tmp/remote_query.sql"
if ($LASTEXITCODE -ne 0) { throw 'pscp failed' }

& $plink -batch -pw $pw muslim@10.56.3.3 'CONTAINER=$(docker ps --format "{{.Names}}" | grep -m1 db); docker exec -i $CONTAINER psql -U postgres -d postgres < /tmp/remote_query.sql'
