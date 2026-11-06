param([string]$SqlFile, [string]$OutputFile)
$ErrorActionPreference = 'Stop'
$pw = $env:VPS_PW
if (-not $pw) { $pw = [Environment]::GetEnvironmentVariable('VPS_PW', 'User') }
& 'C:\Program Files\PuTTY\pscp.exe' -batch -pw $pw $SqlFile muslim@10.56.3.3:/tmp/export_query.sql
$json = & 'C:\Program Files\PuTTY\plink.exe' -batch -pw $pw muslim@10.56.3.3 'docker exec -i supabase-db psql -U supabase_admin -d postgres -t -A < /tmp/export_query.sql'
[System.IO.File]::WriteAllText($OutputFile, $json, [System.Text.Encoding]::UTF8)
Write-Host "Exported to $OutputFile successfully"
