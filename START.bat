@echo off
TITLE Om Sai Murugan Finance - Startup
color 0A

echo.
echo ==========================================
echo   OM SAI MURUGAN FINANCE
echo   Starting Application...
echo ==========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

echo [1/4] Checking Node.js version...
node --version
echo.

echo [2/4] Starting Backend Server...
start "Finance Backend" cmd /k "cd server && npm run dev"
timeout /t 3 /nobreak >nul

echo [3/4] Starting Frontend Client...
start "Finance Frontend" cmd /k "cd client && npm run dev"
timeout /t 2 /nobreak >nul

echo.
echo ==========================================
echo   APPLICATION STARTED!
echo ==========================================
echo.
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:5173
echo.
echo Login Password: santhosh123
echo.
echo Dashboard Image: Scroll down on Dashboard page
echo.
echo Press any key to open browser...
pause >nul

REM Open browser
start http://localhost:5173

echo.
echo To stop the application:
echo - Close both terminal windows
echo - Or press Ctrl+C in each window
echo.
pause
