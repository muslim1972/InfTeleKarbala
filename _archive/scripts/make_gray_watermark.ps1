Add-Type -AssemblyName System.Drawing

$srcPath = "D:\InfTeleKarbala\public\itpc-watermark.png"
$bmp = [System.Drawing.Bitmap]::FromFile($srcPath)
$newBmp = New-Object System.Drawing.Bitmap($bmp.Width, $bmp.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        $p = $bmp.GetPixel($x, $y)
        if ($p.A -gt 10) {
            # Check if this pixel is the green dot (G > R and G > B)
            if ($p.G -gt ($p.R + 30) -and $p.G -gt ($p.B + 30)) {
                # Green dot: keep it green, but adjust brightness/alpha if needed
                # Soft green: R=100, G=190, B=100 with same alpha
                $newColor = [System.Drawing.Color]::FromArgb($p.A, 76, 175, 80)
            } else {
                # Navy/dark letters: convert to elegant light gray
                # Light slate gray: R=185, G=190, B=200
                $newColor = [System.Drawing.Color]::FromArgb($p.A, 185, 190, 200)
            }
            $newBmp.SetPixel($x, $y, $newColor)
        } else {
            $newBmp.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
        }
    }
}

$bmp.Dispose()
$newBmp.Save("D:\InfTeleKarbala\public\itpc-watermark-gray.png", [System.Drawing.Imaging.ImageFormat]::Png)
$newBmp.Dispose()

Write-Output "Successfully generated itpc-watermark-gray.png"
