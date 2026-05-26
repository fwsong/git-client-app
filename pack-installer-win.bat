@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if exist "%ProgramFiles%\nodejs\" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%LocalAppData%\Programs\node\" set "PATH=%LocalAppData%\Programs\node;%PATH%"

echo ====================================
echo   GitX - Windows Installer Build
echo ====================================
echo.

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found.
    echo Please install Node.js: https://nodejs.org/
    echo Or open this folder in terminal and run: npm run dist:win
    echo.
    pause
    exit /b 1
)

taskkill /F /IM GitX.exe >nul 2>&1
taskkill /F /IM electron.exe >nul 2>&1

if not exist "node_modules\electron-builder\" (
    echo Installing dependencies...
    call npm.cmd install
    if errorlevel 1 (
        echo npm install failed.
        pause
        exit /b 1
    )
)

set CSC_IDENTITY_AUTO_DISCOVERY=false
echo Building NSIS installer...
call npm.cmd run dist:win
if errorlevel 1 (
    echo.
    echo [FAILED] See errors above.
    echo Tips: close GitX.exe, delete dist folder, try again.
    echo.
    pause
    exit /b 1
)

echo.
echo ====================================
echo [OK] Installer output:
echo   %CD%\dist\
echo   GitX Setup *.exe
echo ====================================
if exist "dist\" start "" explorer "dist"
echo.
pause
endlocal
