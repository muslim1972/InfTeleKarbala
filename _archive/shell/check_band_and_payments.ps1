$pw = $env:VPS_PW
if (-not $pw) { $pw = [Environment]::GetEnvironmentVariable('VPS_PW', 'User') }
$plink = 'C:\Program Files\PuTTY\plink.exe'
$host_ = 'muslim@10.56.3.3'

Write-Host "=== 1. Checking Nginx configs for /band ==="
& $plink -batch -pw $pw $host_ 'grep -rn "band" /etc/nginx/'

Write-Host "`n=== 2. Checking home directory for band ==="
& $plink -batch -pw $pw $host_ 'ls -ld /var/www/* /home/muslim/* 2>/dev/null'

Write-Host "`n=== 3. Checking payments table structure in DB ==="
& $plink -batch -pw $pw $host_ "docker exec -i `$(docker ps -q -f name=db) psql -U postgres -d postgres -c '\d payments' 2>/dev/null || psql -U postgres -d postgres -c '\d payments' 2>/dev/null"

Write-Host "`n=== 4. Checking all tables matching *payment* ==="
& $plink -batch -pw $pw $host_ "docker exec -i `$(docker ps -q -f name=db) psql -U postgres -d postgres -c ""SELECT table_schema, table_name, column_name, data_type FROM information_schema.columns WHERE table_name LIKE '%payment%' ORDER BY table_name, ordinal_position;"" 2>/dev/null"
