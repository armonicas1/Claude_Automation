#!/usr/bin/env powershell
# claude-master-control.ps1
# Master control script for Claude Desktop Extension system with comprehensive monitoring

param(
    [ValidateSet('start', 'stop', 'monitor', 'debug', 'fix', 'status')]
    [string]$Action = 'status',
    [switch]$Continuous = $false,
    [switch]$AdminMode = $false,
    [switch]$Verbose = $false
)

# Request elevation if needed
if ($AdminMode -and -NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "Requesting administrator privileges..." -ForegroundColor Yellow
    Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Action $Action $(if ($Continuous) { '-Continuous' }) -AdminMode" -Verb RunAs
    exit
}

# Global configuration
$Global:Config = @{
    ProjectDir = Split-Path -Parent $PSCommandPath
    BridgeDir = "$env:USERPROFILE\claude-bridge" 
    ClaudeDir = "$env:APPDATA\Claude"
    Ports = @(4323, 4322, 4324)
    LogDir = "$(Split-Path -Parent $PSCommandPath)\logs"
    WSLDistribution = "Ubuntu-24.04"
    ClaudeDesktopPath = "${env:LOCALAPPDATA}\Claude\Claude.exe"
}

function Write-MasterLog {
    param($Message, $Level = 'INFO')
    $timestamp = Get-Date -Format "HH:mm:ss.fff"
    $color = switch ($Level) {
        'ERROR' { 'Red' }
        'WARN' { 'Yellow' }
        'SUCCESS' { 'Green' }
        'DEBUG' { 'Cyan' }
        'HEADER' { 'Magenta' }
        default { 'White' }
    }
    
    if ($Level -eq 'DEBUG' -and -not $Verbose) { return }
    
    Write-Host "[$timestamp] [$Level] $Message" -ForegroundColor $color
}

function Show-Header {
    param([string]$Title)
    Clear-Host
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Magenta
    Write-Host "              CLAUDE DESKTOP EXTENSION MASTER CONTROL           " -ForegroundColor Magenta
    Write-Host "                         $Title" -ForegroundColor Magenta
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Magenta
    Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor White
    Write-Host ""
}

function Test-Prerequisites {
    Write-MasterLog "Checking prerequisites..." 'DEBUG'
    
    $issues = @()
    
    # Check Node.js
    try {
        $nodeVersion = node --version 2>$null
        if ($nodeVersion) {
            Write-MasterLog "Node.js: $nodeVersion" 'SUCCESS'
        } else {
            $issues += "Node.js not found"
        }
    } catch {
        $issues += "Node.js not found or not in PATH"
    }
    
    # Check Claude Desktop
    if (Test-Path $Global:Config.ClaudeDesktopPath) {
        Write-MasterLog "Claude Desktop: Found" 'SUCCESS'
    } else {
        $issues += "Claude Desktop not found at expected path"
    }
    
    # Check WSL
    try {
        $wslStatus = wsl -l -v 2>$null
        if ($wslStatus -match $Global:Config.WSLDistribution) {
            Write-MasterLog "WSL $($Global:Config.WSLDistribution): Available" 'SUCCESS'
        } else {
            $issues += "WSL distribution $($Global:Config.WSLDistribution) not found"
        }
    } catch {
        $issues += "WSL not available"
    }
    
    # Check project files
    $criticalFiles = @(
        "$($Global:Config.ProjectDir)\src\custom-claude-mcp-stdio.js",
        "$($Global:Config.ProjectDir)\src\claude-desktop-bridge.js"
    )
    
    foreach ($file in $criticalFiles) {
        if (Test-Path $file) {
            Write-MasterLog "$(Split-Path $file -Leaf): Found" 'SUCCESS'
        } else {
            $issues += "Missing critical file: $file"
        }
    }
    
    if ($issues.Count -gt 0) {
        Write-MasterLog "Prerequisites check failed:" 'ERROR'
        foreach ($issue in $issues) {
            Write-MasterLog "  • $issue" 'ERROR'
        }
        return $false
    }
    
    Write-MasterLog "All prerequisites satisfied" 'SUCCESS'
    return $true
}

