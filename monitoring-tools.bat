@echo off
REM monitoring-tools.bat (v2.0)
REM Enhanced helper script to launch Claude monitoring tools in separate windows.

title Claude Automation Monitoring Tools
color 0A

:menu
cls
echo.
echo    Claude Automation - Monitoring & Tools Launcher
echo    =================================================
echo.
echo    [1] Live Tool Call Debugger (RECOMMENDED)
echo    [2] System-Wide Monitor (Continuous)
echo    [3] Bridge Communication Monitor (Continuous)
echo.
echo    --- Management ---
echo    [4] Master Control (Status Check)
echo    [5] All Debug Windows (Launches 1, 2, 3)
echo    [6] Validate All Scripts
echo.
echo    [Q] Quit
echo.

set /p choice="    Enter your choice: "

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

if /i "%choice%"=="1" (
  echo Starting Live Tool Call Debugger...
  start "LIVE TOOL DEBUGGER" powershell -ExecutionPolicy Bypass -NoExit -File "%SCRIPT_DIR%scripts\tool-call-debugger.ps1" -Live
  goto menu
)
if /i "%choice%"=="2" (
  echo Starting System-Wide Monitor...
  start "SYSTEM MONITOR" powershell -ExecutionPolicy Bypass -NoExit -File "%SCRIPT_DIR%scripts\claude-system-monitor.ps1" -Continuous
  goto menu
)
if /i "%choice%"=="3" (
  echo Starting Bridge Communication Monitor...
  start "BRIDGE MONITOR" powershell -ExecutionPolicy Bypass -NoExit -File "%SCRIPT_DIR%scripts\bridge-monitor.ps1" -Continuous
  goto menu
)
if /i "%choice%"=="4" (
  echo Running Master Control Status Check...
  powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%claude-master-control.ps1" -Action status
  pause
  goto menu
)
if /i "%choice%"=="5" (
  echo Launching all debug windows...
  start "LIVE TOOL DEBUGGER" powershell -ExecutionPolicy Bypass -NoExit -File "%SCRIPT_DIR%scripts\tool-call-debugger.ps1" -Live
  start "SYSTEM MONITOR" powershell -ExecutionPolicy Bypass -NoExit -File "%SCRIPT_DIR%scripts\claude-system-monitor.ps1" -Continuous
  start "BRIDGE MONITOR" powershell -ExecutionPolicy Bypass -NoExit -File "%SCRIPT_DIR%scripts\bridge-monitor.ps1" -Continuous
  goto menu
)
if /i "%choice%"=="6" (
  echo Validating PowerShell scripts...
  powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\validate-scripts.ps1"
  pause
  goto menu
)
if /i "%choice%"=="q" (
  exit /b
)

echo Invalid choice. Please try again.
timeout /t 2 >nul
goto menu
```