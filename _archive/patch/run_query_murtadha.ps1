$pw = [Environment]::GetEnvironmentVariable('VPS_PW', 'User')
if (-not $pw) { $pw = $env:VPS_PW }
& 'C:\Program Files\PuTTY\pscp.exe' -batch -pw $pw d:\InfTeleKarbala\_archive\patch\query_murtadha.sh muslim@10.56.3.3:/tmp/query_murtadha.sh
& 'C:\Program Files\PuTTY\plink.exe' -batch -pw $pw muslim@10.56.3.3 'bash /tmp/query_murtadha.sh'
