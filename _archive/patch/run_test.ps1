$pw = [Environment]::GetEnvironmentVariable('VPS_PW', 'User')
if (-not $pw) { $pw = $env:VPS_PW }
& 'C:\Program Files\PuTTY\pscp.exe' -batch -pw $pw d:\InfTeleKarbala\_archive\patch\test_verify.sh muslim@10.56.3.3:/tmp/test_verify.sh
& 'C:\Program Files\PuTTY\plink.exe' -batch -pw $pw muslim@10.56.3.3 'bash /tmp/test_verify.sh'
