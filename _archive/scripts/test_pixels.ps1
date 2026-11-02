Add-Type -AssemblyName System.Drawing
$imgPath = "D:\InfTeleKarbala\public\itpc-official-header.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgPath)

Write-Output "Pixel at (10, 10): R=$($bmp.GetPixel(10, 10).R), G=$($bmp.GetPixel(10, 10).G), B=$($bmp.GetPixel(10, 10).B)"
Write-Output "Pixel at (10, 250): R=$($bmp.GetPixel(10, 250).R), G=$($bmp.GetPixel(10, 250).G), B=$($bmp.GetPixel(10, 250).B)"
Write-Output "Pixel at (334, 150): R=$($bmp.GetPixel(334, 150).R), G=$($bmp.GetPixel(334, 150).G), B=$($bmp.GetPixel(334, 150).B)"
Write-Output "Pixel at (334, 270): R=$($bmp.GetPixel(334, 270).R), G=$($bmp.GetPixel(334, 270).G), B=$($bmp.GetPixel(334, 270).B)"

$bmp.Dispose()
