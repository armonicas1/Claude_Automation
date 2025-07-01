@echo off
REM monitoring-tools-fixed.bat (v3.4)
REM Enhanced helper script to launch Claude monitoring tools with event logging

title Claude Automation Monitoring Tools
color 0A

REM Set script directory path and change to it
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Initialize idle timer
set IDLE_TIMEOUT=180
set IDLE_COUNTER=0
set AUTO_DISPLAY=0

REM Verify scripts directory exists
if not exist "%SCRIPT_DIR%scripts\" (
    echo ERROR: Scripts directory not found at "%SCRIPT_DIR%scripts\"
    echo Creating scripts directory...
    mkdir "%SCRIPT_DIR%scripts"
    echo Please ensure monitoring scripts are installed in the scripts directory.
    pause
)

REM Log startup event
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\log-event.ps1" -Source "MONITORING_TOOLS" -Event "STARTUP" -Data "{\"version\":\"3.4\"}"

:menu
cls
echo.
echo    Claude Automation - Monitoring ^& Tools Launcher
echo    =================================================
echo.
echo    [1] Live Tool Call Debugger (RECOMMENDED)
echo    [2] System-Wide Monitor (Continuous)
echo    [3] Bridge Communication Monitor (Continuous)
echo    [4] System Events Monitor (NEW!)
echo    [5] Unified Log Monitor (ALL-IN-ONE)
echo.
echo    --- Management ---
echo    [6] Master Control (Status Check)
echo    [7] All Debug Windows (Launches 1-5)
echo    [8] Validate All Scripts
echo    [D] WSL Distribution Check (NEW!) 
echo.
echo    --- Auto Display ---
echo    [9] Auto Summary Display (Manual Refresh)
echo    [0] Toggle Auto Display: %AUTO_DISPLAY% (0=Off, 1=On)
echo    [I] Change Refresh Interval (Current: %IDLE_TIMEOUT%s)
echo.
echo    --- Log Viewer ---
echo    [L] View Log Files
echo.
echo    [Q] Quit
echo.

REM Auto-display feature with fixed timeout handling
if %AUTO_DISPLAY% EQU 1 (
    set /a IDLE_COUNTER+=1
    if %IDLE_COUNTER% GEQ %IDLE_TIMEOUT% (
        set IDLE_COUNTER=0
        cls
        echo Auto-refreshing display...
        goto auto_display
    )
)

REM Using SET /P instead of CHOICE to ensure the script stays open
echo    Enter your choice (1-9, 0, D, or Q): 
set /p user_choice=
echo.

REM Log menu selection
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\log-event.ps1" -Source "MONITORING_TOOLS" -Event "MENU_SELECTION" -Data "{\"choice\":\"%user_choice%\"}"

REM Process the user input
if /i "%user_choice%"=="Q" exit /b
if /i "%user_choice%"=="L" goto view_logs
if /i "%user_choice%"=="I" goto change_interval
if /i "%user_choice%"=="D" goto wsl_check
if "%user_choice%"=="0" goto toggle_auto
if "%user_choice%"=="9" goto auto_display
if "%user_choice%"=="8" goto validate_scripts
if "%user_choice%"=="7" goto all_debug
if "%user_choice%"=="6" goto master_control
if "%user_choice%"=="5" goto unified_log_monitor
if "%user_choice%"=="4" goto system_events_monitor
if "%user_choice%"=="3" goto bridge_monitor
if "%user_choice%"=="2" goto system_monitor
if "%user_choice%"=="1" goto tool_debugger
REM If we get here, the input was invalid - go back to menu
goto menu

:tool_debugger
echo Starting Live Tool Call Debugger...
if not exist "%SCRIPT_DIR%scripts\tool-call-debugger.ps1" (
    echo ERROR: Tool Call Debugger script not found at "%SCRIPT_DIR%scripts\tool-call-debugger.ps1"
    echo Please ensure the script is installed correctly.
    pause
    goto menu
)
start "LIVE TOOL DEBUGGER" powershell -ExecutionPolicy Bypass -NoExit -File "%SCRIPT_DIR%scripts\tool-call-debugger.ps1" -Live
set IDLE_COUNTER=0
goto menu

:system_monitor
echo Starting System-Wide Monitor...
if not exist "%SCRIPT_DIR%scripts\claude-system-monitor.ps1" (
    echo ERROR: System Monitor script not found at "%SCRIPT_DIR%scripts\claude-system-monitor.ps1"
    echo Creating placeholder script...
    
    echo "# System Monitor Script" > "%SCRIPT_DIR%scripts\claude-system-monitor.ps1"
    echo "param([switch]$Continuous)" >> "%SCRIPT_DIR%scripts\claude-system-monitor.ps1"
    echo "Write-Host 'Claude System Monitor'" >> "%SCRIPT_DIR%scripts\claude-system-monitor.ps1"
    echo "Write-Host '=================='" >> "%SCRIPT_DIR%scripts\claude-system-monitor.ps1"
    echo "Write-Host ''" >> "%SCRIPT_DIR%scripts\claude-system-monitor.ps1"
    echo "while ($true) {" >> "%SCRIPT_DIR%scripts\claude-system-monitor.ps1"
    echo "    Get-Process claude,node -ErrorAction SilentlyContinue | Format-Table Name,Id,CPU,WS -AutoSize" >> "%SCRIPT_DIR%scripts\claude-system-monitor.ps1"
    echo "    if ($Continuous) {" >> "%SCRIPT_DIR%scripts\claude-system-monitor.ps1"
    echo "        Start-Sleep -Seconds 5" >> "%SCRIPT_DIR%scripts\claude-system-monitor.ps1"
    echo "        Clear-Host" >> "%SCRIPT_DIR%scripts\claude-system-monitor.ps1"
    echo "        Write-Host 'Claude System Monitor'" >> "%SCRIPT_DIR%scripts\claude-system-monitor.ps1"
    echo "        Write-Host '=================='" >> "%SCRIPT_DIR%scripts\claude-system-monitor.ps1"
    echo "        Write-Host ''" >> "%SCRIPT_DIR%scripts\claude-system-monitor.ps1"
    echo "    } else { break }" >> "%SCRIPT_DIR%scripts\claude-system-monitor.ps1"
    echo "}" >> "%SCRIPT_DIR%scripts\claude-system-monitor.ps1"
    
    echo Basic system monitor script created. You may want to customize it later.
)
start "SYSTEM MONITOR" powershell -ExecutionPolicy Bypass -NoExit -File "%SCRIPT_DIR%scripts\claude-system-monitor.ps1" -Continuous
set IDLE_COUNTER=0
goto menu

:bridge_monitor
echo Starting Bridge Communication Monitor...
if not exist "%SCRIPT_DIR%scripts\bridge-monitor.ps1" (
    echo ERROR: Bridge Monitor script not found at "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo Creating placeholder script...
    
    echo "# Bridge Monitor Script" > "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo "param([switch]$Continuous)" >> "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo "Write-Host 'Claude Bridge Monitor'" >> "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo "Write-Host '==================='" >> "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo "Write-Host ''" >> "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo "$bridgeDir = Join-Path $env:APPDATA 'Claude\python-bridge'" >> "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo "while ($true) {" >> "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo "    $req = (Get-ChildItem $bridgeDir\pending -ErrorAction SilentlyContinue).Count" >> "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo "    $comp = (Get-ChildItem $bridgeDir\completed -ErrorAction SilentlyContinue).Count" >> "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo "    $fail = (Get-ChildItem $bridgeDir\failed -ErrorAction SilentlyContinue).Count" >> "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo "    Write-Host ('Pending: {0}, Completed: {1}, Failed: {2}' -f $req,$comp,$fail)" >> "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo "    Write-Host ''" >> "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo "    Write-Host 'Recent Bridge Log:'" >> "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo "    if (Test-Path (Join-Path $PSScriptRoot '..\logs\bridge.log')) {" >> "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo "        Get-Content (Join-Path $PSScriptRoot '..\logs\bridge.log') -Tail 5" >> "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo "    } else {" >> "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo "        Write-Host 'Bridge log not found'" >> "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo "    }" >> "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo "    if ($Continuous) {" >> "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo "        Start-Sleep -Seconds 5" >> "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo "        Clear-Host" >> "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo "        Write-Host 'Claude Bridge Monitor'" >> "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo "        Write-Host '==================='" >> "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo "        Write-Host ''" >> "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo "    } else { break }" >> "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    echo "}" >> "%SCRIPT_DIR%scripts\bridge-monitor.ps1"
    
    echo Basic bridge monitor script created. You may want to customize it later.
)
start "BRIDGE MONITOR" powershell -ExecutionPolicy Bypass -NoExit -File "%SCRIPT_DIR%scripts\bridge-monitor.ps1" -Continuous
set IDLE_COUNTER=0
goto menu

:system_events_monitor
echo Starting System Events Monitor...
if not exist "%SCRIPT_DIR%scripts\system-event-monitor.ps1" (
    echo ERROR: System Events Monitor script not found at "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo Creating basic script...
    
    echo # System Events Monitor Script > "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo param^([switch^]$Continuous^) >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo. >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo $scriptDir = Split-Path -Parent $PSScriptRoot >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo $appDataDir = [System.Environment]::GetFolderPath^('ApplicationData'^) >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo $logFilePath = Join-Path $appDataDir "Claude\logs\system-events.log" >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo $fallbackLogPath = Join-Path $scriptDir "logs\system-events.log" >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo. >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo function Show-SystemEvents ^{ >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo     Clear-Host >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo     Write-Host "Claude Automation - System Events Monitor" -ForegroundColor Green >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo     Write-Host "=======================================" -ForegroundColor Green >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo     Write-Host "" >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo     >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo     # Check if log file exists >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo     if ^(Test-Path $logFilePath^) ^{ >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo         $content = Get-Content $logFilePath -Tail 20 -ErrorAction SilentlyContinue >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo         if ^($content^) ^{ >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo             foreach ^($line in $content^) ^{ >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo                 try ^{ >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo                     $event = $line ^| ConvertFrom-Json >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo                     Write-Host "[$^($event.timestamp^)] [$^($event.source^)] $^($event.event^)" -ForegroundColor Cyan >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo                     $event.data ^| Format-List ^| Out-String ^| Write-Host >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo                     Write-Host "" >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo                 ^} catch ^{ >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo                     Write-Host "Error parsing log entry: $line" -ForegroundColor Red >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo                 ^} >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo             ^} >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo         ^} else ^{ >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo             Write-Host "No events found in log file" -ForegroundColor Yellow >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo         ^} >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo     ^} else ^{ >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo         Write-Host "System events log not found at: $logFilePath" -ForegroundColor Yellow >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo         Write-Host "Checking fallback location: $fallbackLogPath" -ForegroundColor Yellow >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo         if ^(Test-Path $fallbackLogPath^) ^{ >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo             $content = Get-Content $fallbackLogPath -Tail 20 -ErrorAction SilentlyContinue >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo             if ^($content^) ^{ >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo                 foreach ^($line in $content^) ^{ >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo                     try ^{ >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo                         $event = $line ^| ConvertFrom-Json >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo                         Write-Host "[$^($event.timestamp^)] [$^($event.source^)] $^($event.event^)" -ForegroundColor Cyan >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo                         $event.data ^| Format-List ^| Out-String ^| Write-Host >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo                         Write-Host "" >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo                     ^} catch ^{ >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo                         Write-Host "Error parsing log entry: $line" -ForegroundColor Red >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo                     ^} >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo                 ^} >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo             ^} else ^{ >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo                 Write-Host "No events found in fallback log file" -ForegroundColor Yellow >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo             ^} >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo         ^} else ^{ >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo             Write-Host "No system events log found in either location." -ForegroundColor Yellow >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo             Write-Host "Waiting for events to be logged..." -ForegroundColor Yellow >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo         ^} >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo     ^} >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo ^} >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo. >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo if ^($Continuous^) ^{ >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo     Write-Host "Starting continuous monitoring. Press Ctrl+C to exit." -ForegroundColor Yellow >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo     while ^($true^) ^{ >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo         Show-SystemEvents >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo         Start-Sleep -Seconds 2 >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo     ^} >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo ^} else ^{ >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo     Show-SystemEvents >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    echo ^} >> "%SCRIPT_DIR%scripts\system-event-monitor.ps1"
    
    echo Basic system events monitor script created.
)
start "SYSTEM EVENTS MONITOR" powershell -ExecutionPolicy Bypass -NoExit -File "%SCRIPT_DIR%scripts\system-event-monitor.ps1" -Continuous
set IDLE_COUNTER=0
goto menu

:unified_log_monitor
echo Starting Unified Log Monitor...
echo Checking for log files...
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\initialize-logs.ps1"
powershell -ExecutionPolicy Bypass -NoExit -File "%SCRIPT_DIR%scripts\unified-log-viewer.ps1" -Continuous -RefreshInterval 2
set IDLE_COUNTER=0
goto menu

:all_debug
echo Launching all debug windows...
call :tool_debugger
call :system_monitor
call :bridge_monitor
call :system_events_monitor
call :unified_log_monitor
set IDLE_COUNTER=0
goto menu

:validate_scripts
echo Validating PowerShell scripts...
if not exist "%SCRIPT_DIR%test-monitoring.ps1" (
    echo ERROR: Test script not found at "%SCRIPT_DIR%test-monitoring.ps1"
    echo Creating basic test script...
    
    echo "# Test Monitoring Scripts" > "%SCRIPT_DIR%test-monitoring.ps1"
    echo "Write-Host 'Validating monitoring scripts...'" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "Write-Host ''" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "$scriptsDir = Join-Path $PSScriptRoot 'scripts'" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "$testResults = @()" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "# Test if scripts exist" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "$scripts = @(" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "    'tool-call-debugger.ps1'," >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "    'claude-system-monitor.ps1'," >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "    'bridge-monitor.ps1'" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo ")" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "foreach ($script in $scripts) {" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "    $scriptPath = Join-Path $scriptsDir $script" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "    $exists = Test-Path $scriptPath" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "    $testResults += [PSCustomObject]@{" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "        Script = $script" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "        Exists = $exists" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "        Valid = $false" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "    }" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "    " >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "    if ($exists) {" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "        try {" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "            $null = [System.Management.Automation.PSParser]::Tokenize((Get-Content $scriptPath -Raw), [ref]$null)" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "            $testResults[-1].Valid = $true" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "        } catch {" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "            # Script has syntax errors" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "        }" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "    }" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "}" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "" >> "%SCRIPT_DIR%test-monitoring.ps1"
    echo "$testResults | Format-Table -AutoSize" >> "%SCRIPT_DIR%test-monitoring.ps1"
    
    echo Basic test script created. You may want to enhance it later.
)
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%test-monitoring.ps1"
set IDLE_COUNTER=0
pause
goto menu

:change_interval
cls
echo.
echo    Change Auto-Display Refresh Interval
echo    ===================================
echo.
echo    Current interval: %IDLE_TIMEOUT% seconds
echo.
set /p new_timeout="    Enter new interval in seconds (10-300): "
if %new_timeout% LSS 10 set new_timeout=10
if %new_timeout% GTR 300 set new_timeout=300
set IDLE_TIMEOUT=%new_timeout%
set IDLE_COUNTER=0
goto menu

:toggle_auto
if %AUTO_DISPLAY% EQU 0 (
    set AUTO_DISPLAY=1
    echo Auto Display enabled
) else (
    set AUTO_DISPLAY=0
    echo Auto Display disabled
)
timeout /t 2 >nul
goto menu

:auto_display
cls
echo.
echo    Claude Automation - Live Status Summary
echo    =====================================
echo    Timestamp: %DATE% %TIME%
echo.

REM Check if APPDATA directory exists and create necessary directories
if not exist "%APPDATA%\Claude\logs\" (
    echo Creating Claude logs directory...
    mkdir "%APPDATA%\Claude\logs" 2>nul
)

