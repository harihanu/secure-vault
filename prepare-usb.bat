@echo off
title Secure Vault - USB Preparation
color 0B

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║        SECURE VAULT - USB DRIVE PREPARATION             ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

:: Get USB drive letter
set /p USB_DRIVE="Enter USB drive letter (e.g., E, F, G): "
if "%USB_DRIVE%"=="" (
    echo  ERROR: No drive letter entered!
    echo.
    echo  Press any key to exit...
    pause >nul
    exit /b 1
)

:: Check if drive exists
if not exist "%USB_DRIVE%:\" (
    echo  ERROR: Drive %USB_DRIVE%:\ not found!
    echo.
    echo  Press any key to exit...
    pause >nul
    exit /b 1
)

:: Create folder
echo.
echo [1/4] Creating SecureVault folder...
if not exist "%USB_DRIVE%:\SecureVault" mkdir "%USB_DRIVE%:\SecureVault"
echo       Created: %USB_DRIVE%:\SecureVault

:: Copy project files
echo.
echo [2/4] Copying vault files...
xcopy /E /I /Y "index.html" "%USB_DRIVE%:\SecureVault\" >nul
xcopy /E /I /Y "scripts" "%USB_DRIVE%:\SecureVault\scripts\" >nul
xcopy /E /I /Y "styles" "%USB_DRIVE%:\SecureVault\styles\" >nul
xcopy /E /I /Y "workers" "%USB_DRIVE%:\SecureVault\workers\" >nul
xcopy /E /I /Y "assets" "%USB_DRIVE%:\SecureVault\assets\" >nul
echo       Copied: index.html, scripts, styles, workers, assets

:: Copy setup scripts
echo.
echo [3/4] Copying setup scripts...
copy /Y "start-vault.bat" "%USB_DRIVE%:\SecureVault\" >nul
copy /Y "start-vault.sh" "%USB_DRIVE%:\SecureVault\" >nul
copy /Y "USB-SETUP.md" "%USB_DRIVE%:\SecureVault\" >nul
echo       Copied: start-vault.bat, start-vault.sh, USB-SETUP.md

:: Create backup folder
echo.
echo [4/4] Creating backup folder...
if not exist "%USB_DRIVE%:\SecureVault\backups" mkdir "%USB_DRIVE%:\SecureVault\backups"
echo       Created: backups folder

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║  USB DRIVE PREPARED SUCCESSFULLY!                       ║
echo  ║                                                         ║
echo  ║  Next steps:                                            ║
echo  ║  1. Export your vault from Settings → Export             ║
echo  ║  2. Save vault-backup.vault to USB:\SecureVault\backups\ ║
echo  ║  3. Use start-vault.bat on any Windows PC               ║
echo  ║  4. Use start-vault.sh on Mac/Linux                     ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

:: Open the USB folder
explorer "%USB_DRIVE%:\SecureVault"

echo  Press any key to exit...
pause >nul
