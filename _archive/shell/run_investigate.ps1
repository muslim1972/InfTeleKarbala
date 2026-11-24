$pw = $env:VPS_PW
if (-not $pw) { $pw = [Environment]::GetEnvironmentVariable('VPS_PW', 'User') }
$pscp = 'C:\Program Files\PuTTY\pscp.exe'
$plink = 'C:\Program Files\PuTTY\plink.exe'
$host_ = 'muslim@10.56.3.3'

& $pscp -batch -pw $pw 'D:\InfTeleKarbala\_archive\shell\investigate_band.sh' "${host_}:/tmp/"
if ($LASTEXITCODE -ne 0) { throw 'Failed to upload investigate_band.sh' }

& $plink -batch -pw $pw $host_ 'sed -i s/\r$//g /tmp/investigate_band.sh; bash /tmp/investigate_band.sh'
