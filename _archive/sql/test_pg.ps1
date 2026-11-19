$pw = $env:VPS_PW; if (-not $pw) { $pw = [Environment]::GetEnvironmentVariable('VPS_PW','User') }
& 'C:\Program Files\PuTTY\pscp.exe' -batch -pw $pw 'D:\InfTeleKarbala\_archive\sql\test_postgrest.sh' muslim@10.56.3.3:/tmp/test_pg.sh
& 'C:\Program Files\PuTTY\plink.exe' -batch -pw $pw muslim@10.56.3.3 'bash /tmp/test_pg.sh'
