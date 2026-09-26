$pscp = 'C:\Program Files\PuTTY\pscp.exe'
$plink = 'C:\Program Files\PuTTY\plink.exe'
$pw = 'mu@ITPC@2026'
$host_ = 'muslim@10.56.3.3'
$script = 'D:\InfTeleKarbala\scripts\test_vps_sql.sh'

& $pscp -batch -pw $pw $script "${host_}:/tmp/test_vps_sql.sh"
& $plink -batch -pw $pw $host_ 'sed -i s/\r$//g /tmp/test_vps_sql.sh; bash /tmp/test_vps_sql.sh'
