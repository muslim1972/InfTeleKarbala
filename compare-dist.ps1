# مقارنة dist المحلي مع dist على VPS — يحدد الملفات الجديدة/المتغيرة لرفعها فقط
$ErrorActionPreference = 'Stop'
$localDir = 'D:\InfTeleKarbala\dist'
$remoteBase = '/home/muslim/inftelekarbala/dist'
$plink = 'C:\Program Files\PuTTY\plink.exe'
$pw = 'mu@ITPC@2026'
$host_ = 'muslim@10.56.3.3'

# قائمة بعيدة: assets + index.html (الاسم فقط)
$remote = & $plink -batch -pw $pw $host_ "ls -1 $remoteBase/assets/; ls -1 $remoteBase/*.html $remoteBase/*.txt $remoteBase/*.ico $remoteBase/*.webmanifest 2>/dev/null | xargs -n1 basename 2>/dev/null" |
    Where-Object { $_.Trim() -ne '' }
$remoteSet = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($r in $remote) { [void]$remoteSet.Add($r.Trim()) }

# قائمة محلية
$localFiles = Get-ChildItem -Path $localDir -Recurse -File |
    Where-Object { $_.FullName -notmatch '\\assets\\(media|gis-samples)\\' -and $_.Name -ne 'robots.txt' } |
    ForEach-Object {
        $rel = $_.FullName.Substring($localDir.Length).TrimStart('\').Replace('\', '/')
        [pscustomobject]@{ Rel = $rel; Name = $_.Name; Len = $_.Length }
    }

# جلب الأحجام البعيدة للملفات المشتركة لمقارنة الحجم (كشف اختلاف محتمل بنفس الاسم — غير متوقع للأصول المجزّأة)
$remoteSizes = @{}
$remoteList = ($localFiles | ForEach-Object { $_.Name }) -join '`n'
$sizeOut = $remoteList | & $plink -batch -pw $pw $host_ "while IFS= read -r f; do if [ -f ""$remoteBase/assets/\$f"" ]; then stat -c '%s' ""$remoteBase/assets/\$f""; elif [ -f ""$remoteBase/\$f"" ]; then stat -c '%s' ""$remoteBase/\$f""; else echo -1; fi; done"
$i = 0
foreach ($f in $localFiles) {
    if ($i -lt $sizeOut.Count) { $remoteSizes[$f.Name] = [long]$sizeOut[$i] }
    $i++
}

$toUpload = @()
foreach ($f in $localFiles) {
    if (-not $remoteSet.Contains($f.Name)) {
        $toUpload += [pscustomobject]@{ Name = $f.Name; Reason = 'جديد'; Len = $f.Len; Rel = $f.Rel }
    } elseif ($remoteSizes[$f.Name] -ne $f.Len) {
        $toUpload += [pscustomobject]@{ Name = $f.Name; Reason = 'مختلف الحجم'; Len = $f.Len; Rel = $f.Rel }
    }
}

# ملفات على VPS وغير موجودة محلياً (أصول عالقة من بنوات سابقة)
$stale = $remote | Where-Object { -not ($localFiles.Name -contains $_.Trim()) }

Write-Host "=== ملفات للرفع: $($toUpload.Count) ===" -ForegroundColor Cyan
$toUpload | Sort-Object Reason, Name | Format-Table Name, Reason, Len -AutoSize
Write-Host ""
Write-Host "=== أصول بعيدة عالقة (غير موجودة محلياً): $($stale.Count) ===" -ForegroundColor DarkYellow
$stale | Select-Object -First 40

# تصدير قائمة الرفع لاستخدامها في سكربت النشر
$toUpload | Select-Object Rel | ConvertTo-Json -Depth 2 | Set-Content -Path 'D:\InfTeleKarbala\dist-upload-list.json' -Encoding UTF8
Write-Host ""
Write-Host "تم تصدير القائمة إلى dist-upload-list.json" -ForegroundColor Green