function Initialize-Environment {
    Write-MasterLog "Initializing environment..." 'DEBUG'
    
    # Create required directories
    $directories = @(
        $Global:Config.BridgeDir,
        "$($Global:Config.BridgeDir)\pending",
        "$($Global:Config.BridgeDir)\completed",
        "$($Global:Config.ClaudeDir)\code_triggers",
        "$($Global:Config.ClaudeDir)\code_requests", 
        "$($Global:Config.ClaudeDir)\code_responses",
        $Global:Config.LogDir
    )
    
    $created = 0
    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            New-Item -Path $dir -ItemType Directory -Force | Out-Null
            $created++
            Write-MasterLog "Created directory: $dir" 'DEBUG'
        }
    }
    
    if ($created -gt 0) {
        Write-MasterLog "Created $created directories" 'SUCCESS'
    }
    
    # Update Claude Desktop configuration
    $configPath = "$($Global:Config.ClaudeDir)\claude_desktop_config.json"
    $mcpServerPath = "$($Global:Config.ProjectDir)\src\custom-claude-mcp-stdio.js"
    
    $config = @{
        mcpServers = @{
            "custom-extension" = @{
                command = "node"
                args = @($mcpServerPath)
                env = @{}
                disabled = $false
            }
        }
    }
    
    try {
        $config | ConvertTo-Json -Depth 10 | Set-Content $configPath
        Write-MasterLog "Updated Claude Desktop configuration" 'SUCCESS'
    } catch {
        Write-MasterLog "Failed to update configuration: $($_.Exception.Message)" 'ERROR'
        return $false
    }
    
    return $true
}

function Stop-AllServices {
    Write-MasterLog "Stopping all services..." 'DEBUG'
    
    $stopped = 0
    
    # Stop Claude processes
    $claudeProcs = Get-Process | Where-Object { $_.ProcessName -like "*claude*" }
    foreach ($proc in $claudeProcs) {
        try {
            Stop-Process -Id $proc.Id -Force
            Write-MasterLog "Stopped Claude process: PID $($proc.Id)" 'SUCCESS'
            $stopped++
        } catch {
            Write-MasterLog "Failed to stop Claude process: PID $($proc.Id)" 'WARN'
        }
    }
    
    # Stop Node.js processes
    $nodeProcs = Get-Process | Where-Object { $_.ProcessName -eq "node" }
    foreach ($proc in $nodeProcs) {
        try {
            $cmdLine = (Get-WmiObject Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
            if ($cmdLine -like "*claude*" -or $cmdLine -like "*mcp*" -or $cmdLine -like "*bridge*") {
                Stop-Process -Id $proc.Id -Force
                Write-MasterLog "Stopped Node.js process: PID $($proc.Id)" 'SUCCESS'
                $stopped++
            }
        } catch {
            # Skip processes we can't access
        }
    }
    
    # Clear ports
    foreach ($port in $Global:Config.Ports) {
        try {
            $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
            if ($connection) {
                Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
                Write-MasterLog "Released port $port" 'SUCCESS'
            }
        } catch {
            # Port wasn't in use
        }
    }
    
    Write-MasterLog "Stopped $stopped processes" 'SUCCESS'
    Start-Sleep -Seconds 2  # Allow processes to fully terminate
}

function Start-Services {
    Write-MasterLog "Starting services..." 'DEBUG'
    
    # Start bridge process
    $bridgeScript = "$($Global:Config.ProjectDir)\src\claude-desktop-bridge.js"
    if (Test-Path $bridgeScript) {
        try {
            Start-Process node -ArgumentList $bridgeScript -WindowStyle Hidden
            Write-MasterLog "Started bridge process" 'SUCCESS'
        } catch {
            Write-MasterLog "Failed to start bridge: $($_.Exception.Message)" 'ERROR'
        }
    }
    
    # Sync WSL authentication
    $wslAuthScript = "$($Global:Config.ProjectDir)\scripts\sync-wsl-auth.js"
    if (Test-Path $wslAuthScript) {
        try {
            Start-Process node -ArgumentList $wslAuthScript -WindowStyle Hidden -Wait
            Write-MasterLog "Synchronized WSL authentication" 'SUCCESS'
        } catch {
            Write-MasterLog "Failed to sync WSL auth: $($_.Exception.Message)" 'WARN'
        }
    }
    
    # Start Claude Desktop
    try {
        Start-Process -FilePath $Global:Config.ClaudeDesktopPath
        Write-MasterLog "Started Claude Desktop" 'SUCCESS'
    } catch {
        Write-MasterLog "Failed to start Claude Desktop: $($_.Exception.Message)" 'ERROR'
        return $false
    }
    
    # Wait for MCP server to start
    Write-MasterLog "Waiting for MCP server to initialize..." 'DEBUG'
    $maxAttempts = 30
    $attempts = 0
    
    while ($attempts -lt $maxAttempts) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:4323/.identity" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-MasterLog "MCP server is responding" 'SUCCESS'
                return $true
            }
        } catch {
            # Still waiting
        }
        
        Start-Sleep -Seconds 1
        $attempts++
        
        if ($attempts % 10 -eq 0) {
            Write-MasterLog "Still waiting for MCP server... ($attempts/$maxAttempts)" 'DEBUG'
        }
    }
    
    Write-MasterLog "MCP server did not respond within expected time" 'WARN'
    return $false
}

