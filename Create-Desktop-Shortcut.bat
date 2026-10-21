@echo off
title NSS-TEX ERP - Create Desktop Shortcut
cd /d "%~dp0"

echo Creating/Updating NSS-TEX ERP desktop shortcut with custom logo...
powershell -NoProfile -ExecutionPolicy Unrestricted -File "%~dp0scripts\createDesktopShortcut.ps1"

echo.
pause
