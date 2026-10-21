@echo off
title NSS-TEX ERP - Apply Logo and Fix Desktop Icon
cd /d "%~dp0"

echo ========================================================
echo   NSS-TEX ERP - Applying Logo and Fixing Desktop Icon
echo ========================================================
echo.
echo [1/3] Generating high-resolution app icons (PNG and multi-size ICO)...
echo [2/3] Updating Electron assets, public web assets, and installed app folder...
echo [3/3] Setting icon on Desktop shortcut and refreshing Windows Shell...
echo.

powershell -NoProfile -ExecutionPolicy Unrestricted -File "%~dp0scripts\generateAppIcons.ps1"

echo.
echo [Optional] Rebuilding frontend UI bundle with new logo...
call npm run build

echo.
echo ========================================================
echo   Done! Your NSS-TEX ERP logo has been applied to:
echo     1. Desktop and Start Menu shortcuts
echo     2. App Window Titlebar Icon
echo     3. In-app Sidebar and Invoice Logo
echo ========================================================
echo.
pause
