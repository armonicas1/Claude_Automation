param (
    [Parameter(Mandatory=$true)]
    [string]$Source,
    
    [Parameter(Mandatory=$true)]
    [string]$Event,
    
    [Parameter(Mandatory=$false)]
    [string]$Data = "{}"
)

$appDataDir = [System.Environment]::GetFolderPath('ApplicationData')
$logDir = Join-Path $appDataDir "Claude\logs"

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

$logFilePath = Join-Path $logDir "system-events.log"

# Create log entry
$timestamp = Get-Date -Format "o"

try {
    # Parse the data as JSON if possible
    $dataObj = $Data | ConvertFrom-Json -ErrorAction SilentlyContinue
}
catch {
    # If not valid JSON, use as string
    $dataObj = @{ message = $Data }
}

$logEntry = @{
    timestamp = $timestamp
    source = $Source
    event = $Event
    data = $dataObj
} | ConvertTo-Json -Compress

# Append to log file
Add-Content -Path $logFilePath -Value $logEntry

# Also output to console for debugging
Write-Host "Event logged: [$Source] [$Event]"
