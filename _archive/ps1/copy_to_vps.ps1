param(
    [string]$LocalFile,
    [string]$RemoteDest
)
$ErrorActionPreference = 'Stop'
$pscp = 'C:\Program Files\PuTTY\pscp.exe'
$pw = $env:VPS_PW
if (-not $pw) { $pw = [Environment]::GetEnvironmentVariable('VPS_PW','User') }
if (-not $pw) { throw 'VPS_PW not set' }

& $pscp -batch -pw $pw $LocalFile "muslim@10.56.3.3:$RemoteDest"
