$pscp = 'C:\Program Files\PuTTY\pscp.exe'
$plink = 'C:\Program Files\PuTTY\plink.exe'
$pw = 'mu@ITPC@2026'
$host_ = 'muslim@10.56.3.3'

& $pscp -batch -pw $pw query_notes.sql "${host_}:/tmp/query_notes.sql"
& $plink -batch -pw $pw $host_ 'psql -U postgres -d postgres -f /tmp/query_notes.sql'
