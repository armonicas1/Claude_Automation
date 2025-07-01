#!/usr/bin/env powershell
# bridge-monitor.ps1 (v2.2 - Syntax Corrected)
# Monitor file-based bridge communication between Claude Desktop and Claude Code

param(
    [switch]$Continuous = $false,
    [int]$RefreshInterval = 2,
    [switch]$CreateTestTrigger = $false,
    [switch]$CleanOldFiles = $false
)

$bridgeDir = "$env:USERPROFILE\claude-bridge"
$claudeDir = "$env:APPDATA\Claude"

# Import the Node.js logger if available
function Log-ToUnified {
    param (
        [string]$Source = "BRIDGE_MONITOR",
        [string]$Event,
        [string]$Message,
        [hashtable]$Data = @{
        }
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

function Write-BridgeLog {
    param($Message, $Level = 'INFO')
    $timestamp = Get-Date -Format "HH:mm:ss.fff"
    $color = switch ($Level) {
        'ERROR' { 'Red' }
        'WARN' { 'Yellow' }
        'SUCCESS' { 'Green' }
        'DEBUG' { 'Cyan' }
        'TRIGGER' { 'Magenta' }
        default { 'White' }
    }
    Write-Host "[$timestamp] [$Level] $Message" -ForegroundColor $color
}

function Initialize-BridgeDirectories {
    $directories = @(
        $bridgeDir,
        "$bridgeDir\pending",
        "$bridgeDir\completed", 
        "$claudeDir\code_triggers",
        "$claudeDir\code_requests",
        "$claudeDir\code_responses"
    )
    
    $created = 0
    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            Write-BridgeLog "Creating directory: $dir" 'DEBUG'
            New-Item -Path $dir -ItemType Directory -Force | Out-Null
            $created++
        }
    }
    
    if ($created -gt 0) {
        Write-BridgeLog "Created $created missing directories" 'SUCCESS'
    }
}

function Get-BridgeStatus {
    $status = @{
        Directories = @()
        RecentFiles = @()
    }
    
    # Check directory status
    $monitorDirs = @(
        @{ Path = "$bridgeDir\pending"; Name = "Pending Requests" },
        @{ Path = "$bridgeDir\completed"; Name = "Completed Actions" },
        @{ Path = "$claudeDir\code_triggers"; Name = "Code Triggers" },
        @{ Path = "$claudeDir\code_requests"; Name = "Code Requests" },
        @{ Path = "$claudeDir\code_responses"; Name = "Code Responses" }
    )
    
    foreach ($dir in $monitorDirs) {
        $dirInfo = @{
            Name = $dir.Name
            Path = $dir.Path
            Exists = Test-Path $dir.Path
            FileCount = 0
            Files = @()
        }
        
        if ($dirInfo.Exists) {
            $files = Get-ChildItem $dir.Path -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
            $dirInfo.FileCount = $files.Count
            $dirInfo.Files = $files | Select-Object -First 5 | ForEach-Object {
                @{
                    Name = $_.Name
                    Size = $_.Length
                    Modified = $_.LastWriteTime
                    Age = (Get-Date) - $_.LastWriteTime
                }
            }
        }
        
        $status.Directories += $dirInfo
    }
    
    # Check for recent activity (last 5 minutes)
    $recentThreshold = (Get-Date).AddMinutes(-5)
    foreach ($dir in $monitorDirs) {
        if (Test-Path $dir.Path) {
            $recentFiles = Get-ChildItem $dir.Path -File | Where-Object { $_.LastWriteTime -gt $recentThreshold }
            foreach ($file in $recentFiles) {
                $status.RecentFiles += @{
                    Directory = $dir.Name
                    File = $file.Name
                    Modified = $file.LastWriteTime
                    Size = $file.Length
                }
            }
        }
    }
    
    return $status
}

function Get-BridgeInfo {
    $bridgeDir = Join-Path $env:APPDATA 'Claude\python-bridge'
    
    $pendingCount = (Get-ChildItem $bridgeDir\pending -ErrorAction SilentlyContinue).Count
    $completedCount = (Get-ChildItem $bridgeDir\completed -ErrorAction SilentlyContinue).Count
    $failedCount = (Get-ChildItem $bridgeDir\failed -ErrorAction SilentlyContinue).Count
    
    # Get the most recent files in each directory
    $pendingFiles = Get-ChildItem $bridgeDir\pending -ErrorAction SilentlyContinue | 
        Sort-Object LastWriteTime -Descending | 
        Select-Object -First 3 | 
        ForEach-Object { @{name = $_.Name; modified = $_.LastWriteTime} }
    
    $completedFiles = Get-ChildItem $bridgeDir\completed -ErrorAction SilentlyContinue | 
        Sort-Object LastWriteTime -Descending | 
        Select-Object -First 3 |
        ForEach-Object { @{name = $_.Name; modified = $_.LastWriteTime} }
    
    $failedFiles = Get-ChildItem $bridgeDir\failed -ErrorAction SilentlyContinue | 
        Sort-Object LastWriteTime -Descending | 
        Select-Object -First 3 |
        ForEach-Object { @{name = $_.Name; modified = $_.LastWriteTime} }
    
    # Get recent log entries
    $bridgeLog = Join-Path $PSScriptRoot '..\logs\bridge.log'
    $recentLogEntries = if (Test-Path $bridgeLog) {
        Get-Content $bridgeLog -Tail 5
    } else {
        @("Bridge log not found")
    }
    
    return @{
        timestamp = Get-Date -Format "o"
        counts = @{
            pending = $pendingCount
            completed = $completedCount
            failed = $failedCount
        }
        recent_files = @{
            pending = $pendingFiles
            completed = $completedFiles
            failed = $failedFiles
        }
        recent_logs = $recentLogEntries
    }
}

