param (
    [int]$Lines = 50,
    [switch]$Continuous,
    [int]$RefreshInterval = 2,
    [string]$Filter = "",
    [string]$Source = "",
    [string]$Event = ""
)

$scriptDir = Split-Path -Parent $PSScriptRoot
$logsDir = Join-Path $scriptDir "logs"
$logFilePath = Join-Path $logsDir "unified-monitoring.log"

# Ensure logs directory exists
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

# Create an empty log file if it doesn't exist
if (-not (Test-Path $logFilePath)) {
    $timestamp = (Get-Date).ToString("o")
    $initialEntry = "[$timestamp] [UNIFIED_LOG_VIEWER] [INITIALIZATION] {`"timestamp`":`"$timestamp`",`"source`":`"UNIFIED_LOG_VIEWER`",`"event`":`"INITIALIZATION`",`"data`":{`"message`":`"Unified log initialized`"}}"
    Set-Content -Path $logFilePath -Value $initialEntry -Encoding utf8
    Write-Host "Created new unified log file at: $logFilePath" -ForegroundColor Yellow
}

function Format-JsonString {
    param ([string]$JsonString)
    
    try {
        $jsonObj = $JsonString | ConvertFrom-Json -ErrorAction Stop
        return ($jsonObj | ConvertTo-Json -Depth 4)
    }
    catch {
        return $JsonString
    }
}

function Show-LogContent {
    param (
        [switch]$NoClear
    )
    
    if (-not $NoClear) {
        Clear-Host
    }
    
    Write-Host "Claude Automation - Unified Monitoring Log Viewer" -ForegroundColor Green
    Write-Host "=================================================" -ForegroundColor Green
    
    if (-not [string]::IsNullOrEmpty($Filter)) {
        Write-Host "Filter: $Filter" -ForegroundColor Yellow
    }
    if (-not [string]::IsNullOrEmpty($Source)) {
        Write-Host "Source: $Source" -ForegroundColor Yellow
    }
    if (-not [string]::IsNullOrEmpty($Event)) {
        Write-Host "Event: $Event" -ForegroundColor Yellow
    }
    
    Write-Host ""
    
    if (Test-Path $logFilePath) {
        $content = Get-Content $logFilePath -Tail $Lines -ErrorAction SilentlyContinue
        
        if ($content) {
            $filteredContent = $content
            
            # Apply filters if specified
            if (-not [string]::IsNullOrEmpty($Filter)) {
                $filteredContent = $filteredContent | Where-Object { $_ -match $Filter }
            }
            if (-not [string]::IsNullOrEmpty($Source)) {
                $filteredContent = $filteredContent | Where-Object { $_ -match "\[$Source\]" }
            }
            if (-not [string]::IsNullOrEmpty($Event)) {
                $filteredContent = $filteredContent | Where-Object { $_ -match "\[$Event\]" }
            }
            
            if ($filteredContent.Count -eq 0) {
                Write-Host "No log entries match the current filters" -ForegroundColor Yellow
                return
            }
            
            foreach ($line in $filteredContent) {
                # Extract and format the timestamp, source, and event
                if ($line -match '\[([^]]+)\] \[([^]]+)\] \[([^]]+)\]') {
                    $timestamp = $matches[1]
                    $source = $matches[2]
                    $event = $matches[3]
                    
                    # Colorize based on source
                    $sourceColor = switch ($source) {
                        "MCP_SERVER" { "Cyan" }
                        "BRIDGE" { "Magenta" }
                        "TOOL_CALL" { "Green" }
                        "TOOL_DEBUGGER" { "Yellow" }
                        "SYSTEM_MONITOR" { "Blue" }
                        "DESKTOP_GATEWAY" { "DarkYellow" }
                        "UNIFIED_LOG_VIEWER" { "Gray" }
                        "MONITORING_TOOLS" { "White" }
                        default { "White" }
                    }
                    
                    # Colorize based on event
                    $eventColor = switch -Wildcard ($event) {
                        "*ERROR*" { "Red" }
                        "*TOOL_CALL*" { "Green" }
                        "*REQUEST*" { "Blue" }
                        "*RESPONSE*" { "DarkGreen" }
                        "*PERIODIC*" { "Gray" }
                        "*INITIALIZATION*" { "Cyan" }
                        "*STARTUP*" { "Cyan" }
                        default { "White" }
                    }
                    
                    # Extract JSON if present
                    $jsonStartIndex = $line.IndexOf('{')
                    $headerContent = if ($jsonStartIndex -gt 0) { $line.Substring(0, $jsonStartIndex) } else { $line }
                    $jsonContent = if ($jsonStartIndex -gt 0) { $line.Substring($jsonStartIndex) } else { "" }
                    
                    # Display the log entry header
                    Write-Host $headerContent -NoNewline
                    
                    # Display the JSON content (formatted if possible)
                    if (-not [string]::IsNullOrEmpty($jsonContent)) {
                        Write-Host (Format-JsonString $jsonContent)
                    }
                    else {
                        Write-Host ""
                    }
                    
                    # Add a separator line
                    Write-Host "-----------------------------------------------" -ForegroundColor DarkGray
                }
                else {
                    # If line doesn't match the expected format, print it as is
                    Write-Host $line
                    Write-Host "-----------------------------------------------" -ForegroundColor DarkGray
                }
            }
        }
        else {
            Write-Host "Log file exists but is empty" -ForegroundColor Yellow
            Write-Host "Waiting for log entries to be added..." -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "Log file not found at:" -ForegroundColor Red
        Write-Host "  $logFilePath" -ForegroundColor Red
        Write-Host ""
        Write-Host "Waiting for log file to be created..." -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Press Ctrl+C to exit" -ForegroundColor DarkGray
}

if ($Continuous) {
    Write-Host "Starting continuous monitoring. Press Ctrl+C to exit." -ForegroundColor Yellow
    
    while ($true) {
        Show-LogContent
        Start-Sleep -Seconds $RefreshInterval
    }
}
else {
    Show-LogContent
}