function Get-SystemStatus {
    $status = @{
        Processes = @{
            Claude = @()
            Node = @()
            Bridge = @()
        }
        Ports = @{}
        MCP = @{
            Responding = $false
            Tools = @()
        }
        Bridge = @{
            Directories = @()
            RecentActivity = @()
        }
        WSL = @{
            Running = $false
            ClaudeCode = $false
        }
    }
    
    # Get process information
    $claudeProcs = Get-Process | Where-Object { $_.ProcessName -like "*claude*" }
    foreach ($proc in $claudeProcs) {
        $status.Processes.Claude += @{
            Id = $proc.Id
            Name = $proc.ProcessName
            Memory = [math]::Round($proc.WorkingSet / 1MB, 2)
        }
    }
    
    $nodeProcs = Get-Process | Where-Object { $_.ProcessName -eq "node" }
    foreach ($proc in $nodeProcs) {
        try {
            $cmdLine = (Get-WmiObject Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
            $type = if ($cmdLine -like "*bridge*") { "Bridge" } 
                   elseif ($cmdLine -like "*mcp*") { "MCP" } 
                   else { "Other" }
            
            $procInfo = @{
                Id = $proc.Id
                Type = $type
                Memory = [math]::Round($proc.WorkingSet / 1MB, 2)
            }
            
            if ($type -eq "Bridge") {
                $status.Processes.Bridge += $procInfo
            } else {
                $status.Processes.Node += $procInfo
            }
        } catch {
            # Skip inaccessible processes
        }
    }
    
    # Check ports
    foreach ($port in $Global:Config.Ports) {
        try {
            $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
            if ($connection) {
                $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
                $status.Ports[$port] = @{
                    Process = $process.ProcessName
                    PID = $connection.OwningProcess
                }
            } else {
                $status.Ports[$port] = $null
            }
        } catch {
            $status.Ports[$port] = $null
        }
    }
    
    # Test MCP server
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:4323/.identity" -UseBasicParsing -TimeoutSec 3
        if ($response.StatusCode -eq 200) {
            $status.MCP.Responding = $true
            
            # Try to get tools
            try {
                $toolsBody = @{
                    jsonrpc = "2.0"
                    id = 1
                    method = "tools/list"
                    params = @{}
                } | ConvertTo-Json
                
                $toolsResponse = Invoke-RestMethod -Uri "http://localhost:4323/mcp" -Method POST -Body $toolsBody -ContentType "application/json" -TimeoutSec 3
                if ($toolsResponse.result -and $toolsResponse.result.tools) {
                    $status.MCP.Tools = $toolsResponse.result.tools
                }
            } catch {
                # Tools query failed
            }
        }
    } catch {
        # MCP server not responding
    }
    
    # Check bridge directories
    $bridgeDirs = @(
        @{ Path = "$($Global:Config.BridgeDir)\pending"; Name = "Pending" },
        @{ Path = "$($Global:Config.BridgeDir)\completed"; Name = "Completed" },
        @{ Path = "$($Global:Config.ClaudeDir)\code_triggers"; Name = "Triggers" }
    )
    
    foreach ($dir in $bridgeDirs) {
        $dirStatus = @{
            Name = $dir.Name
            Exists = Test-Path $dir.Path
            FileCount = 0
        }
        
        if ($dirStatus.Exists) {
            $dirStatus.FileCount = (Get-ChildItem $dir.Path -File -ErrorAction SilentlyContinue).Count
        }
        
        $status.Bridge.Directories += $dirStatus
    }
    
    # Check WSL
    try {
        $wslOutput = wsl -l -v 2>$null
        $status.WSL.Running = $wslOutput -match "Running"
        
        if ($status.WSL.Running) {
            $claudeCheck = wsl -d $Global:Config.WSLDistribution -e bash -c "ps aux | grep claude | grep -v grep" 2>$null
            $status.WSL.ClaudeCode = ($null -ne $claudeCheck)
        }
    } catch {
        # WSL check failed
    }
    
    return $status
}

