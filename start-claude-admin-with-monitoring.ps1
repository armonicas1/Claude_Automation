# Main script execution - Parse command line parameters
param(
    [switch]$Stop = $false
)

# All-in-One Claude Desktop Admin Setup Script
# This script:
# 1. Stops any running Claude Desktop and Node.js processes
# 2. Updates configurations
# 3. Starts Claude Desktop in administrator mode
# 4. Sets up real-time log monitoring
# 5. Syncs WSL Claude Code authentication for MCP analyzer tools
# 6. Starts the bridge process

# Request elevation if not already running as admin
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    if ($Stop) {
        Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Stop" -Verb RunAs
    } else {
        Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    }
    exit
}

# Function to close all Claude-related processes and monitoring windows
function Close-AllProcesses {
    Write-Host "Shutting down all Claude Desktop processes and monitoring windows..." -ForegroundColor Yellow
    
    # Close all PowerShell windows with our monitoring titles
    $monitoringTitles = @(
        "MCP Server Log",
        "Bridge Log",
        "Claude Desktop MCP Extension Log",
        "Claude Desktop Main Log",
        "Claude Desktop Bridge"
    )
    
    foreach ($title in $monitoringTitles) {
        Get-Process | Where-Object { $_.MainWindowTitle -like "*$title*" } | Stop-Process -Force -ErrorAction SilentlyContinue
    }
    
    # Stop all Claude Desktop and Node.js processes
    Get-Process | Where-Object { $_.ProcessName -like "*claude*" -or $_.ProcessName -eq "node" } | Stop-Process -Force -ErrorAction SilentlyContinue
    
    # Clean up port 4323
    $port = 4323
    $tcpConnections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($tcpConnections) {
        $tcpConnections | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
        Write-Host "Cleaned up port 4323" -ForegroundColor Green
    }
    
    # Remove any lock files
    $lockPath = "$env:TEMP\claude-mcp-server.lock"
    if (Test-Path $lockPath) {
        Remove-Item -Path $lockPath -Force
        Write-Host "Removed lock file" -ForegroundColor Green
    }
    
    Write-Host "All Claude Desktop processes and monitoring windows have been closed." -ForegroundColor Green
}

