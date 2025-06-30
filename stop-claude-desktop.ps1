# Stop All Claude Desktop Processes Script
# This script stops all Claude Desktop-related processes and monitoring windows

# Request elevation if not already running as admin
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

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
