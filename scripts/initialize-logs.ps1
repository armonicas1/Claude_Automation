# Initialize logs for Claude Automation Monitoring
# This script ensures log directories exist and creates initial log entries

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $PSScriptRoot
$logsDir = Join-Path $scriptDir "logs"
$unifiedLogPath = Join-Path $logsDir "unified-monitoring.log"
$appDataDir = [System.Environment]::GetFolderPath('ApplicationData')
$claudeLogsDir = Join-Path $appDataDir "Claude\logs"

# Create log directories if they don't exist
Write-Host "Checking log directories..." -ForegroundColor Cyan
if (-not (Test-Path $logsDir)) {
    Write-Host "Creating local logs directory: $logsDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

if (-not (Test-Path $claudeLogsDir)) {
    Write-Host "Creating Claude logs directory: $claudeLogsDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $claudeLogsDir -Force | Out-Null
}

# Initialize Claude system event log if it doesn't exist
$systemEventLog = Join-Path $claudeLogsDir "system-events.log"
if (-not (Test-Path $systemEventLog)) {
    Write-Host "Initializing system events log..." -ForegroundColor Yellow
    $initialSystemEvent = @{
        timestamp = (Get-Date).ToString("o")
        source = "SYSTEM_MONITOR"
        event = "INITIALIZATION"
        data = @{
            message = "System events log initialized"
            system_info = @{
                os = [System.Environment]::OSVersion.ToString()
                computer_name = [System.Environment]::MachineName
                user_name = [System.Environment]::UserName
            }
        }
    } | ConvertTo-Json -Compress
    
    $initialSystemEvent | Out-File -FilePath $systemEventLog -Encoding utf8
    Write-Host "Created system events log at: $systemEventLog" -ForegroundColor Green
}

# Initialize unified monitoring log
Write-Host "Initializing unified monitoring log..." -ForegroundColor Cyan
$timestamp = (Get-Date).ToString("o")

# Create starter log entries with various sources to demonstrate the format
$logEntries = @(
    "[$timestamp] [SYSTEM_MONITOR] [STARTUP] {`"timestamp`":`"$timestamp`",`"source`":`"SYSTEM_MONITOR`",`"event`":`"STARTUP`",`"data`":{`"message`":`"System monitoring started`",`"system_info`":{`"os`":`"Windows`",`"version`":`"10.0`"}}}"
    "[$timestamp] [TOOL_DEBUGGER] [INITIALIZATION] {`"timestamp`":`"$timestamp`",`"source`":`"TOOL_DEBUGGER`",`"event`":`"INITIALIZATION`",`"data`":{`"message`":`"Tool debugger initialized`",`"available_tools`":[`"system_info`",`"file_operations`",`"code_analysis`"]}}"
    "[$timestamp] [BRIDGE_MONITOR] [STARTUP] {`"timestamp`":`"$timestamp`",`"source`":`"BRIDGE_MONITOR`",`"event`":`"STARTUP`",`"data`":{`"message`":`"Bridge monitor started`",`"directories`":{`"pending`":`"pending`",`"completed`":`"completed`",`"failed`":`"failed`"}}}"
    "[$timestamp] [DESKTOP_GATEWAY] [HEALTH_CHECK] {`"timestamp`":`"$timestamp`",`"source`":`"DESKTOP_GATEWAY`",`"event`":`"HEALTH_CHECK`",`"data`":{`"status`":`"running`",`"uptime`":60,`"memory_usage`":{`"rss`":10240000}}}"
    "[$timestamp] [TOOL_CALL] [EXECUTION_STARTED] {`"timestamp`":`"$timestamp`",`"source`":`"TOOL_CALL`",`"event`":`"EXECUTION_STARTED`",`"data`":{`"tool`":`"analyze_code`",`"requestId`":`"12345`",`"request`":{`"file`":`"example.js`"}}}"
    "[$timestamp] [TOOL_CALL] [EXECUTION_COMPLETED] {`"timestamp`":`"$timestamp`",`"source`":`"TOOL_CALL`",`"event`":`"EXECUTION_COMPLETED`",`"data`":{`"tool`":`"analyze_code`",`"requestId`":`"12345`",`"result`":{`"status`":`"success`",`"analysis`":`"Code looks good!`"},`"success`":true}}"
    "[$timestamp] [MONITORING_TOOLS] [INITIALIZATION] {`"timestamp`":`"$timestamp`",`"source`":`"MONITORING_TOOLS`",`"event`":`"INITIALIZATION`",`"data`":{`"message`":`"Monitoring tools initialized`",`"version`":`"3.4`"}}"
)

# Write log entries to unified log
$logEntries | Out-File -FilePath $unifiedLogPath -Encoding utf8
Write-Host "Created unified monitoring log with $($logEntries.Count) entries at: $unifiedLogPath" -ForegroundColor Green

# Create a bridge log if it doesn't exist
$bridgeLogPath = Join-Path $logsDir "bridge.log"
if (-not (Test-Path $bridgeLogPath)) {
    Write-Host "Creating bridge log..." -ForegroundColor Yellow
    @(
        "[$timestamp] Bridge service started"
        "[$timestamp] Monitoring directories for file activity"
        "[$timestamp] Bridge ready to process requests"
    ) | Out-File -FilePath $bridgeLogPath -Encoding utf8
    Write-Host "Created bridge log at: $bridgeLogPath" -ForegroundColor Green
}

# Create a sample MCP server log if it doesn't exist
$mcpLogPath = Join-Path $claudeLogsDir "mcp-server-custom-extension.log"
if (-not (Test-Path $mcpLogPath)) {
    Write-Host "Creating sample MCP server log..." -ForegroundColor Yellow
    @(
        "[$timestamp] MCP server starting"
        "[$timestamp] Loading plugins from: plugins directory"
        "[$timestamp] Registered 7 tools successfully"
        "[$timestamp] MCP server ready for tool calls"
    ) | Out-File -FilePath $mcpLogPath -Encoding utf8
    Write-Host "Created MCP server log at: $mcpLogPath" -ForegroundColor Green
}

Write-Host "Log initialization complete!" -ForegroundColor Green
Write-Host "You can now use the Unified Log Monitor to view all logs." -ForegroundColor Green
```
