$pw = $env:VPS_PW
if (-not $pw) { $pw = [Environment]::GetEnvironmentVariable('VPS_PW', 'User') }
$pscp = 'C:\Program Files\PuTTY\pscp.exe'
$plink = 'C:\Program Files\PuTTY\plink.exe'
$host_ = 'muslim@10.56.3.3'

& $pscp -batch -pw $pw 'D:\InfTeleKarbala\supabase\migrations\20261124163000_itpc_payments_add_official_book_columns.sql' "${host_}:/tmp/"
& $pscp -batch -pw $pw 'D:\InfTeleKarbala\supabase\migrations\20261124163500_hr01_continuity_salary_toggle_and_print_org.sql' "${host_}:/tmp/"
& $pscp -batch -pw $pw 'D:\InfTeleKarbala\_archive\shell\apply_migrations.sh' "${host_}:/tmp/"

& $plink -batch -pw $pw $host_ 'sed -i s/\r$//g /tmp/apply_migrations.sh; bash /tmp/apply_migrations.sh'
