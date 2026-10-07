@echo off
chcp 65001 > nul
cd /d "%~dp0"
title Cesium BPO Viewer - Startup

echo ========================================
echo Cesium BPO Viewer Startup
echo ========================================
echo Folder: %CD%
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo Install Node.js and restart Windows.
  goto end
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm was not found.
  goto end
)

echo Node version:
node -v
echo npm version:
call npm -v
echo.

if not exist "package.json" (
  echo [ERROR] package.json is missing from this folder.
  goto end
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo Electron binary is missing. Running npm install...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    goto end
  )
)

echo Starting Electron...
call npx electron .
if errorlevel 1 (
  echo.
  echo [ERROR] Electron exited with an error.
  echo Run diagnostic_start.bat and review startup-log.txt.
)

:end
echo.
echo Press any key to close this window.
pause >nul
