# Request elevation if not already running as admin
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

# Stop any existing Claude Desktop and Node.js processes first
Get-Process | Where-Object { $_.ProcessName -like "*Claude*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Clean up port 4323
$port = 4323
$tcpConnections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($tcpConnections) {
    $tcpConnections | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Write-Host "Cleaned up port 4323"
}

# Remove any lock files
$lockPath = "$env:TEMP\claude-mcp-server.lock"
if (Test-Path $lockPath) {
    Remove-Item $lockPath -Force
    Write-Host "Removed lock file"
}

# Wait a moment for processes to fully terminate
Start-Sleep -Seconds 5

# Path to Claude Desktop executable
$claudePath = "${env:LOCALAPPDATA}\AnthropicClaude\claude.exe"

# Start Claude Desktop as admin
Start-Process -FilePath $claudePath

Write-Host "Claude Desktop has been restarted in Administrator mode with clean state"