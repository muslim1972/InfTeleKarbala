Add-Type -AssemblyName System.Drawing
$imgPath = "D:\InfTeleKarbala\public\itpc-official-header.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgPath)

Write-Output "Pixel at (10, 10): A=$($bmp.GetPixel(10, 10).A), R=$($bmp.GetPixel(10, 10).R), G=$($bmp.GetPixel(10, 10).G), B=$($bmp.GetPixel(10, 10).B)"

for ($y = 180; $y -lt $bmp.Height; $y += 2) {
    $visibleCount = 0
    for ($x = 0; $x -lt $bmp.Width; $x += 2) {
        $p = $bmp.GetPixel($x, $y)
        if ($p.A -gt 30) {
            $visibleCount++
        }
    }
    if ($visibleCount -eq 0 -or $visibleCount -gt 50 -or ($y % 10 -eq 0)) {
        Write-Output "y=$y visibleCount=$visibleCount"
    }
}
$bmp.Dispose()
