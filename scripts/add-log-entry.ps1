param (
    [Parameter(Mandatory=$true)]
    [string]$Source,
    
    [Parameter(Mandatory=$true)]
    [string]$Event,
    
    [Parameter(Mandatory=$false)]
    [string]$Message = "",
    
    [Parameter(Mandatory=$false)]
    [hashtable]$Data = @{},
    
    [switch]$AppendToSystemEvents
)

$scriptDir = Split-Path -Parent $PSScriptRoot
$logsDir = Join-Path $scriptDir "logs"
$unifiedLogPath = Join-Path $logsDir "unified-monitoring.log"

# Ensure logs directory exists
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

# Add message to data if provided
if (-not [string]::IsNullOrEmpty($Message)) {
    $Data["message"] = $Message
}

# Create the log entry
$timestamp = (Get-Date).ToString("o")
$logEntry = @{
    timestamp = $timestamp
    source = $Source
    event = $Event
    data = $Data
} | ConvertTo-Json -Compress

# Format for unified log
$formattedEntry = "[$timestamp] [$Source] [$Event] $logEntry"

# Append to unified log
Add-Content -Path $unifiedLogPath -Value $formattedEntry -Encoding utf8

# Also append to system events log if requested
if ($AppendToSystemEvents) {
    $appDataDir = [System.Environment]::GetFolderPath('ApplicationData')
    $systemEventsPath = Join-Path $appDataDir "Claude\logs\system-events.log"
    
    if (Test-Path (Split-Path -Parent $systemEventsPath)) {
        Add-Content -Path $systemEventsPath -Value $logEntry -Encoding utf8
    }
}

Write-Host "Added log entry: [$Source] [$Event] $Message" -ForegroundColor Cyan
