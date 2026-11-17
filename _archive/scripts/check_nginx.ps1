$pw = $env:VPS_PW
if (-not $pw) {
    $pw = [Environment]::GetEnvironmentVariable('VPS_PW', 'User')
}
& 'C:\Program Files\PuTTY\plink.exe' -batch -pw $pw muslim@10.56.3.3 'echo "$VPS_PW" | sudo -S grep -rn "add_header" /etc/nginx/ 2>&1 | grep -v "^\[sudo\]"'
