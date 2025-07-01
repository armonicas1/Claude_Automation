#!/usr/bin/env powershell
# tool-call-debugger.ps1 v2.0
# Live, interactive dashboard for monitoring MCP tool calls in real-time.

param(
    [switch]$Live,
    [switch]$TestTool,
    [string]$ToolName = "open_conversation"
)

# --- UI & Helper Functions ---
function Write-Header {
    param([string]$Title)
    Write-Host ("-" * 80)
    Write-Host $Title -ForegroundColor Cyan
    Write-Host ("-" * 80)
}

function Write-StatusLine {
    param(
        [string]$Label,
        [string]$Status,
        [string]$Color
    )
    $padding = 25 - $Label.Length
    if ($padding -lt 1) { $padding = 1 }
    $padString = " " * $padding
    Write-Host "$($Label)$padString : " -NoNewline
    Write-Host $Status -ForegroundColor $Color
}

# --- Live Debugger Functions ---

function Get-LiveHealthStatus {
    $status = @{}
    # MCP Server Process (Node)
    $mcpProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine -like "*mcp-stdio*"
    } | Select-Object -First 1
    
    if ($mcpProcess) {
        $status.MCPProcess = "Running (PID: $($mcpProcess.Id))"
        $status.MCPProcessColor = 'Green'
    } else {
        $status.MCPProcess = "Not Running"
        $status.MCPProcessColor = 'Red'
    }

    # Bridge Process (Node)
    $bridgeProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine -like "*bridge*"
    } | Select-Object -First 1

    if ($bridgeProcess) {
        $status.BridgeProcess = "Running (PID: $($bridgeProcess.Id))"
        $status.BridgeProcessColor = 'Green'
    } else {
        $status.BridgeProcess = "Not Running"
        $status.BridgeProcessColor = 'Yellow'
    }

    # MCP Port 4323
    $mcpPortConn = Get-NetTCPConnection -LocalPort 4323 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($mcpPortConn) {
        $status.MCPPort = "Listening (PID: $($mcpPortConn.OwningProcess))"
        $status.MCPPortColor = 'Green'
    } else {
        $status.MCPPort = "Not Listening"
        $status.MCPPortColor = 'Red'
    }
    return $status
}


