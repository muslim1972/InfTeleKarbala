Add-Type -AssemblyName System.Drawing
$files = @('WhatsApp Image 2026-09-25 at 10.51.22 PM.jpeg','WhatsApp Image 2026-09-25 at 10.52.50 PM.jpeg')
foreach ($f in $files) {
    $path = Join-Path 'D:\jumla\tmp' $f
    $src = [System.Drawing.Image]::FromFile($path)
    $w = [int]($src.Width * 0.42)
    $h = [int]($src.height * 0.42)
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($src, 0, 0, $w, $h)
    $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 50)
    $out = Join-Path 'D:\jumla\tmp' ('small_' + $f)
    $bmp.Save($out, $enc, $ep)
    $g.Dispose(); $bmp.Dispose(); $src.Dispose()
    Write-Output ('Saved: ' + $out)
}