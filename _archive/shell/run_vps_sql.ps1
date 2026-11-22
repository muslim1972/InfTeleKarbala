param([string]$SqlFile)
$pw = $env:VPS_PW
if (-not $pw) {
    $pw = [Environment]::GetEnvironmentVariable('VPS_PW', 'User')
}
$dest = "/tmp/" + [System.IO.Path]::GetFileName($SqlFile)
& 'C:\Program Files\PuTTY\pscp.exe' -batch -pw $pw $SqlFile "muslim@10.56.3.3:$dest"
& 'C:\Program Files\PuTTY\plink.exe' -batch -pw $pw muslim@10.56.3.3 "cat $dest | docker exec -i supabase-db psql -U postgres -d postgres"
