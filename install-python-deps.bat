@echo off
REM Python Dependencies Installer
REM This batch file is a wrapper for the PowerShell installer script

echo Installing Python dependencies for Claude Automation...

powershell -ExecutionPolicy Bypass -File "%~dp0install-python-deps.ps1" %*

IF %ERRORLEVEL% NEQ 0 (
    echo Installation failed with error code: %ERRORLEVEL%
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo Installation complete!
echo.
echo To test the WSL utilities, run: python scripts/wsl_integration_example.py
echo.

pause