if not exist "%APPDATA%\Claude\python-bridge\" (
    echo Creating Claude python-bridge directory...
    mkdir "%APPDATA%\Claude\python-bridge" 2>nul
    mkdir "%APPDATA%\Claude\python-bridge\pending" 2>nul
    mkdir "%APPDATA%\Claude\python-bridge\completed" 2>nul
    mkdir "%APPDATA%\Claude\python-bridge\failed" 2>nul
)

if not exist "%SCRIPT_DIR%logs\" (
    echo Creating logs directory...
    mkdir "%SCRIPT_DIR%logs" 2>nul
)

echo    [SYSTEM STATUS]
echo    --------------------------
powershell -ExecutionPolicy Bypass -Command "& {Get-Process claude,node -ErrorAction SilentlyContinue | Format-Table Name,Id,CPU,WS -AutoSize}"
echo.

echo    [TOOL CALL ACTIVITY]
echo    --------------------------
if exist "%APPDATA%\Claude\logs\mcp-server-custom-extension.log" (
    powershell -ExecutionPolicy Bypass -Command "& {Get-Content '%APPDATA%\Claude\logs\mcp-server-custom-extension.log' -Tail 5 -ErrorAction SilentlyContinue | Where-Object {$_ -match 'tool|error|request'}}"
) else (
    echo No tool call logs found at %APPDATA%\Claude\logs\mcp-server-custom-extension.log
)
echo.