function Show-BridgeMonitor {
    Clear-Host
    
    Write-Host "============================================================" -ForegroundColor Magenta
    Write-Host "            BRIDGE COMMUNICATION MONITOR               " -ForegroundColor Magenta
    Write-Host "============================================================" -ForegroundColor Magenta
    Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor White
    Write-Host ""
    
    $status = Get-BridgeStatus
    
    # Directory Status
    Write-Host "[+] BRIDGE DIRECTORIES" -ForegroundColor Yellow
    Write-Host "------------------------------------------------------------" -ForegroundColor Gray
    
    foreach ($dir in $status.Directories) {
        $statusText = if ($dir.Exists) { "[OK]" } else { "[MISSING]" }
        $statusColor = if ($dir.Exists) { 'Green' } else { 'Red' }
        $fileInfo = if ($dir.Exists) { "$($dir.FileCount) files" } else { "" }
        
        Write-Host "  $($statusText) " -ForegroundColor $statusColor -NoNewline
        Write-Host "$($dir.Name) - $fileInfo" -ForegroundColor White
        
        # Show recent files in directory
        if ($dir.Files.Count -gt 0) {
            foreach ($file in $dir.Files) {
                $ageText = if ($file.Age.TotalMinutes -lt 1) { "just now" } 
                          elseif ($file.Age.TotalMinutes -lt 60) { "$([int]$file.Age.TotalMinutes)m ago" }
                          else { "$([int]$file.Age.TotalHours)h ago" }
                
                Write-Host "    |- $($file.Name) ($($file.Size) bytes, $ageText)" -ForegroundColor Gray
            }
        }
    }
    
    Write-Host ""
    
    # Recent Activity
    if ($status.RecentFiles.Count -gt 0) {
        Write-Host "[~] RECENT ACTIVITY (Last 5 minutes)" -ForegroundColor Yellow
        Write-Host "------------------------------------------------------------" -ForegroundColor Gray
        
        $sortedActivity = $status.RecentFiles | Sort-Object Modified -Descending
        foreach ($activity in $sortedActivity) {
            $age = (Get-Date) - $activity.Modified
            $ageText = if ($age.TotalSeconds -lt 60) { "$([int]$age.TotalSeconds)s ago" } else { "$([int]$age.TotalMinutes)m ago" }
            
            Write-BridgeLog "$($activity.Directory): $($activity.File) ($ageText)" 'TRIGGER'
        }
    } else {
        Write-Host "[~] RECENT ACTIVITY" -ForegroundColor Yellow
        Write-Host "------------------------------------------------------------" -ForegroundColor Gray
        Write-BridgeLog "No recent activity detected" 'WARN'
    }
    
    Write-Host ""
    
    # Bridge Process Status
    Write-Host "[#] BRIDGE PROCESS STATUS" -ForegroundColor Yellow
    Write-Host "------------------------------------------------------------" -ForegroundColor Gray
    
    $bridgeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine -like "*bridge*"
    }
    
    if ($bridgeProcesses.Count -gt 0) {
        foreach ($proc in $bridgeProcesses) {
            $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
            Write-BridgeLog "Bridge Process: PID $($proc.Id) - Memory: $([math]::Round($proc.WorkingSet / 1MB, 2))MB" 'SUCCESS'
            Write-Host "    Command: $cmdLine" -ForegroundColor Gray
        }
    } else {
        Write-BridgeLog "No bridge processes detected" 'WARN'
        Write-Host "    Consider running: .\start-claude-admin-with-monitoring.ps1" -ForegroundColor Gray
    }
    
    Write-Host ""
    
    # WSL Connection Status
    Write-Host "[WSL] CONNECTION STATUS" -ForegroundColor Yellow
    Write-Host "------------------------------------------------------------" -ForegroundColor Gray
    
    try {
        $wslStatus = wsl -l -v 2>$null
        $ubuntuRunning = $wslStatus | Select-String "Ubuntu.*Running"
        
        if ($ubuntuRunning) {
            Write-BridgeLog "WSL Ubuntu: Running" 'SUCCESS'
            
            # Test bridge directory access from WSL
            $username = $env:USERNAME.ToLower()
            wsl -d Ubuntu-24.04 -e test -d "/mnt/c/Users/$username/claude-bridge" 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-BridgeLog "WSL Bridge Access: OK" 'SUCCESS'
            } else {
                Write-BridgeLog "WSL Bridge Access: Failed" 'ERROR'
            }
            
            # Check Claude Code status
            $claudeStatus = wsl -d Ubuntu-24.04 -e bash -c "ps aux | grep claude | grep -v grep" 2>$null
            if ($claudeStatus) {
                Write-BridgeLog "Claude Code: Running in WSL" 'SUCCESS'
            } else {
                Write-BridgeLog "Claude Code: Not detected in WSL" 'WARN'
            }
        } else {
            Write-BridgeLog "WSL Ubuntu: Not running" 'ERROR'
        }
    } catch {
        Write-BridgeLog "WSL Status: Cannot determine ($($_.Exception.Message))" 'ERROR'
    }
    
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Magenta
    
    if ($Continuous) {
        Write-Host ""
        Write-Host "Press Ctrl+C to exit. Refreshing in $RefreshInterval seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds $RefreshInterval
    }
}

