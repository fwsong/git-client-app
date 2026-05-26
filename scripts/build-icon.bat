@echo off
chcp 65001 >nul
cd /d "%~dp0\.."

if not exist "build\icon-source.png" (
    if exist "build\icon.png" (
        copy /Y "build\icon.png" "build\icon-source.png" >nul
    ) else (
        echo ERROR: Put source art at build\icon-source.png
        exit /b 1
    )
)

where magick >nul 2>&1
if errorlevel 1 (
    echo ERROR: ImageMagick ^(magick^) not found in PATH
    exit /b 1
)

echo [1/4] Crop logo region...
magick build\icon-source.png -gravity center -crop 1:1 +repage -fuzz 8%% -trim +repage build\icon-crop.png

echo [2/4] Remove white background ^(transparent corners^)...
magick build\icon-crop.png -alpha on -channel rgba -fuzz 16%% -transparent white -fuzz 10%% -transparent "#F5F5F5" +channel build\icon-nobg.png

echo [3/4] Fit to 1024x1024 with transparency...
magick build\icon-nobg.png -resize 1024x1024 -background none -gravity center -extent 1024x1024 build\icon.png

echo [4/4] Build multi-size icon.ico ^(32-bit alpha^)...
magick build\icon.png -define icon:auto-resize=256,128,64,48,32,16 build\icon.ico

del /q build\icon-crop.png build\icon-nobg.png 2>nul

echo Done: build\icon.png, build\icon.ico
magick identify build\icon.png build\icon.ico
