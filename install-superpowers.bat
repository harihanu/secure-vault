@echo off
REM =============================================
REM  Superpowers Plugin Installer for OpenClaude
REM  Version: 5.1.0
REM  Source: https://github.com/obra/superpowers
REM =============================================

echo.
echo ========================================
echo  Superpowers Plugin Installer
echo ========================================
echo.

REM Check if git is installed
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Git is not installed. Please install Git first.
    echo Download from: https://git-scm.com/download/win
    pause
    exit /b 1
)

REM Check if OpenClaude plugins directory exists
set "PLUGIN_DIR=%USERPROFILE%\.openclaude\plugins\marketplaces\claude-plugins-official\plugins\superpowers"

if not exist "%USERPROFILE%\.openclaude\plugins\marketplaces\claude-plugins-official\plugins" (
    echo ERROR: OpenClaude plugins directory not found.
    echo Please install OpenClaude first and run it once.
    echo.
    pause
    exit /b 1
)

REM Check if already installed
if exist "%PLUGIN_DIR%" (
    echo Superpowers is already installed at:
    echo %PLUGIN_DIR%
    echo.
    set /p REINSTALL="Reinstall? (y/n): "
    if /i not "%REINSTALL%"=="y" (
        echo Skipped.
        pause
        exit /b 0
    )
    echo Removing existing installation...
    rmdir /s /q "%PLUGIN_DIR%"
)

echo.
echo Step 1: Cloning Superpowers repository...
echo.

REM Clone to temp directory
set "TEMP_DIR=%TEMP%\superpowers-install"
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"

git clone https://github.com/obra/superpowers.git "%TEMP_DIR%"
if %errorlevel% neq 0 (
    echo ERROR: Failed to clone repository.
    pause
    exit /b 1
)

echo.
echo Step 2: Installing plugin files...
echo.

REM Create plugin directory
mkdir "%PLUGIN_DIR%"

REM Copy skills
xcopy /e /i /q "%TEMP_DIR%\skills\*" "%PLUGIN_DIR%\"

REM Copy hooks
mkdir "%PLUGIN_DIR%\hooks" 2>nul
xcopy /e /i /q "%TEMP_DIR%\hooks\*" "%PLUGIN_DIR%\hooks\"

REM Copy metadata
mkdir "%PLUGIN_DIR%\.claude-plugin" 2>nul
copy /y "%TEMP_DIR%\package.json" "%PLUGIN_DIR%\" >nul
copy /y "%TEMP_DIR%\LICENSE" "%PLUGIN_DIR%\" >nul
copy /y "%TEMP_DIR%\README.md" "%PLUGIN_DIR%\" >nul

REM Create plugin.json
(
echo {
echo   "name": "superpowers",
echo   "version": "5.1.0",
echo   "description": "A complete software development methodology for coding agents",
echo   "author": "obra",
echo   "license": "MIT",
echo   "repository": "https://github.com/obra/superpowers"
echo }
) > "%PLUGIN_DIR%\.claude-plugin\plugin.json"

echo.
echo Step 3: Cleaning up temp files...
echo.

rmdir /s /q "%TEMP_DIR%"

echo.
echo ========================================
echo  Installation Complete!
echo ========================================
echo.
echo Installed to: %PLUGIN_DIR%
echo.
echo Skills available:
echo   - brainstorming
echo   - writing-plans
echo   - executing-plans
echo   - test-driven-development
echo   - systematic-debugging
echo   - subagent-driven-development
echo   - dispatching-parallel-agents
echo   - requesting-code-review
echo   - receiving-code-review
echo   - verification-before-completion
echo   - finishing-a-development-branch
echo   - using-git-worktrees
echo   - writing-skills
echo   - using-superpowers
echo.
echo Restart OpenClaude to activate the skills.
echo.
pause
