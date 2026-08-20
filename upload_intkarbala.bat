@echo off
set "PSCP_PATH=C:\Program Files\PuTTY\pscp.exe"
set "PASSWORD=mu@ITPC@2026"
set "HOST=10.56.3.3"
set "USER=muslim"
set "TARGET_DIR=/home/muslim/intkarbala/dist"

echo Uploading Int-Karbala dist to VPS...

"%PSCP_PATH%" -batch -pw "%PASSWORD%" -r D:\Int-Karbala\dist\* %USER%@%HOST%:%TARGET_DIR%/

echo Upload complete!
