#!/usr/bin/env powershell
# claude-system-monitor.ps1
# Comprehensive monitoring dashboard for Claude Desktop Extension system (v2 - Cleaned)

param(
    [switch]$Continuous = $false,
    [int]$RefreshInterval = 5,
    [switch]$Debug = $false
)

# --- Configuration ---
$Global:Config = @{
    ClaudeDesktopPath     = "$env:LOCALAPPDATA\Claude\Claude.exe"
    ClaudeConfigPath      = "$env:APPDATA\Claude\claude_desktop_config.json"
    BridgeDir             = "C:\Users\dimas\claude-bridge"
    WSLDistribution       = "Ubuntu-24.04"
    PortsToMonitor        = @{
        "4323" = "MCP Server"
        "4322" = "Browser Tools"
        "4324" = "Dev Hub"
    }
    ProcessesToMonitor    = @{
        "Claude"          = "Claude Desktop"
        "node"            = "Node.js (MCP)"
    }
}

# --- Helper Functions ---

function Write-Header {
    param([string]$Title)
    Write-Host ("-" * 60)
    Write-Host $Title -ForegroundColor Cyan
    Write-Host ("-" * 60)
}

function Write-StatusLine {
    param(
        [string]$Label,
        [string]$Status,
        [string]$Color
    )
    $padding = 40 - $Label.Length
    if ($padding -lt 1) { $padding = 1 }
    $padString = " " * $padding
    Write-Host "$($Label)$padString : " -NoNewline
    Write-Host $Status -ForegroundColor $Color
}

# Import the Node.js logger if available
function Log-ToUnified {
    param (
        [string]$Source = "SYSTEM_MONITOR",
        [string]$Event,
        [string]$Message,
        [hashtable]$Data = @{}
    )
    
    $logDir = Join-Path $PSScriptRoot "..\logs"
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    
    $unifiedLog = Join-Path $logDir "unified-monitoring.log"
    
    $timestamp = Get-Date -Format "o"
    $logEntry = @{
        timestamp = $timestamp
        source = $Source
        event = $Event
        message = $Message
        data = $Data
    } | ConvertTo-Json -Compress
    
    $formattedEntry = "[$timestamp] [$Source] [$Event] $logEntry"
    Add-Content -Path $unifiedLog -Value $formattedEntry
}

function Get-ProcessStatus {
    Write-Header "PROCESS STATUS"
    foreach ($procName in $Global:Config.ProcessesToMonitor.Keys) {
        try {
            $process = Get-Process -Name $procName -ErrorAction SilentlyContinue
            if ($process) {
                Write-StatusLine -Label $Global:Config.ProcessesToMonitor[$procName] -Status "Running (PID: $($process.Id))" -Color Green
            } else {
                Write-StatusLine -Label $Global:Config.ProcessesToMonitor[$procName] -Status "Not Running" -Color Red
            }
        } catch {
            Write-StatusLine -Label "Error checking $($procName)" -Status $_.Exception.Message -Color Red
        }
    }
}

function Get-PortStatus {
    Write-Header "PORT CONNECTIONS"
    try {
        $connections = Get-NetTCPConnection -State Listen,Established | Select-Object LocalPort, OwningProcess, State
        foreach ($port in $Global:Config.PortsToMonitor.Keys) {
            $portNumber = [int]$port
            $conn = $connections | Where-Object { $_.LocalPort -eq $portNumber } | Select-Object -First 1

            if ($conn) {
                $procName = (Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue).ProcessName
                $statusText = "$($procName) (PID $($conn.OwningProcess)) - $($conn.State)"
                Write-StatusLine -Label "Port $port ($($Global:Config.PortsToMonitor[$port]))" -Status $statusText -Color Green
            } else {
                Write-StatusLine -Label "Port $port ($($Global:Config.PortsToMonitor[$port]))" -Status "Available / Not in use" -Color Yellow
            }
        }
    } catch {
        Write-Host "Could not get port info. Run as Administrator." -ForegroundColor Red
    }
}