function Show-Status {
    Show-Header "SYSTEM STATUS"
    
    $status = Get-SystemStatus
    
    # Process Status
    Write-Host "🔄 PROCESS STATUS" -ForegroundColor Yellow
    Write-Host "─────────────────────────────────────────────────────────────" -ForegroundColor Gray
    
    if ($status.Processes.Claude.Count -gt 0) {
        Write-MasterLog "Claude Desktop: $($status.Processes.Claude.Count) process(es)" 'SUCCESS'
        foreach ($proc in $status.Processes.Claude) {
            Write-Host "    - PID $($proc.Id): $($proc.Name) ($($proc.Memory) MB)" -ForegroundColor Gray
        }
    } else {
        Write-MasterLog "Claude Desktop: Not running" 'ERROR'
    }
    
    if ($status.Processes.Node.Count -gt 0) {
        Write-MasterLog "Node.js/MCP: $($status.Processes.Node.Count) process(es)" 'SUCCESS'
        foreach ($proc in $status.Processes.Node) {
            Write-Host "    - PID $($proc.Id): $($proc.Type) ($($proc.Memory) MB)" -ForegroundColor Gray
        }
    } else {
        Write-MasterLog "Node.js/MCP: Not running" 'ERROR'
    }
    
    if ($status.Processes.Bridge.Count -gt 0) {
        Write-MasterLog "Bridge: $($status.Processes.Bridge.Count) process(es)" 'SUCCESS'
    } else {
        Write-MasterLog "Bridge: Not running" 'WARN'
    }
    
    Write-Host ""
    
    # Network Status
    Write-Host "🌐 NETWORK STATUS" -ForegroundColor Yellow
    Write-Host "─────────────────────────────────────────────────────────────" -ForegroundColor Gray
    
    foreach ($port in $Global:Config.Ports) {
        if ($status.Ports[$port]) {
            Write-MasterLog "Port $port`: $($status.Ports[$port].Process) (PID $($status.Ports[$port].PID))" 'SUCCESS'
        } else {
            Write-MasterLog "Port $port`: Available" 'WARN'
        }
    }
    
    # MCP Status
    if ($status.MCP.Responding) {
        Write-MasterLog "MCP Server: Responding" 'SUCCESS'
        if ($status.MCP.Tools.Count -gt 0) {
            Write-MasterLog "Available Tools: $($status.MCP.Tools.Count)" 'SUCCESS'
            if ($Verbose) {
                foreach ($tool in $status.MCP.Tools) {
                    Write-Host "    ├─ $($tool.name)" -ForegroundColor Gray
                }
            }
        }
    } else {
        Write-MasterLog "MCP Server: Not responding" 'ERROR'
    }
    
    Write-Host ""
    
    # Bridge Status
    Write-Host "🔗 BRIDGE STATUS" -ForegroundColor Yellow
    Write-Host "─────────────────────────────────────────────────────────────" -ForegroundColor Gray
    
    foreach ($dir in $status.Bridge.Directories) {
        if ($dir.Exists) {
            Write-MasterLog "$($dir.Name): $($dir.FileCount) files" 'SUCCESS'
        } else {
            Write-MasterLog "$($dir.Name): Directory missing" 'ERROR'
        }
    }
    
    Write-Host ""
    
    # WSL Status
    Write-Host "🐧 WSL STATUS" -ForegroundColor Yellow
    Write-Host "─────────────────────────────────────────────────────────────" -ForegroundColor Gray
    
    if ($status.WSL.Running) {
        Write-MasterLog "WSL $($Global:Config.WSLDistribution): Running" 'SUCCESS'
        if ($status.WSL.ClaudeCode) {
            Write-MasterLog "Claude Code: Active in WSL" 'SUCCESS'
        } else {
            Write-MasterLog "Claude Code: Not detected in WSL" 'WARN'
        }
    } else {
        Write-MasterLog "WSL $($Global:Config.WSLDistribution): Not running" 'ERROR'
    }
    
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Magenta
}

