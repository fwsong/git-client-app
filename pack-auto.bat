@echo off
chcp 65001 >nul
cls
echo ====================================
echo   GitX - Auto Pack
echo ====================================
echo.

cd /d "%~dp0"

echo [1/9] Checking dependencies...
if not exist "node_modules\electron\dist\electron.exe" (
    echo ERROR: electron not found
    echo Please run: npm install
    timeout /t 5
    exit /b 1
)
if not exist "build\icon.ico" (
    echo ERROR: build\icon.ico not found
    timeout /t 5
    exit /b 1
)
echo Regenerating icons...
call scripts\build-icon.bat
if errorlevel 1 (
    timeout /t 5
    exit /b 1
)

echo [2/9] Killing processes...
taskkill /F /IM GitX.exe >nul 2>&1
taskkill /F /IM electron.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [3/9] Removing old folder...
if exist portable rd /s /q portable
timeout /t 1 /nobreak >nul

echo [4/9] Creating directories...
mkdir portable
mkdir portable\GitX
mkdir portable\GitX\resources
mkdir portable\GitX\resources\app
mkdir portable\GitX\resources\app\node_modules

echo [5/9] Copying Electron runtime (may take 30 seconds)...
xcopy /E /I /Y /Q node_modules\electron\dist\* portable\GitX\

echo [6/9] Applying GitX icon...
attrib -R "portable\GitX\electron.exe" >nul 2>&1
taskkill /F /IM GitX.exe >nul 2>&1
taskkill /F /IM electron.exe >nul 2>&1
timeout /t 1 /nobreak >nul
node scripts\patch-portable-icon.mjs portable\GitX\electron.exe
if errorlevel 1 (
    echo ERROR: Failed to apply icon. Close portable\GitX in Explorer and retry.
    timeout /t 8
    exit /b 1
)

echo [7/9] Copying app files...
copy /Y main.js portable\GitX\resources\app\
copy /Y preload.js portable\GitX\resources\app\
copy /Y index.html portable\GitX\resources\app\
copy /Y style.css portable\GitX\resources\app\
copy /Y renderer.js portable\GitX\resources\app\
copy /Y package.json portable\GitX\resources\app\
xcopy /E /I /Y /Q build portable\GitX\resources\app\build\

echo [8/9] Copying dependencies...
xcopy /E /I /Y /Q node_modules\simple-git portable\GitX\resources\app\node_modules\simple-git\
xcopy /E /I /Y /Q node_modules\@simple-git portable\GitX\resources\app\node_modules\@simple-git\
xcopy /E /I /Y /Q node_modules\@kwsites portable\GitX\resources\app\node_modules\@kwsites\
xcopy /E /I /Y /Q node_modules\debug portable\GitX\resources\app\node_modules\debug\
xcopy /E /I /Y /Q node_modules\ms portable\GitX\resources\app\node_modules\ms\

echo [9/9] Renaming...
cd portable\GitX
if exist GitX.exe del /f /q GitX.exe
ren electron.exe GitX.exe
cd ..\..

echo.
echo ====================================
echo Verifying...

if not exist portable\GitX\GitX.exe (
    echo ERROR: GitX.exe not found!
    timeout /t 5
    exit /b 1
)

if not exist portable\GitX\resources\app\main.js (
    echo ERROR: main.js not found!
    echo App files were not copied correctly
    timeout /t 5
    exit /b 1
)

if not exist portable\GitX\resources\app\node_modules\simple-git (
    echo ERROR: simple-git not found!
    echo Dependencies were not copied correctly
    timeout /t 5
    exit /b 1
)

if not exist portable\GitX\resources\app\node_modules\@simple-git (
    echo ERROR: @simple-git not found!
    echo Dependencies were not copied correctly
    timeout /t 5
    exit /b 1
)

echo SUCCESS!
echo.
echo Location: %CD%\portable\GitX\
echo Size: ~250 MB
echo.
echo You can now run: GitX.exe
echo.
start explorer portable\GitX
echo ====================================
echo.
timeout /t 3
