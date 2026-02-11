
@echo off
echo Starting Information & Telecommunications Data Import...
echo -------------------------------------------------------
echo.

cd /d "%~dp0"
echo Installing dependencies...
call npm install

echo.
echo Running Import Script...
node scripts/import_data.js

echo.
echo -------------------------------------------------------
echo Done.
pause
