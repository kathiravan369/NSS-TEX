@echo off
title NSS-TEX ERP Desktop Launcher
cd /d "%~dp0"

echo ========================================================
echo   Launching NSS-TEX ERP Manufacturing Desktop App...
echo ========================================================
echo.

:: Ensure dependencies are present
if not exist "node_modules" (
  echo [Info] Installing required dependencies...
  call npm install
)

:: Ensure custom app icon is configured
if not exist "%~dp0design-assets\NSS-TEX-Logo.jpg" (
  echo [Info] Configuring NSS-TEX ERP logo and desktop shortcut icon...
  powershell -NoProfile -ExecutionPolicy Unrestricted -File "%~dp0scripts\generateAppIcons.ps1" >nul 2>&1
)

:: Ensure production UI build is ready
if not exist "dist\index.html" (
  echo [Info] Building frontend user interface...
  call npm run build
)

:: Start the application
echo [Info] Starting NSS-TEX ERP Desktop Application...
call npm start

if %ERRORLEVEL% NEQ 0 (
  echo.
  echo [Notice] The application has closed or encountered an exit code: %ERRORLEVEL%
  pause
)
