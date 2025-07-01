param (
    [switch]$Continuous
)

$scriptDir = Split-Path -Parent $PSScriptRoot
$appDataDir = [System.Environment]::GetFolderPath('ApplicationData')
$logFilePath = Join-Path $appDataDir "Claude\logs\system-events.log"
$fallbackLogPath = Join-Path $scriptDir "logs\system-events.log"

function Show-SystemEvents {
    Clear-Host
    Write-Host "Claude Automation - System Events Monitor" -ForegroundColor Green
    Write-Host "=======================================" -ForegroundColor Green
    Write-Host ""
    
    # Try APPDATA location first, fall back to project directory
    if (Test-Path $logFilePath) {
        $logFile = $logFilePath
    } elseif (Test-Path $fallbackLogPath) {
        $logFile = $fallbackLogPath
    } else {
        Write-Host "System events log not found at:" -ForegroundColor Yellow
        Write-Host "  - $logFilePath" -ForegroundColor Yellow
        Write-Host "  - $fallbackLogPath" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "No system events have been recorded yet. The log will be created when events occur." -ForegroundColor Yellow
        return
    }
    
    # Get the last 20 events from the log file
    try {
        $content = Get-Content $logFile -Tail 20 -ErrorAction Stop
        
        if ($content.Count -eq 0) {
            Write-Host "Log file exists but contains no events yet." -ForegroundColor Yellow
            return
        }
        
        foreach ($line in $content) {
            try {
                $event = $line | ConvertFrom-Json
                
                # Format timestamp
                $timestamp = [DateTime]::Parse($event.timestamp).ToString("yyyy-MM-dd HH:mm:ss")
                
                # Color code by source
                $sourceColor = switch ($event.source) {
                    "MCP_SERVER" { "Cyan" }
                    "BRIDGE" { "Magenta" }
                    "WSL" { "Yellow" }
                    default { "White" }
                }
                
                # Color code by event type
                $eventColor = switch -Wildcard ($event.event) {
                    "*ERROR*" { "Red" }
                    "*TOOL_CALL*" { "Green" }
                    "*REQUEST*" { "Blue" }
                    "*RESPONSE*" { "DarkGreen" }
                    default { "Gray" }
                }
                
                # Display the event header
                Write-Host "[$timestamp]" -NoNewline -ForegroundColor DarkGray
                Write-Host " [" -NoNewline -ForegroundColor DarkGray
                Write-Host "$($event.source)" -NoNewline -ForegroundColor $sourceColor
                Write-Host "] " -NoNewline -ForegroundColor DarkGray
                Write-Host "$($event.event)" -ForegroundColor $eventColor
                
                # Display the event data
                if ($event.data) {
                    $dataJson = $event.data | ConvertTo-Json -Depth 3
                    $indentedData = $dataJson -split "`n" | ForEach-Object { "  $_" }
                    Write-Host ($indentedData -join "`n") -ForegroundColor White
                }
                
                Write-Host "" # Empty line between events
            }
            catch {
                Write-Host "Error parsing event: $_" -ForegroundColor Red
                Write-Host "Raw line: $line" -ForegroundColor Gray
                Write-Host ""
            }
        }
    }
    catch {
        Write-Host "Error reading log file: $_" -ForegroundColor Red
    }
}

if ($Continuous) {
    Write-Host "Starting continuous system events monitor. Press Ctrl+C to exit." -ForegroundColor Yellow
    
    while ($true) {
        Show-SystemEvents
        Start-Sleep -Seconds 2
    }
}
else {
    Show-SystemEvents
}
