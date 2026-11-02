Add-Type -AssemblyName System.Drawing
$imgPath = "C:\Users\SAM-Tech\.gemini\antigravity\brain\bddbf4d0-6dde-488f-a41b-5425e2968c18\.user_uploaded\media_1793574943298_a7982a1c.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgPath)
Write-Output "Width: $($bmp.Width), Height: $($bmp.Height)"

# Copy original to public as header logo
Copy-Item $imgPath "D:\InfTeleKarbala\public\itpc-official-header.png" -Force
Write-Output "Copied original to public\itpc-official-header.png"

# Crop the watermark: The letters 'itpc' with the green dot, excluding the bottom Arabic and English text
# Looking at the image, height is about 370-400, top part with 'itpc' is about 0 to 65% of the height
# Let's see dimensions first
$bmp.Dispose()
