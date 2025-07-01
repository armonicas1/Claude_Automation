param (
    [string]$LogName = "system-events",
    [int]$Lines = 20,
    [switch]$Continuous
)

$appDataDir = [System.Environment]::GetFolderPath('ApplicationData')
$scriptDir = Split-Path -Parent $PSScriptRoot

# Define log paths
$logPaths = @{
    "system-events" = @(
        (Join-Path $appDataDir "Claude\logs\system-events.log"),
        (Join-Path $scriptDir "logs\system-events.log")
    )
    "bridge" = @(
        (Join-Path $scriptDir "logs\bridge.log")
    )
    "mcp" = @(
        (Join-Path $appDataDir "Claude\logs\mcp-server-custom-extension.log")
    )
    "desktop" = @(
        (Join-Path $appDataDir "Claude\logs\main.log")
    )
    "debug" = @(
        (Join-Path $appDataDir "Claude\logs\debug.log")
    )
}

function Show-LogContent {
    param (
        [string]$LogName
    )
    
    Clear-Host
    Write-Host "Claude Automation - $LogName Log Viewer" -ForegroundColor Green
    Write-Host "=======================================" -ForegroundColor Green
    Write-Host ""
    
    $foundLog = $false
    
    foreach ($logPath in $logPaths[$LogName]) {
        if (Test-Path $logPath) {
            Write-Host "Reading from: $logPath" -ForegroundColor Cyan
            Write-Host "-----------------------------------" -ForegroundColor Cyan
            
            $content = Get-Content $logPath -Tail $Lines -ErrorAction SilentlyContinue
            
            if ($content) {
                # Special handling for system-events logs which are JSON
                if ($LogName -eq "system-events") {
                    foreach ($line in $content) {
                        try {
                            $event = $line | ConvertFrom-Json
                            Write-Host "[$($event.timestamp)] [$($event.source)] $($event.event)" -ForegroundColor Cyan
                            
                            if ($event.data) {
                                $dataStr = $event.data | ConvertTo-Json -Depth 3
                                $indentedData = $dataStr -split "`n" | ForEach-Object { "  $_" }
                                Write-Host ($indentedData -join "`n") -ForegroundColor White
                            }
                            
                            Write-Host ""
                        } catch {
                            Write-Host "Raw log entry: $line" -ForegroundColor Gray
                        }
                    }
                } else {
                    # For non-JSON logs, just display the lines
                    $content | ForEach-Object {
                        Write-Host $_ -ForegroundColor White
                    }
                }
                
                $foundLog = $true
                break
            } else {
                Write-Host "Log file exists but is empty." -ForegroundColor Yellow
                $foundLog = $true
            }
        }
    }
    
    if (-not $foundLog) {
        Write-Host "No log file found for $LogName at:" -ForegroundColor Yellow
        foreach ($logPath in $logPaths[$LogName]) {
            Write-Host "  - $logPath" -ForegroundColor Yellow
        }
        Write-Host ""
        Write-Host "Available log types:" -ForegroundColor Cyan
        foreach ($key in $logPaths.Keys) {
            Write-Host "  - $key" -ForegroundColor Cyan
        }
    }
}

if ($Continuous) {
    Write-Host "Starting continuous log monitoring for $LogName. Press Ctrl+C to exit." -ForegroundColor Yellow
    
    while ($true) {
        Show-LogContent -LogName $LogName
        Start-Sleep -Seconds 2
    }
} else {
    Show-LogContent -LogName $LogName
}
