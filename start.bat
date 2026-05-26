@echo off
chcp 65001 >nul
echo ====================================
echo   GitX - Starting...
echo ====================================
echo.
cd /d "%~dp0"
call npm start
