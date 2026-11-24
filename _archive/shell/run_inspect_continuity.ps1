$pw = $env:VPS_PW
if (-not $pw) { $pw = [Environment]::GetEnvironmentVariable('VPS_PW', 'User') }
$pscp = 'C:\Program Files\PuTTY\pscp.exe'
$plink = 'C:\Program Files\PuTTY\plink.exe'
$host_ = 'muslim@10.56.3.3'

& $pscp -batch -pw $pw 'D:\InfTeleKarbala\_archive\shell\inspect_continuity_rpc.sh' "${host_}:/tmp/"
& $plink -batch -pw $pw $host_ 'sed -i s/\r$//g /tmp/inspect_continuity_rpc.sh; bash /tmp/inspect_continuity_rpc.sh'
