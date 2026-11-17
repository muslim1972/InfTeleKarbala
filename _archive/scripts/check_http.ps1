$pw = $env:VPS_PW
if (-not $pw) {
    $pw = [Environment]::GetEnvironmentVariable('VPS_PW', 'User')
}
& 'C:\Program Files\PuTTY\plink.exe' -batch -pw $pw muslim@10.56.3.3 'curl -s -I http://127.0.0.1/ | head -n 5'
