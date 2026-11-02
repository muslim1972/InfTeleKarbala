Add-Type -AssemblyName System.Drawing
$imgPath = "C:\Users\SAM-Tech\.gemini\antigravity\brain\bddbf4d0-6dde-488f-a41b-5425e2968c18\.user_uploaded\media_1793574943298_a7982a1c.png"
$src = [System.Drawing.Bitmap]::FromFile($imgPath)

# 1. Header logo: Full image
Copy-Item $imgPath "D:\InfTeleKarbala\public\itpc-official-header.png" -Force

# 2. Watermark logo: Crop y from 0 to 265
$cropRect = New-Object System.Drawing.Rectangle(0, 0, $src.Width, 265)
$cropped = New-Object System.Drawing.Bitmap(669, 265, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($cropped)
$g.DrawImage($src, 0, 0, $cropRect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()

# Now find horizontal bounding box
$minX = $cropped.Width
$maxX = 0
$minY = $cropped.Height
$maxY = 0

for ($y = 0; $y -lt $cropped.Height; $y++) {
    for ($x = 0; $x -lt $cropped.Width; $x++) {
        $p = $cropped.GetPixel($x, $y)
        if ($p.A -gt 20) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

Write-Output "Bounding box: X=$minX..$maxX (Width=$($maxX - $minX + 1)), Y=$minY..$maxY (Height=$($maxY - $minY + 1))"

$w = $maxX - $minX + 1
$h = $maxY - $minY + 1
$finalBmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g2 = [System.Drawing.Graphics]::FromImage($finalBmp)
$srcRect = New-Object System.Drawing.Rectangle($minX, $minY, $w, $h)
$g2.DrawImage($cropped, 0, 0, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
$g2.Dispose()

# Save full color cropped version
$finalBmp.Save("D:\InfTeleKarbala\public\itpc-watermark.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "Saved itpc-watermark.png"

$cropped.Dispose()
$finalBmp.Dispose()
$src.Dispose()
