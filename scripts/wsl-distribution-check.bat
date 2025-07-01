@echo off
REM wsl-distribution-check.bat
REM Checks and displays all WSL distributions, including Docker Desktop
REM This can help diagnose issues with Claude Desktop tool calls failing to reach Claude Code

echo.
echo WSL Distribution Check (v1.0)
echo ====================================
echo.
echo This script checks all available WSL distributions
echo and ensures credentials are properly synchronized.
echo.

REM Display WSL distributions
echo [1] Listing WSL distributions...
echo.
wsl.exe --list --verbose
echo.

REM Check Docker Desktop Distribution
echo [2] Checking Docker Desktop status...
wsl.exe -d docker-desktop -- echo "Docker Desktop WSL is running" || echo "Docker Desktop WSL is not running or not installed"
echo.

REM Check Ubuntu Distributions
echo [3] Checking Ubuntu distributions...
wsl.exe -d Ubuntu-24.04 -- echo "Ubuntu 24.04 is running" || echo "Ubuntu 24.04 is not running or not installed"
wsl.exe -d Ubuntu-22.04 -- echo "Ubuntu 22.04 is running" || echo "Ubuntu 22.04 is not running or not installed"
wsl.exe -d Ubuntu -- echo "Ubuntu (generic) is running" || echo "Ubuntu (generic) is not running or not installed"
echo.

REM Get current username
for /f "tokens=*" %%a in ('echo %USERNAME%') do set USERNAME=%%a

REM Check for credentials in each distribution
echo [4] Checking Claude credentials in each distribution...
echo.
echo Docker Desktop credentials:
wsl.exe -d docker-desktop -e test -f /home/%USERNAME%/.claude/.credentials.json && echo "Found" || echo "Not found"
echo.
echo Ubuntu 24.04 credentials:
wsl.exe -d Ubuntu-24.04 -e test -f /home/%USERNAME%/.claude/.credentials.json 2>nul && echo "Found" || echo "Not found"
echo.
echo Ubuntu 22.04 credentials:
wsl.exe -d Ubuntu-22.04 -e test -f /home/%USERNAME%/.claude/.credentials.json 2>nul && echo "Found" || echo "Not found"
echo.
echo Ubuntu (generic) credentials:
wsl.exe -d Ubuntu -e test -f /home/%USERNAME%/.claude/.credentials.json 2>nul && echo "Found" || echo "Not found"
echo.

REM Sync credentials if Node.js is available
echo [5] Running credential synchronization...
echo.
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Using Node.js for syncing...
    node "sync-wsl-auth.js"
) else (
    echo Using Python for syncing...
    python "sync-wsl-auth.py"
)

echo.
echo [6] Verification...
echo.
echo Checking Windows bridge:
if exist "C:\Users\%USERNAME%\claude-bridge\claude-env.bat" (
    echo "Windows bridge found at C:\Users\%USERNAME%\claude-bridge\claude-env.bat"
) else (
    echo "Windows bridge not found. Tool calls may fail."
)

echo.
echo ==================================
echo Distribution check complete.
echo If multiple distributions show credentials as "Found",
echo then your system is properly configured for Claude Desktop tool calls.
echo ==================================

pause
