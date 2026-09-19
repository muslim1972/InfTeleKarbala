# ============================================================
# نشر dist إلى VPS — مقارنة MD5 ثم رفع المتغيّرات فقط ثم تحقق
# الاستخدام: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\deploy-dist.ps1
# المتطلبات: PuTTY (plink/pscp) + بناء محلي طازج في dist/
# ملاحظة: الـ chunks القديمة تبقى على VPS لتوافق كاش المستخدمين
# ============================================================
$ErrorActionPreference = 'Stop'
$pscp = 'C:\Program Files\PuTTY\pscp.exe'
$plink = 'C:\Program Files\PuTTY\plink.exe'
$pw = 'mu@ITPC@2026'
$host_ = 'muslim@10.56.3.3'
$localDist = 'D:\InfTeleKarbala\dist'
$root = 'D:\InfTeleKarbala'
$remoteBase = '/home/muslim/inftelekarbala/dist'
# الملفات المولَّدة تُكتب في مجلد مؤقت — لا مخلفات في scripts/
$tmp = Join-Path $env:TEMP 'ftth-deploy'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$md5List = Join-Path $tmp 'dist-local-md5.txt'
$cmpLocal = Join-Path $tmp 'dist-cmp-local.txt'

# 1) قائمة MD5 المحلية (UTF-8 بلا BOM — أسماء عربية)
$files = Get-ChildItem $localDist -Recurse -File |
    Where-Object { $_.FullName -notmatch '\\assets\\(media|gis-samples)\\' }
$lines = $files | ForEach-Object {
    $rel = $_.FullName.Substring($localDist.Length).Replace('\', '/')
    $h = (Get-FileHash $_.FullName -Algorithm MD5).Hash.ToLower()
    "$h $rel"
}
[System.IO.File]::WriteAllLines(
    $md5List, $lines,
    [System.Text.UTF8Encoding]::new($false))
Write-Host "محلياً: $($lines.Count) ملف"

# 2) رفع الأدوات وتشغيل المقارنة على VPS
& $pscp -batch -pw $pw $md5List "$root\scripts\dist-cmp-remote.sh" muslim@10.56.3.3:/tmp/ | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'فشل رفع أدوات المقارنة' }
& $plink -batch -pw $pw $host_ 'sed -i s/\r$//g /tmp/dist-cmp-remote.sh; bash /tmp/dist-cmp-remote.sh'
if ($LASTEXITCODE -ne 0) { throw 'فشلت المقارنة البعيدة' }

# 3) جلب النتيجة ورفع DIFF/MISSING فقط
& $plink -batch -pw $pw $host_ 'cat /tmp/dist-cmp.txt' |
    Out-File $cmpLocal -Encoding utf8
$toUpload = Get-Content $cmpLocal |
    Where-Object { $_ -match '^(DIFF|MISSING) (.+)$' } |
    ForEach-Object { $Matches[2].Trim() }
Write-Host "للرفع: $($toUpload.Count) ملف"

$failed = @()
$i = 0
foreach ($rel in $toUpload) {
    $i++
    $localPath = Join-Path $localDist ($rel.Replace('/', '\'))
    $remotePath = "$remoteBase$rel"
    & $plink -batch -pw $pw $host_ "mkdir -p $(Split-Path $remotePath -Parent)" | Out-Null
    & $pscp -batch -pw $pw $localPath "${host_}:$remotePath" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { $failed += $rel; Write-Host "فشل: $rel" -ForegroundColor Red }
    else { Write-Host "[$i/$($toUpload.Count)] $rel" -ForegroundColor Green }
}
if ($failed.Count -gt 0) { throw "فشل رفع $($failed.Count) ملف" }

# 4) تحقق نهائي: إعادة المقارنة — يجب SAME=الكل
Write-Host "`n=== التحقق النهائي ===" -ForegroundColor Cyan
& $plink -batch -pw $pw $host_ 'bash /tmp/dist-cmp-remote.sh'
