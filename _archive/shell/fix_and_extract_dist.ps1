$pw = $env:VPS_PW
if (-not $pw) { $pw = [Environment]::GetEnvironmentVariable('VPS_PW', 'User') }
$pscp = 'C:\Program Files\PuTTY\pscp.exe'
$plink = 'C:\Program Files\PuTTY\plink.exe'
$host_ = 'muslim@10.56.3.3'

$tarPath = "D:\Int-Karbala\dist_upload.tar.gz"
tar -czf $tarPath -C "D:\Int-Karbala\dist" .

& $pscp -batch -pw $pw $tarPath "${host_}:/tmp/intkarbala_dist.tar.gz"

& $plink -batch -pw $pw $host_ 'chmod -R u+w /home/muslim/intkarbala/dist && tar -xzf /tmp/intkarbala_dist.tar.gz -C /home/muslim/intkarbala/dist/ && rm /tmp/intkarbala_dist.tar.gz && chmod -R 755 /home/muslim/intkarbala/dist'

Remove-Item $tarPath -Force

Write-Host "Verify index.html in remote dist:"
& $plink -batch -pw $pw $host_ 'ls -l /home/muslim/intkarbala/dist/index.html'
