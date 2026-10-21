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