function New-TestTrigger {
    $triggerId = "test-trigger-$(Get-Date -Format 'yyyyMMddHHmmss')"
    $triggerContent = @{
        id = $triggerId
        action = "test_communication"
        params = @{
            message = "Bridge communication test from PowerShell monitor"
            timestamp = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
        }
        status = "pending"
        created = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    } | ConvertTo-Json -Depth 10
    
    $triggerFile = "$claudeDir\code_triggers\$triggerId.json"
    
    try {
        $triggerContent | Out-File -FilePath $triggerFile -Encoding utf8
        Write-BridgeLog "Created test trigger: $triggerId" 'SUCCESS'
        Write-BridgeLog "File: $triggerFile" 'DEBUG'
        return $triggerId
    } catch {
        Write-BridgeLog "Failed to create test trigger: $($_.Exception.Message)" 'ERROR'
        return $null
    }
}

function Remove-OldFiles {
    $cutoffTime = (Get-Date).AddHours(-24)
    $removed = 0
    
    $cleanupDirs = @(
        "$bridgeDir\pending",
        "$bridgeDir\completed",
        "$claudeDir\code_triggers",
        "$claudeDir\code_requests",
        "$claudeDir\code_responses"
    )
    
    foreach ($dir in $cleanupDirs) {
        if (Test-Path $dir) {
            $oldFiles = Get-ChildItem $dir -File | Where-Object { $_.LastWriteTime -lt $cutoffTime }
            foreach ($file in $oldFiles) {
                try {
                    Remove-Item $file.FullName -Force
                    $removed++
                    Write-BridgeLog "Removed old file: $($file.Name)" 'DEBUG'
                } catch {
                    Write-BridgeLog "Failed to remove: $($file.Name)" 'ERROR'
                }
            }
        }
    }
    
    if ($removed -gt 0) {
        Write-BridgeLog "Cleaned up $removed old files" 'SUCCESS'
    } else {
        Write-BridgeLog "No old files to clean up" 'INFO'
    }
}

# Main execution
try {
    Write-BridgeLog "Starting Bridge Monitor..." 'INFO'
    
    # Initialize directories
    Initialize-BridgeDirectories
    
    # Clean old files if requested
    if ($CleanOldFiles) {
        Remove-OldFiles
    }
    
    # Create test trigger if requested
    if ($CreateTestTrigger) {
        $testId = New-TestTrigger
        if ($testId) {
            Write-BridgeLog "Monitor the bridge logs to see if the test trigger is processed" 'INFO'
        }
    }
    
    # Main monitoring loop
    if ($Continuous) {
        while ($true) {
            Show-BridgeMonitor
            
            $bridgeInfo = Get-BridgeInfo
            
            # Log to unified log
            Log-ToUnified -Event "PERIODIC_UPDATE" -Message "Bridge status update" -Data $bridgeInfo
        }
    } else {
        Show-BridgeMonitor
    }
} catch {
    Write-BridgeLog "Monitor error: $($_.Exception.Message)" 'ERROR'
}
# The finally block was removed from the main execution as it was causing issues
# and the "stopped" message is implicitly understood when the script exits.

# Show usage information
Write-Host ""
Write-Host "Bridge Monitor Options:" -ForegroundColor Cyan
Write-Host "  -Continuous         : Run continuously with auto-refresh" -ForegroundColor Gray
Write-Host "  -RefreshInterval <n>: Refresh every n seconds (default: 2)" -ForegroundColor Gray
Write-Host "  -CreateTestTrigger  : Create a test trigger file" -ForegroundColor Gray
Write-Host "  -CleanOldFiles      : Remove files older than 24 hours" -ForegroundColor Gray
Write-Host ""
Write-Host "Examples:" -ForegroundColor Cyan
Write-Host "  .\bridge-monitor.ps1 -Continuous" -ForegroundColor Gray
Write-Host "  .\bridge-monitor.ps1 -CreateTestTrigger" -ForegroundColor Gray
Write-Host "  .\bridge-monitor.ps1 -CleanOldFiles -Continuous" -ForegroundColor Gray