function Start-Monitoring {
    while ($true) {
        Show-Status
        Write-Host ""
        Write-Host "Press Ctrl+C to exit. Refreshing in 5 seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }
}

function Invoke-DebugMode {
    Show-Header "DEBUG MODE"
    
    Write-MasterLog "Starting comprehensive debug session..." 'DEBUG'
    
    # Run system monitor
    Write-MasterLog "Launching system monitor..." 'DEBUG'
    Start-Process powershell -ArgumentList "-NoExit", "-Command", """& '$($Global:Config.ProjectDir)\scripts\claude-system-monitor.ps1' -Debug -Continuous"""
    
    # Run bridge monitor
    Write-MasterLog "Launching bridge monitor..." 'DEBUG'
    Start-Process powershell -ArgumentList "-NoExit", "-Command", """& '$($Global:Config.ProjectDir)\scripts\bridge-monitor.ps1' -Continuous"""
    
    # Run tool debugger
    Write-MasterLog "Launching tool call debugger..." 'DEBUG'
    Start-Process powershell -ArgumentList "-NoExit", "-Command", """& '$($Global:Config.ProjectDir)\scripts\tool-call-debugger.ps1' -Live"""
    
    Write-MasterLog "Debug monitors launched in separate windows" 'SUCCESS'
    Write-MasterLog "Press any key to continue..." 'DEBUG'
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

function Invoke-AutoFix {
    Show-Header "AUTO-FIX MODE"
    
    Write-MasterLog "Running automatic fixes..." 'DEBUG'
    
    # Run the system monitor with fix option
    & "$($Global:Config.ProjectDir)\scripts\claude-system-monitor.ps1" -Fix
    
    # Clean old bridge files
    & "$($Global:Config.ProjectDir)\scripts\bridge-monitor.ps1" -CleanOldFiles
    
    Write-MasterLog "Auto-fix completed" 'SUCCESS'
}

# Main execution
try {
    switch ($Action) {
        'start' {
            Show-Header "STARTING SERVICES"
            if (-not (Test-Prerequisites)) { exit 1 }
            if (-not (Initialize-Environment)) { exit 1 }
            Stop-AllServices
            if (Start-Services) {
                Write-MasterLog "All services started successfully" 'SUCCESS'
                if ($Continuous) { Start-Monitoring }
            } else {
                Write-MasterLog "Service startup incomplete" 'WARN'
            }
        }
        
        'stop' {
            Show-Header "STOPPING SERVICES"
            Stop-AllServices
            Write-MasterLog "All services stopped" 'SUCCESS'
        }
        
        'monitor' {
            Show-Header "MONITORING MODE"
            Start-Monitoring
        }
        
        'debug' {
            Invoke-DebugMode
        }
        
        'fix' {
            Invoke-AutoFix
        }
        
        'status' {
            Show-Status
        }
    }
} catch {
    Write-MasterLog "Script error: $($_.Exception.Message)" 'ERROR'
    exit 1
}

Write-Host ""
Write-Host "Master Control Options:" -ForegroundColor Cyan
Write-Host "  -Action start    : Initialize and start all services" -ForegroundColor Gray
Write-Host "  -Action stop     : Stop all running services" -ForegroundColor Gray
Write-Host "  -Action monitor  : Run continuous monitoring" -ForegroundColor Gray
Write-Host "  -Action debug    : Launch debug monitoring windows" -ForegroundColor Gray
Write-Host "  -Action fix      : Run automatic fixes" -ForegroundColor Gray
Write-Host "  -Action status   : Show current status (default)" -ForegroundColor Gray
Write-Host "  -AdminMode       : Request administrator privileges" -ForegroundColor Gray
Write-Host "  -Continuous      : Run in continuous mode" -ForegroundColor Gray
Write-Host "  -Verbose         : Show detailed information" -ForegroundColor Gray
Write-Host ""
Write-Host "Examples:" -ForegroundColor Cyan
Write-Host "  .\claude-master-control.ps1 -Action start -AdminMode" -ForegroundColor Gray
Write-Host "  .\claude-master-control.ps1 -Action monitor -Continuous" -ForegroundColor Gray
Write-Host "  .\claude-master-control.ps1 -Action debug -Verbose" -ForegroundColor Gray