function Get-FileSystemStatus {
    Write-Header "FILE SYSTEM & CONFIG"
    # Check for Claude Desktop Config
    $claudeConfig = $Global:Config.ClaudeConfigPath
    if (Test-Path $claudeConfig) {
        Write-StatusLine -Label "Claude Config" -Status "Found" -Color Green
        try {
            $configContent = Get-Content $claudeConfig | ConvertFrom-Json
            $mcpPath = $configContent.mcpServers.'custom-extension'.args[0]
            if (Test-Path $mcpPath) {
                Write-Host "  + MCP Server Path: $mcpPath" -ForegroundColor Gray
            } else {
                Write-Host "  - MCP Server Path: $mcpPath (MISSING!)" -ForegroundColor Red
            }
        } catch {
            Write-Host "  - Could not parse config JSON." -ForegroundColor Red
        }
    } else {
        Write-StatusLine -Label "Claude Config" -Status "MISSING!" -Color Red
    }

    # Check Bridge Directory
    $bridgeDir = $Global:Config.BridgeDir
    if (Test-Path $bridgeDir) {
        Write-StatusLine -Label "Bridge Directory" -Status "Found" -Color Green
        $files = Get-ChildItem -Path $bridgeDir | Measure-Object
        Write-Host "  + Contains $($files.Count) items." -ForegroundColor Gray
    } else {
        Write-StatusLine -Label "Bridge Directory" -Status "MISSING!" -Color Red
    }
}

function Get-WslStatus {
    Write-Header "WSL (CLAUDE CODE) STATUS"
    try {
        $wslStatus = wsl -l -v | Where-Object { $_ -match $Global:Config.WSLDistribution }
        if ($wslStatus -match 'Running') {
            Write-StatusLine -Label "WSL Distro ($($Global:Config.WSLDistribution))" -Status "Running" -Color Green

            # Check for claude process inside WSL
            $claudeCheck = wsl -d $Global:Config.WSLDistribution -e -- bash -c "pgrep -f claude" 2>$null
            if ($claudeCheck) {
                Write-StatusLine -Label "Claude Code Process" -Status "Running" -Color Green
            } else {
                Write-StatusLine -Label "Claude Code Process" -Status "Not Detected" -Color Yellow
            }
        } else {
            Write-StatusLine -Label "WSL Distro ($($Global:Config.WSLDistribution))" -Status "Stopped" -Color Red
        }
    } catch {
        Write-StatusLine -Label "WSL Check" -Status "Failed to execute 'wsl' command." -Color Red
    }
}

function Get-SystemInfo {
    $processes = Get-Process claude,node -ErrorAction SilentlyContinue | 
        Select-Object Name, Id, CPU, WorkingSet, StartTime, 
        @{Name="ThreadCount";Expression={$_.Threads.Count}},
        @{Name="HandleCount";Expression={$_.HandleCount}}
    
    $cpuLoad = (Get-WmiObject Win32_Processor).LoadPercentage
    $memoryInfo = Get-WmiObject Win32_OperatingSystem
    $freeMemory = [math]::Round($memoryInfo.FreePhysicalMemory / 1MB, 2)
    $totalMemory = [math]::Round($memoryInfo.TotalVisibleMemorySize / 1MB, 2)
    
    return @{
        timestamp = Get-Date -Format "o"
        processes = $processes | ForEach-Object {
            @{
                name = $_.Name
                id = $_.Id
                cpu = $_.CPU
                memory_mb = [math]::Round($_.WorkingSet / 1MB, 2)
                threads = $_.ThreadCount
                handles = $_.HandleCount
                runtime = if ($_.StartTime) {
                    [math]::Round(((Get-Date) - $_.StartTime).TotalMinutes, 2)
                } else { 0 }
            }
        }
        system = @{
            cpu_load = $cpuLoad
            free_memory_mb = $freeMemory
            total_memory_mb = $totalMemory
            memory_usage_percent = [math]::Round(100 - (($freeMemory / $totalMemory) * 100), 2)
        }
    }
}

function Invoke-Monitor {
    Clear-Host
    Write-Host "--- Claude System Monitor --- $(Get-Date) ---" -ForegroundColor Magenta
    if ($Continuous) {
        Write-Host " (Press CTRL+C to stop)"
    }
    Write-Host ""

    Get-ProcessStatus
    Write-Host ""
    Get-PortStatus
    Write-Host ""
    Get-FileSystemStatus
    Write-Host ""
    Get-WslStatus
    Write-Host ""
    Write-Host ("-" * 60)
}

# --- Main Execution ---

if ($Continuous) {
    while ($true) {
        Invoke-Monitor
        Start-Sleep -Seconds $RefreshInterval
    }
} else {
    Invoke-Monitor
}

while ($true) {
    $systemInfo = Get-SystemInfo
    
    # Display for the user
    # ... your existing display code ...
    
    # Log to unified log
    Log-ToUnified -Event "PERIODIC_UPDATE" -Message "System status update" -Data $systemInfo
    
    if ($Continuous) {
        Start-Sleep -Seconds 5
        Clear-Host
    } else {
        break
    }
}