echo    [BRIDGE COMMUNICATION]
echo    --------------------------
powershell -ExecutionPolicy Bypass -Command "& {$bridgeDir='%APPDATA%\Claude\python-bridge'; $req=(Get-ChildItem $bridgeDir\pending -ErrorAction SilentlyContinue).Count; $comp=(Get-ChildItem $bridgeDir\completed -ErrorAction SilentlyContinue).Count; $fail=(Get-ChildItem $bridgeDir\failed -ErrorAction SilentlyContinue).Count; Write-Host ('Pending: {0}, Completed: {1}, Failed: {2}' -f $req,$comp,$fail)}"
echo.

echo    [SYSTEM EVENTS]
echo    --------------------------
powershell -ExecutionPolicy Bypass -Command "& {$appDataDir = [System.Environment]::GetFolderPath('ApplicationData'); $logFile = Join-Path $appDataDir 'Claude\logs\system-events.log'; if(Test-Path $logFile) { Get-Content $logFile -Tail 5 -ErrorAction SilentlyContinue | ForEach-Object { try { $event = $_ | ConvertFrom-Json; Write-Host \"[$($event.timestamp)] [$^($event.source^)] $^($event.event^)" -ForegroundColor Cyan; $event.data | Format-List | Out-String | Write-Host; Write-Host '' } catch { Write-Host "Error parsing log entry: $_" -ForegroundColor Red } } } else { Write-Host 'No system events log found' -ForegroundColor Yellow } }"
echo.

