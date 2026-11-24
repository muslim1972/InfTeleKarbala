$pw = $env:VPS_PW
if (-not $pw) { $pw = [Environment]::GetEnvironmentVariable('VPS_PW', 'User') }
$pscp = 'C:\Program Files\PuTTY\pscp.exe'
$plink = 'C:\Program Files\PuTTY\plink.exe'
$host_ = 'muslim@10.56.3.3'

Write-Host "1. Zipping D:\Int-Karbala\dist..."
$tarPath = "D:\Int-Karbala\dist_upload.tar.gz"
tar -czf $tarPath -C "D:\Int-Karbala\dist" .

Write-Host "2. Uploading archive to VPS /tmp..."
& $pscp -batch -pw $pw $tarPath "${host_}:/tmp/intkarbala_dist.tar.gz"
if ($LASTEXITCODE -ne 0) { throw 'Upload failed' }

Write-Host "3. Extracting to /home/muslim/intkarbala/dist on VPS..."
& $plink -batch -pw $pw $host_ 'mkdir -p /home/muslim/intkarbala/dist && tar -xzf /tmp/intkarbala_dist.tar.gz -C /home/muslim/intkarbala/dist/ && rm /tmp/intkarbala_dist.tar.gz && chmod -R 755 /home/muslim/intkarbala/dist'
if ($LASTEXITCODE -ne 0) { throw 'Extraction failed' }

Write-Host "4. Cleaning local temp archive..."
Remove-Item $tarPath -Force

Write-Host "Done deploying intkarbala dist!"
