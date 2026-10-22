param(
    [string]$ShFile
)
$ErrorActionPreference = 'Stop'
$pscp = 'C:\Program Files\PuTTY\pscp.exe'
$plink = 'C:\Program Files\PuTTY\plink.exe'
$pw = $env:VPS_PW
if (-not $pw) { $pw = [Environment]::GetEnvironmentVariable('VPS_PW','User') }
if (-not $pw) { throw 'VPS_PW not set' }

& $pscp -batch -pw $pw $ShFile "muslim@10.56.3.3:/tmp/remote_script.sh"
if ($LASTEXITCODE -ne 0) { throw 'pscp failed' }

& $plink -batch -pw $pw muslim@10.56.3.3 "sed -i 's/\r$//' /tmp/remote_script.sh && bash /tmp/remote_script.sh"
