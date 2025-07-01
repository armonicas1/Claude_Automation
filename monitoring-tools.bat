title Claude Automation Monitoring Tools
color 0A

:menu
cls
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo.
echo    Claude Automation - Monitoring ^& Tools Launcher
echo    =================================================
echo.
echo    --- LIVE DASHBOARDS ---
echo    [1] Diagnostic Health Check (This Window)
echo    [2] Live Tool Call Debugger (New Window)
echo    [3] System-Wide Monitor (New Window)
echo    [4] Bridge Communication Monitor (New Window)
echo.
echo    --- MANAGEMENT & UTILITIES ---
echo    [5] Master Control (Status Check)
echo    [6] Launch All Debug Windows
echo    [7] Validate All Scripts
echo.
echo    [Q] Quit
echo.

choice /c 1234567Q /n /m "    Enter your choice: "

if %errorlevel% EQU 8 exit /b
if %errorlevel% EQU 7 goto validate_scripts
if %errorlevel% EQU 6 goto all_debug
if %errorlevel% EQU 5 goto master_control
if %errorlevel% EQU 4 goto bridge_monitor
if %errorlevel% EQU 3 goto system_monitor
if %errorlevel% EQU 2 goto tool_debugger
if %errorlevel% EQU 1 goto live_summary
goto menu

:live_summary
cls
echo.
echo    Claude Automation - Diagnostic Health Check
echo    =========================================
echo    Last Refresh: %DATE% %TIME%
echo.

echo --- WINDOWS PROCESSES ---
powershell -ExecutionPolicy Bypass -Command "& { $procs = Get-Process node -ErrorAction SilentlyContinue; if ($procs) { foreach ($p in $procs) { try { $cmd = (Get-CimInstance Win32_Process -Filter \"ProcessId = $($p.Id)\").CommandLine; $role = if ($cmd -like '*mcp-stdio*') {'[MCP Server]'} elseif ($cmd -like '*bridge*') {'[Bridge Process]'} else {'[Other Node]'}; Write-Host \"$($role.PadRight(20)) (PID: $($p.Id)) : Running\" } catch { Write-Host \"[Node Process] (PID: $($p.Id)) : Running (Access Denied)\" } } } else { Write-Host 'No Node.js processes found.' } }"
echo.

echo --- MCP SERVER HEALTH ---
powershell -ExecutionPolicy Bypass -Command "& { try { $res = Invoke-WebRequest -Uri 'http://localhost:4323/.identity' -UseBasicParsing -TimeoutSec 2; if ($res.StatusCode -eq 200) { Write-Host 'MCP Port 4323 : Responding (OK)' } else { Write-Host 'MCP Port 4323 : Unexpected Status' -ForegroundColor Red } } catch { Write-Host 'MCP Port 4323 : NOT RESPONDING' -ForegroundColor Red } }"
echo.

echo --- PYTHON BRIDGE QUEUE ---
if exist "%APPDATA%\Claude\python-bridge" (
    powershell -ExecutionPolicy Bypass -Command "& { $b='%APPDATA%\Claude\python-bridge'; $p=(Get-ChildItem (Join-Path $b 'pending') -EA SilentlyContinue).Count; $c=(Get-ChildItem (Join-Path $b 'completed') -EA SilentlyContinue).Count; Write-Host \"Queue Status : Pending: $p, Completed: $c\" }"
) else (
    echo Queue Status : Bridge directory not found.
)
echo.

echo --- WSL INTEGRATION HEALTH ---
powershell -ExecutionPolicy Bypass -Command "& { try { $distro='Ubuntu-24.04'; $s = (wsl -l -v) | Where-Object { $_ -like \"*$distro*\" }; if ($s -and $s -like '*Running*') { Write-Host \"Distro '$distro' : Running\"; $b_path = '/mnt/c' + ('%APPDATA%\python-bridge'.Replace('C:','').Replace('\','/')); wsl -d $distro -e test -d $b_path 2>$null; if ($LASTEXITCODE -eq 0) { Write-Host 'Bridge Mount Access : OK' } else { Write-Host 'Bridge Mount Access : FAILED' -ForegroundColor Red }; if (wsl -d $distro -e pgrep -f 'claude' 2>$null) { Write-Host 'Claude Code Process : Active' } else { Write-Host 'Claude Code Process : Inactive' -ForegroundColor Yellow } } else { Write-Host \"Distro '$distro' : Stopped\" -ForegroundColor Red } } catch { Write-Host 'WSL Check : FAILED (wsl.exe error)' -ForegroundColor Red } }"
echo.

echo.
choice /c QR /n /t 10 /d R /m "    (Q to return to menu, R to refresh now. Auto-refreshing in 10s...)"

if %errorlevel% EQU 1 goto menu
goto live_summary


:tool_debugger
echo Starting Live Tool Call Debugger...
if not exist "%SCRIPT_DIR%scripts\tool-call-debugger.ps1" (
    echo ERROR: tool-call-debugger.ps1 not found!
    pause
) else (
    start "LIVE TOOL DEBUGGER" powershell -ExecutionPolicy Bypass -NoExit -File "%SCRIPT_DIR%scripts\tool-call-debugger.ps1" -Live
)
goto menu

:system_monitor
echo Starting System-Wide Monitor...
if not exist "%SCRIPT_DIR%scripts\claude-system-monitor.ps1" (
    echo ERROR: claude-system-monitor.ps1 not found!
    pause
) else (
    start "SYSTEM MONITOR" powershell -ExecutionPolicy Bypass -NoExit -File "%SCRIPT_DIR%scripts\claude-system-monitor.ps1" -Continuous
)
goto menu

:bridge_monitor
echo Starting Bridge Communication Monitor...
if not exist "%SCRIPT_DIR%scripts\bridge-monitor.ps1" (
    echo ERROR: bridge-monitor.ps1 not found!
    pause
) else (
    start "BRIDGE MONITOR" powershell -ExecutionPolicy Bypass -NoExit -File "%SCRIPT_DIR%scripts\bridge-monitor.ps1" -Continuous
)
goto menu

:master_control
echo Running Master Control Status Check...
if not exist "%SCRIPT_DIR%claude-master-control.ps1" (
    echo ERROR: claude-master-control.ps1 not found!
    pause
) else (
    powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%claude-master-control.ps1" -Action status
    pause
)
goto menu

:all_debug
echo Launching all debug windows...
call :tool_debugger
call :system_monitor
call :bridge_monitor
goto menu

:validate_scripts
echo Validating PowerShell scripts...
if not exist "%SCRIPT_DIR%scripts\validate-scripts.ps1" (
    echo ERROR: validate-scripts.ps1 not found!
    pause
) else (
    powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\validate-scripts.ps1"
    pause
)
goto menu