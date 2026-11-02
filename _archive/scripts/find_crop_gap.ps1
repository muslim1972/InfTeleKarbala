Add-Type -AssemblyName System.Drawing
$imgPath = "D:\InfTeleKarbala\public\itpc-official-header.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgPath)

# Scan each row from y=200 down to 372 to find white space gap between 'itpc' and Arabic text
for ($y = 220; $y -lt $bmp.Height; $y += 5) {
    $nonWhite = 0
    for ($x = 0; $x -lt $bmp.Width; $x += 5) {
        $pixel = $bmp.GetPixel($x, $y)
        # check if not pure white/near white
        if ($pixel.R -lt 240 -or $pixel.G -lt 240 -or $pixel.B -lt 240) {
            $nonWhite++
        }
    }
    Write-Output "y=$y nonWhite=$nonWhite"
}
$bmp.Dispose()
