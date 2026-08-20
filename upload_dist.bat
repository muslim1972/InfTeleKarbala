@echo off
echo Uploading index.html and assets to VPS...
"C:\Program Files\PuTTY\pscp.exe" -batch -pw "mu@ITPC@2026" "D:\InfTeleKarbala\dist\index.html" muslim@10.56.3.3:/home/muslim/inftelekarbala/dist/index.html
"C:\Program Files\PuTTY\pscp.exe" -batch -pw "mu@ITPC@2026" -r "D:\InfTeleKarbala\dist\assets\*" muslim@10.56.3.3:/home/muslim/inftelekarbala/dist/assets/
echo Upload complete!