# Function to create log monitoring jobs
function Start-LogMonitoring {
    param (
        [string]$LogPath,
        [string]$WindowTitle
    )
    
    if (Test-Path $LogPath) {
        Start-Process powershell.exe -ArgumentList "-NoExit -Command `"& {`$host.UI.RawUI.WindowTitle = '$WindowTitle'; Get-Content -Path '$LogPath' -Tail 20 -Wait}`""
    } else {
        Write-Host "Log file not found: $LogPath. Will create monitoring window when file appears."
        Start-Process powershell.exe -ArgumentList "-NoExit -Command `"& {`$host.UI.RawUI.WindowTitle = '$WindowTitle'; while(-not (Test-Path '$LogPath')) { Write-Host 'Waiting for log file to appear...'; Start-Sleep -Seconds 2 }; Get-Content -Path '$LogPath' -Tail 20 -Wait}`""
    }
}

# Main function to start Claude Desktop with monitoring
function Start-ClaudeDesktopWithMonitoring {
    # Create required directories
    $logsDir = Join-Path $PSScriptRoot "logs"
    if (-not (Test-Path $logsDir)) {
        New-Item -Path $logsDir -ItemType Directory -Force | Out-Null
    }

    # Set paths
    $claudeDir = "$env:APPDATA\Claude"
    $claudeExePath = "$env:LOCALAPPDATA\AnthropicClaude\claude.exe"
    $configPath = "$claudeDir\claude_desktop_config.json"
    $mcpServerPath = Join-Path $PSScriptRoot "src\custom-claude-mcp-stdio.js"
    $bridgePath = Join-Path $PSScriptRoot "src\claude-desktop-bridge.js"

    # 1. Stop all existing processes
    Write-Host "Stopping any running Claude Desktop and Node.js processes..." -ForegroundColor Yellow
    Get-Process | Where-Object { $_.ProcessName -like "*claude*" -or $_.ProcessName -eq "node" } | Stop-Process -Force -ErrorAction SilentlyContinue

    # Clean up port 4323
    $port = 4323
    $tcpConnections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($tcpConnections) {
        $tcpConnections | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
        Write-Host "Cleaned up port 4323" -ForegroundColor Green
    }

    # Remove any lock files
    $lockPath = "$env:TEMP\claude-mcp-server.lock"
    if (Test-Path $lockPath) {
        Remove-Item -Path $lockPath -Force
        Write-Host "Removed lock file" -ForegroundColor Green
    }

    # 2. Update Claude Desktop configuration
    if (Test-Path $configPath) {
        try {
            $config = Get-Content $configPath | ConvertFrom-Json
            $config.mcpServers."custom-extension".args[0] = $mcpServerPath
            $config | ConvertTo-Json -Depth 10 | Set-Content $configPath
            Write-Host "Updated Claude Desktop config with correct MCP server path" -ForegroundColor Green
        } catch {
            Write-Host "Error updating config: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "Configuration file not found. Will be created by Claude Desktop on first run." -ForegroundColor Yellow
    }

    # 3. Start log monitoring in separate windows
    Write-Host "Starting log monitoring..." -ForegroundColor Yellow

    # MCP Server log - check for stdio version first
    $stdioLogPath = "$logsDir\mcp-server-stdio.log"
    $regularLogPath = "$logsDir\mcp-server.log"
    if ((Test-Path $stdioLogPath) -or ($mcpServerPath -like "*stdio*")) {
        Start-LogMonitoring -LogPath $stdioLogPath -WindowTitle "MCP Server Log (Stdio)"
    } else {
        Start-LogMonitoring -LogPath $regularLogPath -WindowTitle "MCP Server Log"
    }

    # Bridge log
    Start-LogMonitoring -LogPath "$logsDir\bridge.log" -WindowTitle "Bridge Log"

    # Claude Desktop MCP extension log
    Start-LogMonitoring -LogPath "$claudeDir\logs\mcp-server-custom-extension.log" -WindowTitle "Claude Desktop MCP Extension Log"

    # Main Claude Desktop log
    Start-LogMonitoring -LogPath "$claudeDir\logs\main.log" -WindowTitle "Claude Desktop Main Log"

    # 4. Start Claude Desktop in admin mode
    Write-Host "Starting Claude Desktop in administrator mode..." -ForegroundColor Yellow
    if (Test-Path $claudeExePath) {
        Start-Process -FilePath $claudeExePath
        Write-Host "Claude Desktop started successfully" -ForegroundColor Green
    } else {
        Write-Host "Claude Desktop executable not found at $claudeExePath" -ForegroundColor Red
        exit
    }

    # Wait for Claude Desktop to initialize
    Write-Host "Waiting for Claude Desktop to initialize..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5

    # 5. Sync WSL authentication before starting services
    Write-Host "Syncing WSL Claude Code authentication..." -ForegroundColor Yellow
    # Note: Using JavaScript version for compatibility. Python version available but has Python 3.8 type issues
    $authSyncScript = Join-Path $PSScriptRoot "scripts\sync-wsl-auth.js"
    if (Test-Path $authSyncScript) {
        try {
            node $authSyncScript | Out-Host
            Write-Host "WSL authentication sync completed" -ForegroundColor Green
        } catch {
            Write-Host "Warning: WSL auth sync failed: $_" -ForegroundColor Yellow
            Write-Host "MCP analyzer tools may require manual API key setup" -ForegroundColor Yellow
        }
    } else {
        Write-Host "WSL auth sync script not found, skipping..." -ForegroundColor Yellow
    }

    # 6. Start bridge process
    Write-Host "Starting bridge process..." -ForegroundColor Yellow
    Start-Process powershell.exe -ArgumentList "-NoExit -Command `"& {`$host.UI.RawUI.WindowTitle = 'Claude Desktop Bridge'; node '$bridgePath'}`""

    # 7. Test MCP server connection
    Write-Host "Testing MCP server connection..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:4323/.identity" -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "MCP server is responding correctly!" -ForegroundColor Green
            Write-Host $response.Content
        } else {
            Write-Host "MCP server responded with status code $($response.StatusCode)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Error connecting to MCP server: $_" -ForegroundColor Red
    }

    # 8. Create a test trigger
    Write-Host "Creating a test trigger file..." -ForegroundColor Yellow
    $triggerDir = "$claudeDir\code_triggers"
    if (-not (Test-Path $triggerDir)) {
        New-Item -Path $triggerDir -ItemType Directory -Force | Out-Null
    }

    $triggerContent = @{
        id = "test-trigger-$(Get-Date -Format 'yyyyMMddHHmmss')"
        action = "test"
        parameters = @{
            message = "This is a test trigger from the all-in-one script"
        }
    } | ConvertTo-Json

    $triggerPath = "$triggerDir\test-trigger.json"
    $triggerContent | Out-File -FilePath $triggerPath -Encoding utf8
    Write-Host "Test trigger created at: $triggerPath" -ForegroundColor Green

    Write-Host "`nAll systems are now running and being monitored!" -ForegroundColor Green
    Write-Host "Claude Desktop is running in administrator mode" -ForegroundColor Green
    Write-Host "The MCP server should be started by Claude Desktop" -ForegroundColor Green
    Write-Host "The bridge process is running in its own window" -ForegroundColor Green
    Write-Host "All logs are being monitored in separate windows" -ForegroundColor Green
    Write-Host "`nTo shut down all processes, run this script with the -Stop parameter:" -ForegroundColor Cyan
    Write-Host ".\start-claude-admin-with-monitoring.ps1 -Stop" -ForegroundColor Cyan
}

# If Stop parameter is provided, just run the Close-AllProcesses function and exit
if ($Stop) {
    Close-AllProcesses
    exit
}

# Otherwise run the main script function
Start-ClaudeDesktopWithMonitoring
