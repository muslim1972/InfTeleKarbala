$plink = 'C:\Program Files\PuTTY\plink.exe'
$pscp = 'C:\Program Files\PuTTY\pscp.exe'
$pw = $env:VPS_PW; if (-not $pw) { $pw = [Environment]::GetEnvironmentVariable('VPS_PW','User') }
if (-not $pw) { throw 'VPS_PW not set' }

& $pscp -batch -pw $pw 'D:\InfTeleKarbala\_archive\temp\check_nginx.sh' muslim@10.56.3.3:/tmp/check_nginx.sh
& $plink -batch -pw $pw muslim@10.56.3.3 'bash /tmp/check_nginx.sh'
& $plink -batch -pw $pw muslim@10.56.3.3 'rm -f /tmp/check_nginx.sh'
