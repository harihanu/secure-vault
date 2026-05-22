@echo off
title Secure Vault - Setup
color 0A

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║           SECURE VAULT - QUICK SETUP                    ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

:: Check if Node.js is installed
echo [1/4] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: Node.js is not installed!
    echo.
    echo  Please install Node.js from: https://nodejs.org
    echo  Download the LTS version and run this script again.
    echo.
    echo  Press any key to exit...
    pause >nul
    exit /b 1
)
echo       Node.js found:
node --version
echo.

:: Check if npm is available
echo [2/4] Checking npm...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: npm is not available!
    echo.
    echo  Please reinstall Node.js from: https://nodejs.org
    echo.
    echo  Press any key to exit...
    pause >nul
    exit /b 1
)
echo       npm found:
npm --version
echo.

:: Install live-server if not present
echo [3/4] Checking live-server...
where live-server >nul 2>&1
if %errorlevel% neq 0 (
    echo       Installing live-server...
    call npm install -g live-server
    if %errorlevel% neq 0 (
        echo.
        echo  ERROR: Failed to install live-server!
        echo  Try running this script as Administrator.
        echo.
        echo  Press any key to exit...
        pause >nul
        exit /b 1
    )
    echo       live-server installed successfully!
) else (
    echo       live-server found!
)
echo.

:: Start the server
echo [4/4] Starting Secure Vault server...
echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║  SERVER STARTING...                                     ║
echo  ║                                                         ║
echo  ║  Open your browser to:                                  ║
echo  ║  http://localhost:2134                                  ║
echo  ║                                                         ║
echo  ║  Press Ctrl+C to stop the server                        ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

start http://localhost:2134
call live-server --port=2134
