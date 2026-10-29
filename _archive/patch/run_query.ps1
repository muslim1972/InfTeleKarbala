$pw = [Environment]::GetEnvironmentVariable('VPS_PW', 'User')
if (-not $pw) { $pw = $env:VPS_PW }
& 'C:\Program Files\PuTTY\pscp.exe' -batch -pw $pw d:\InfTeleKarbala\_archive\patch\update_tajreebi.sh muslim@10.56.3.3:/tmp/update_tajreebi.sh
& 'C:\Program Files\PuTTY\plink.exe' -batch -pw $pw muslim@10.56.3.3 'bash /tmp/update_tajreebi.sh'