echo    [UNIFIED MONITORING]
echo    --------------------------
powershell -ExecutionPolicy Bypass -Command "& {$logPath = Join-Path $PSScriptRoot 'logs\unified-monitoring.log'; if(Test-Path $logPath) { Get-Content $logPath -Tail 3 | ForEach-Object { $parts = $_ -split '\]\s+\['; if($parts.Count -ge 3) { Write-Host $parts[0] -NoNewline; Write-Host '] [' -NoNewline; Write-Host $parts[1] -NoNewline -ForegroundColor Cyan; Write-Host '] [' -NoNewline; Write-Host $parts[2] -ForegroundColor Yellow } else { Write-Host $_ } } } else { Write-Host 'No unified monitoring log found' } }"
echo.

echo    [Auto-refresh: %AUTO_DISPLAY% (0=Off, 1=On), Interval: %IDLE_TIMEOUT% seconds]
echo    [Press Q to return to menu or R to refresh manually]
echo.

REM Using SET /P instead of CHOICE for more reliable input handling
echo    Press Q to return to menu or R to refresh: 
set /p refresh_choice=

if /i "%refresh_choice%"=="Q" goto menu
if /i "%refresh_choice%"=="R" goto auto_display
goto menu
set CHOICE_RESULT=%ERRORLEVEL%
if %CHOICE_RESULT% EQU 1 goto menu
if %CHOICE_RESULT% EQU 2 goto auto_display

:wsl_check
REM Log WSL check start
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\log-event.ps1" -Source "MONITORING_TOOLS" -Event "WSL_CHECK_START" -Data "{}"

REM Clear screen and show header
cls
echo.
echo    Claude Automation - WSL Distribution Check
echo    =================================================
echo.
echo    This tool checks WSL distribution configuration for Claude Code integration
echo    and helps diagnose silent failures in tool calls.
echo.
echo    Running WSL distribution diagnostic script...
echo.

REM Run the WSL distribution check script
call "%SCRIPT_DIR%scripts\wsl-distribution-check.bat"

REM Log completion and return to menu
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\log-event.ps1" -Source "MONITORING_TOOLS" -Event "WSL_CHECK_COMPLETE" -Data "{}"
goto menu
goto menu