function Start-LiveDebugger {
    $logPath = "$env:APPDATA\Claude\logs\mcp-server-custom-extension.log"
    if (-not (Test-Path $logPath)) {
        Write-Host "FATAL: MCP Log file not found at $logPath" -ForegroundColor Red
        return
    }

    $lastToolCall = [PSCustomObject]@{
        ID = $null
        Name = 'N/A'
        Params = 'N/A'
        Status = 'Waiting for tool call...'
        Result = ''
        Timestamp = Get-Date
    }

    while ($true) {
        Clear-Host
        $health = Get-LiveHealthStatus
        
        # --- Draw Dashboard ---
        Write-Header "LIVE TOOL CALL DEBUGGER"
        
        # Health Panel
        Write-Host "System Health:" -ForegroundColor White
        Write-StatusLine -Label "MCP Process" -Status $health.MCPProcess -Color $health.MCPProcessColor
        Write-StatusLine -Label "MCP Port (4323)" -Status $health.MCPPort -Color $health.MCPPortColor
        Write-StatusLine -Label "Bridge Process" -Status $health.BridgeProcess -Color $health.BridgeProcessColor
        Write-Host ""

        # Last Tool Call Panel
        Write-Host "Last Tool Call Analysis:" -ForegroundColor White
        Write-StatusLine -Label "Tool Name" -Status $lastToolCall.Name -Color 'Cyan'
        Write-StatusLine -Label "Status" -Status $lastToolCall.Status -Color $(
            if ($lastToolCall.Status -match 'Success') {'Green'} 
            elseif ($lastToolCall.Status -match 'Failed') {'Red'} 
            else {'Yellow'}
        )
        Write-Host "  Parameters:" -ForegroundColor White
        Write-Host "  $($lastToolCall.Params)" -ForegroundColor Gray
        Write-Host "  Result/Error:" -ForegroundColor White
        Write-Host "  $($lastToolCall.Result)" -ForegroundColor Gray
        
        Write-Header "LIVE EVENT LOG (Watching: $logPath)"
        
        # --- Process new log entries ---
        Get-Content $logPath -Wait -Tail 0 -Timeout 5 | ForEach-Object {
            $line = $_
            $json = $line | ConvertFrom-Json -ErrorAction SilentlyContinue
            
            if (-not $json) {
                Write-Host $line -ForegroundColor DarkGray
                return
            }

            $timestamp = Get-Date -Format "HH:mm:ss"

            # Check for a tool call request
            if ($json.method -eq 'tools/call') {
                $lastToolCall.ID = $json.id
                $lastToolCall.Name = $json.params.name
                $lastToolCall.Params = $json.params.arguments | ConvertTo-Json -Compress
                $lastToolCall.Status = "Executing..."
                $lastToolCall.Result = "Waiting for response..."
                $lastToolCall.Timestamp = Get-Date
                Write-Host "[$timestamp] TOOL CALL  => $($lastToolCall.Name)" -ForegroundColor Magenta
            }
            # Check for a response (success or failure)
            elseif ($json.id -eq $lastToolCall.ID) {
                if ($json.result) {
                    $lastToolCall.Status = "Success"
                    $lastToolCall.Result = $json.result | ConvertTo-Json -Compress
                    Write-Host "[$timestamp] SUCCESS    <= Response for $($lastToolCall.Name)" -ForegroundColor Green
                }
                elseif ($json.error) {
                    $lastToolCall.Status = "Failed: $($json.error.message)"
                    $lastToolCall.Result = $json.error | ConvertTo-Json -Compress
                    Write-Host "[$timestamp] ERROR      <= Response for $($lastToolCall.Name) -> $($json.error.message)" -ForegroundColor Red
                }
                # Redraw the "Last Tool Call" panel immediately
                $currentPosition = $Host.UI.RawUI.CursorPosition
                $Host.UI.RawUI.CursorPosition = @{X=0; Y=6}
                Write-StatusLine -Label "Tool Name" -Status $lastToolCall.Name -Color 'Cyan'
                Write-StatusLine -Label "Status" -Status $lastToolCall.Status -Color $(if ($lastToolCall.Status -match 'Success') {'Green'} else {'Red'})
                Write-Host "  Parameters:                                                                  "
                $Host.UI.RawUI.CursorPosition = @{X=2; Y=9}
                Write-Host $lastToolCall.Params -ForegroundColor Gray
                Write-Host "  Result/Error:                                                                "
                $Host.UI.RawUI.CursorPosition = @{X=2; Y=11}
                Write-Host $lastToolCall.Result -ForegroundColor Gray
                $Host.UI.RawUI.CursorPosition = $currentPosition
            }
        }
    }
}

function Show-StaticStatus {
    Write-Header "TOOL DEBUGGER - STATIC CHECK"
    $health = Get-LiveHealthStatus
    Write-StatusLine -Label "MCP Process" -Status $health.MCPProcess -Color $health.MCPProcessColor
    Write-StatusLine -Label "MCP Port (4323)" -Status $health.MCPPort -Color $health.MCPPortColor
    Write-StatusLine -Label "Bridge Process" -Status $health.BridgeProcess -Color $health.BridgeProcessColor
    
    if ($TestTool) {
        Write-Host ""
        Write-Host "--- Invoking Tool: $ToolName ---" -ForegroundColor Yellow
        $body = @{jsonrpc="2.0";id=99;method="tools/call";params=@{name=$ToolName;arguments=@{}}} | ConvertTo-Json
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:4323/mcp" -Method POST -Body $body -ContentType "application/json"
            Write-Host "RESPONSE:" -ForegroundColor Green
            Write-Host ($response | ConvertTo-Json -Depth 5)
        } catch {
            Write-Host "TOOL CALL FAILED:" -ForegroundColor Red
            Write-Host $_.Exception.Message
        }
    }
}


# --- Main Execution ---
if ($Live) {
    try {
        Start-LiveDebugger
    } catch {
        Write-Host "Live debugger stopped unexpectedly: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Show-StaticStatus
}

Write-Host ""
Write-Host "Usage:" -ForegroundColor Cyan
Write-Host "  .\tool-call-debugger.ps1 -Live          (Recommended for real-time debugging)" -ForegroundColor Gray
Write-Host "  .\tool-call-debugger.ps1                (For a one-time static check)" -ForegroundColor Gray
Write-Host "  .\tool-call-debugger.ps1 -TestTool      (To send a test 'open_conversation' call)" -ForegroundColor Gray