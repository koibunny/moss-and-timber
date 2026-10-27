@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js 20.19+ from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "dist\index.html" (
  echo Building the project for the first time...
  call npm install
  if errorlevel 1 goto :error
  call npm run build
  if errorlevel 1 goto :error
)

start "" /min cmd /c "node serve.mjs"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4173/"
exit /b 0

:error
echo.
echo Build failed. Please check the messages above.
pause
exit /b 1
