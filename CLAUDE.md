# Claude Desktop Extension Troubleshooting Guide

## Introduction

This troubleshooting guide will help engineers diagnose and resolve issues with the Claude Desktop Extension system. The guide is based on a successful implementation and provides step-by-step approaches to resolving common problems that might be encountered when integrating Claude Desktop with Claude Code, particularly in WSL environments.

## System Architecture Overview

The Claude Desktop Extension consists of several key components working together across different environments:

```
Claude Desktop (Windows) ←→ MCP Server ←→ Bridge Process ←→ File System ←→ Claude Code (WSL)
```

### Key Components
- **MCP Server**: Custom WebSocket or Stdio-based server that Claude Desktop connects to
- **Bridge Process**: Monitors and processes shared state files between environments
- **Session Manager**: Handles authentication between Code and Desktop
- **Plugin System**: Extends functionality with additional tools
- **File-Based Communication**: Enables cross-environment messaging

## Prerequisites Check

Before troubleshooting, ensure the following are installed and properly configured:

1. **Node.js** (v16+, v18+ recommended)
2. **Claude Desktop** application (latest version)
3. **WSL** (Windows Subsystem for Linux) configured with Ubuntu 24.04 or similar
4. **Claude Code CLI** installed in WSL
5. **Administrative access** for modifying system files and running elevated processes

## Quick System Status Verification

Run these commands to verify the system status:

```powershell
# Check if MCP server is running
Invoke-WebRequest -Uri "http://localhost:4323/.identity" -UseBasicParsing

# Check Claude Desktop processes
Get-Process | Where-Object { $_.ProcessName -like "*claude*" -or $_.ProcessName -eq "node" } | Format-Table ProcessName, Id, MainWindowTitle

# Check MCP server logs
Get-Content -Path "$env:APPDATA\Claude\logs\mcp-server-custom-extension.log" -Tail 20

# Check bridge logs
Get-Content -Path ".\logs\bridge.log" -Tail 20

# Check WSL integration
wsl -d Ubuntu-24.04 -e claude --version
```

## Cross-Environment Architecture: Understanding WSL/Windows Integration

The most critical challenge this system addresses is communication between two different execution environments on a single machine:

### Two Different Execution Environments

```
Claude Desktop: Running on Windows (native app)
Claude Code: Running in WSL (Linux subsystem)
```

This fundamental challenge explains the architecture of the system:

1. **File-Based Bridge**: Using shared mount points (`/mnt/c/Users/username/claude-bridge/`) as the communication channel
2. **Process Isolation Handling**: Managing processes running in different OS environments
3. **Configuration Synchronization**: Keeping configurations in sync across different file system roots

### Shared File System Bridge

The shared directory structure enables cross-environment communication:
- Windows path: `C:\Users\username\claude-bridge\`
- WSL path: `/mnt/c/Users/username/claude-bridge/`

This shared directory contains:
- Pending requests: Commands from Claude Code to Claude Desktop
- Completed responses: Results from Claude Desktop back to Claude Code
- Environment information: Authentication and configuration data

## Common Issues and Solutions

### 1. MCP Server Not Starting

**Symptoms:**
- "MCP Server not responding" error
- Cannot connect to http://localhost:4323/.identity
- "Server transport closed unexpectedly" messages in logs

**Solutions:**

1. **Check for port conflicts:**
   ```powershell
   # Find process using port 4323
   netstat -ano | findstr :4323
   
   # If a process is found, kill it
   $port = 4323
   $processId = (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue).OwningProcess
   if ($processId) {
       Stop-Process -Id $processId -Force
       Write-Host "Process $processId using port $port has been terminated"
   }
   ```

2. **Verify Node.js installation:**
   ```powershell
   node --version
   ```
   Make sure it's v16.0 or higher (v18+ recommended).

3. **Check for multiple instances:**
   ```powershell
   # Find all Node.js processes that might be MCP servers
   Get-Process | Where-Object { $_.ProcessName -eq "node" } | 
   ForEach-Object { 
     $proc = $_
     $cmdLine = (Get-WmiObject Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
     if ($cmdLine -like "*claude-mcp*") {
       Write-Host "MCP server process: $($proc.Id) - $cmdLine"
     }
   }
   ```

4. **Try the Stdio-based server instead of WebSocket:**
   - Update Claude Desktop configuration to use `custom-claude-mcp-stdio.js` instead of `custom-claude-mcp.js`
   - This eliminates JSON parsing errors and improves reliability

5. **Check the MCP server logs:**
   ```powershell
   Get-Content -Path "$env:APPDATA\Claude\logs\mcp-server-custom-extension.log" -Tail 50
   ```

### 2. JSON Parsing Errors

**Symptoms:**
- Error messages like: `Expected ',' or ']' after array element in JSON at position X`
- Tools not appearing in Claude Desktop
- MCP server connection issues

**Solutions:**

1. **Use the Stdio-based MCP server:**
   - The Stdio-based server (`custom-claude-mcp-stdio.js`) avoids JSON parsing conflicts
   - Update `claude_desktop_config.json` to use this server

2. **Validate all tool definitions:**
   ```powershell
   # Create a validation script
   @"
   const fs = require('fs');
   const path = require('path');

   const pluginsDir = path.join(__dirname, 'plugins');
   const plugins = fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js'));

   plugins.forEach(pluginFile => {
     try {
       const plugin = require(path.join(pluginsDir, pluginFile));
       console.log(`\n--- Plugin: ${pluginFile} ---`);
       
       if (!plugin.tools || !Array.isArray(plugin.tools)) {
         console.error('  No tools array exported');
         return;
       }
       
       plugin.tools.forEach(tool => {
         console.log(`\nTool: ${tool.name}`);
         try {
           // Test serialization
           const serialized = JSON.stringify(tool.parameters || tool.inputSchema);
           const deserialized = JSON.parse(serialized);
           console.log('  ✓ Valid JSON structure');
         } catch (error) {
           console.error(`  ✗ Invalid JSON: ${error.message}`);
         }
       });
     } catch (error) {
       console.error(`Error loading plugin ${pluginFile}: ${error.message}`);
     }
   });
   "@ | Out-File -FilePath .\validate-tools.js

   # Run the validation script
   node .\validate-tools.js
   ```

3. **Fix common JSON issues:**
   - Remove trailing commas in arrays and objects
   - Ensure property names are properly quoted
   - Check for malformed JSON structures

4. **Implement JSON validation in your MCP server:**
   ```javascript
   function validateToolParameters(tool) {
     try {
       if (tool.parameters || tool.inputSchema) {
         const paramObj = tool.parameters || tool.inputSchema;
         const serialized = JSON.stringify(paramObj);
         const deserialized = JSON.parse(serialized);
         if (tool.parameters) tool.parameters = deserialized;
         if (tool.inputSchema) tool.inputSchema = deserialized;
       }
       return true;
     } catch (error) {
       console.error(`Tool parameter validation failed for ${tool.name}: ${error.message}`);
       return false;
     }
   }
   ```

### 3. Bridge Process Issues

**Symptoms:**
- Actions requested via MCP are not being processed
- Constant "Detected change in session state file" messages in logs
- Triggers not being picked up

**Solutions:**

1. **Check the bridge logs:**
   ```powershell
   Get-Content -Path ".\logs\bridge.log" -Tail 50
   ```

2. **Verify the session state file:**
   ```powershell
   Get-Content -Path "$env:APPDATA\Claude\session_state.json" | ConvertFrom-Json | Format-List
   ```

3. **Restart the bridge process:**
   ```powershell
   npm run start:bridge
   ```

4. **Clear and recreate the session state:**
   ```powershell
   Remove-Item -Path "$env:APPDATA\Claude\session_state.json"
   node scripts/update-claude-config.js
   ```

5. **Check file monitoring:**
   The bridge uses file system watchers which may occasionally miss events. Implement a polling fallback:
   ```javascript
   // Add this to the bridge process
   setInterval(async () => {
     await processSessionState();
     await processCodeTriggers();
   }, 5000);
   ```

### 4. WSL Integration Issues

**Symptoms:**
- Cannot execute Claude Code commands from WSL
- Authentication errors between Claude Code and Desktop
- "Cannot find path" errors with WSL paths

**Solutions:**

1. **Check WSL distribution and status:**
   ```powershell
   wsl -l -v
   ```

2. **Verify Claude installation in WSL:**
   ```powershell
   wsl -d Ubuntu-24.04 -e claude --version
   ```

3. **Check the shared bridge directory:**
   ```powershell
   Get-ChildItem -Path "C:\Users\username\claude-bridge" -Force
   ```

4. **Verify WSL can access Windows files:**
   ```powershell
   wsl -d Ubuntu-24.04 -e ls -la /mnt/c/Users/username/claude-bridge/
   ```

5. **Test direct WSL commands from Windows:**
   ```powershell
   wsl -d Ubuntu-24.04 -e claude --help
   ```

6. **Regenerate the authentication bridge:**
   The `wsl-auth-bridge.js` script synchronizes credentials between environments:
   ```powershell
   wsl -d Ubuntu-24.04 -e node /mnt/c/Users/username/claude-bridge/wsl-auth-bridge.js
   ```

7. **Check path translation:**
   WSL and Windows use different path formats. Ensure proper translation:
   ```javascript
   // Windows to WSL path
   function toWslPath(windowsPath) {
     return windowsPath.replace(/\\/g, '/')
                       .replace(/^([A-Za-z]):/, (match, drive) => 
                         `/mnt/${drive.toLowerCase()}`);
   }
   
   // WSL to Windows path
   function toWindowsPath(wslPath) {
     const match = wslPath.match(/^\/mnt\/([a-z])(\/.*)?$/);
     if (match) {
       const drive = match[1].toUpperCase();
       const rest = match[2] || '';
       return `${drive}:${rest.replace(/\//g, '\\')}`;
     }
     return wslPath;
   }
   ```

### 5. Claude Desktop Elevation Issues

**Symptoms:**
- Permission errors when accessing files
- Tool operations failing with access denied errors
- Configuration changes not being saved

**Solutions:**

1. **Run Claude Desktop as administrator:**
   Create a PowerShell script (`run-claude-admin.ps1`) with:
   ```powershell
   # Request elevation if not already running as admin
   if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
       Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
       exit
   }

   # Path to Claude Desktop executable
   $claudePath = "${env:LOCALAPPDATA}\Claude\Claude.exe"

   # Start Claude Desktop as admin
   Start-Process -FilePath $claudePath
   ```

2. **Ensure MCP server has the same elevation level:**
   - If Claude Desktop is elevated, the MCP server must also be elevated
   - Use the `start-claude-admin-with-monitoring.ps1` script that handles this automatically

3. **Check file permissions:**
   ```powershell
   # Check session state file permissions
   Get-Acl -Path "$env:APPDATA\Claude\session_state.json" | Format-List
   
   # Grant full permissions if needed
   $acl = Get-Acl "$env:APPDATA\Claude\session_state.json"
   $rule = New-Object System.Security.AccessControl.FileSystemAccessRule("Everyone","FullControl","Allow")
   $acl.SetAccessRule($rule)
   Set-Acl "$env:APPDATA\Claude\session_state.json" $acl
   ```

4. **Clean up and restart all processes:**
   ```powershell
   # Kill all Claude processes
   Get-Process | Where-Object { $_.ProcessName -like "*claude*" } | Stop-Process -Force
   
   # Kill all Node.js processes
   Get-Process | Where-Object { $_.ProcessName -eq "node" } | Stop-Process -Force
   
   # Start services with the admin script
   .\start-claude-admin-with-monitoring.ps1
   ```

### 6. Plugin Loading Issues

**Symptoms:**
- Tools from plugins not appearing in the MCP server
- "Plugin not found" errors
- ESM module loading errors

**Solutions:**

1. **Check plugin syntax and structure:**
   - Ensure plugins export a default object with the correct format
   - Verify that tool definitions have proper `name`, `description`, and `parameters`/`inputSchema` fields

2. **Verify plugin directory:**
   ```powershell
   Get-ChildItem -Path "./plugins" -Filter "*.js"
   ```

3. **Fix ESM loader path issues:**
   ESM modules use `file://` URLs which can be problematic on Windows. Add this to your code:
   ```javascript
   import { fileURLToPath } from 'url';
   import path from 'path';

   // Convert ESM file:// URL to a regular path
   const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
   const PLUGINS_DIR = path.join(SCRIPT_DIR, '..', 'plugins');
   
   // Load plugins from the resolved path
   const pluginFiles = fs.readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.js'));
   ```

4. **Test plugin loading individually:**
   ```powershell
   # Create a test script
   @"
   import { fileURLToPath } from 'url';
   import path from 'path';
   
   const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
   const pluginPath = path.join(SCRIPT_DIR, 'plugins', 'code-to-desktop-plugin.js');
   
   const { default: plugin } = await import(pluginPath);
   console.log(JSON.stringify(plugin, null, 2));
   "@ | Out-File -FilePath .\test-plugin.js
   
   # Run the test script
   node .\test-plugin.js
   ```

5. **Fix CommonJS vs ESM issues:**
   If you're mixing CommonJS and ESM modules, add a package.json in the plugins directory:
   ```json
   {
     "type": "module"
   }
   ```

## Advanced Troubleshooting

### Transport Selection: WebSocket vs Stdio

Claude Desktop supports two different transport mechanisms for MCP:

#### WebSocket-Based MCP (Original Implementation)
- **Configuration:**
  ```json
  {
    "mcpServers": {
      "custom-extension": {
        "command": "node",
        "args": ["path/to/custom-claude-mcp.js"],
        "env": {},
        "disabled": false
      }
    }
  }
  ```
- **Pros:** Standard WebSocket protocol, works across networks
- **Cons:** More prone to JSON parsing errors, requires port management

#### Stdio-Based MCP (Recommended for Local Use)
- **Configuration:**
  ```json
  {
    "mcpServers": {
      "custom-extension": {
        "command": "node",
        "args": ["path/to/custom-claude-mcp-stdio.js"],
        "env": {},
        "disabled": false
      }
    }
  }
  ```
- **Pros:** No JSON parsing errors, no port conflicts, simpler implementation
- **Cons:** Limited to local processes, requires proper stdout/stderr separation

### Testing with Direct Client

The included test client can help diagnose MCP communication issues:

```powershell
node scripts/test-client.js
```

This interactive client allows you to:
- Connect to the MCP server
- Call specific tools
- See raw responses
- Diagnose communication issues

For Stdio-based MCP servers, use the specialized test client:

```powershell
node scripts/test-client-stdio.js
```

### Diagnosing Claude Code WSL Integration

The WSL integration can be tested and debugged using these approaches:

1. **Test basic WSL connectivity:**
   ```powershell
   wsl --status
   wsl -l -v
   ```

2. **Verify Claude Code installation in WSL:**
   ```powershell
   wsl -d Ubuntu-24.04 -e claude --version
   wsl -d Ubuntu-24.04 -e claude --help
   ```

3. **Check Claude credentials in WSL:**
   ```powershell
   wsl -d Ubuntu-24.04 -e ls -la ~/.claude
   wsl -d Ubuntu-24.04 -e ls -la ~/.claude/.credentials.json
   ```

4. **Test the WSL bridge directory:**
   ```powershell
   wsl -d Ubuntu-24.04 -e ls -la /mnt/c/Users/username/claude-bridge/
   ```

5. **Check if the file watcher is running:**
   ```powershell
   wsl -d Ubuntu-24.04 -e ps aux | grep "node.*wsl-auth-bridge"
   ```

### Port Conflict Resolution

Port conflicts with 4323 are a common issue. Here's how to resolve them:

1. **Find processes using port 4323:**
   ```powershell
   netstat -ano | findstr :4323
   ```

2. **Identify the process:**
   ```powershell
   $port = 4323
   $processId = (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue).OwningProcess
   if ($processId) {
       Get-Process -Id $processId | Format-Table Id, ProcessName, Path
   }
   ```

3. **Kill the process:**
   ```powershell
   if ($processId) {
       Stop-Process -Id $processId -Force
       Write-Host "Process $processId using port $port has been terminated"
   }
   ```

4. **Change the port if necessary:**
   - Update `config/claude-config.json` to use a different port
   - Update the MCP server code to use the new port
   - Update any test clients to use the new port

### Comprehensive Process Cleanup

When all else fails, this script will clean up all related processes:

```powershell
# Kill all Claude-related processes
Get-Process | Where-Object { $_.ProcessName -like "*claude*" } | ForEach-Object {
    Write-Host "Stopping Claude process: $($_.Id) - $($_.ProcessName)"
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

# Kill all Node.js processes
Get-Process | Where-Object { $_.ProcessName -eq "node" } | ForEach-Object {
    $cmdLine = (Get-WmiObject Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
    Write-Host "Stopping Node.js process: $($_.Id) - $cmdLine"
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

# Release port 4323
$port = 4323
$processId = (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue).OwningProcess
if ($processId) {
    Write-Host "Stopping process using port $port: $processId"
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}

# Clear any stale lock files
if (Test-Path "$env:TEMP\claude-mcp-server.lock") {
    Remove-Item "$env:TEMP\claude-mcp-server.lock" -Force
}

Write-Host "All processes cleaned up. Wait a moment before restarting services."
Start-Sleep -Seconds 2
```

## Logging and Monitoring

For effective troubleshooting, set up comprehensive logging:

### 1. Enable Verbose Logging

In `config/claude-config.json`:
```json
{
  "logLevel": "debug",
  "logToFile": true,
  "logDir": "./logs"
}
```

### 2. Multi-Window Log Monitoring

This PowerShell function creates separate console windows for monitoring multiple logs:

```powershell
function Start-LogMonitoring {
    # Create MCP server log window
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'MCP Server Log' -ForegroundColor Yellow; Get-Content -Path '$PWD\logs\mcp-server.log' -Tail 20 -Wait"
    
    # Create bridge log window
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Bridge Log' -ForegroundColor Green; Get-Content -Path '$PWD\logs\bridge.log' -Tail 20 -Wait"
    
    # Create Claude Desktop MCP extension log window
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Claude Desktop MCP Extension Log' -ForegroundColor Cyan; Get-Content -Path '$env:APPDATA\Claude\logs\mcp-server-custom-extension.log' -Tail 20 -Wait"
    
    # Create Claude Desktop main log window
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Claude Desktop Main Log' -ForegroundColor Magenta; Get-Content -Path '$env:APPDATA\Claude\logs\main.log' -Tail 20 -Wait"
}
```

### 3. Real-time Process Monitoring

This script continuously monitors Node.js processes:

```powershell
while ($true) {
    Clear-Host
    Write-Host "Node.js Processes:" -ForegroundColor Yellow
    Get-Process | Where-Object { $_.ProcessName -eq "node" } | Format-Table Id, CPU, WorkingSet, Path -AutoSize
    
    Write-Host "Claude Processes:" -ForegroundColor Cyan
    Get-Process | Where-Object { $_.ProcessName -like "*claude*" } | Format-Table Id, CPU, WorkingSet, MainWindowTitle -AutoSize
    
    Write-Host "Port 4323 Usage:" -ForegroundColor Green
    $port = 4323
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            Write-Host "Process $($conn.OwningProcess) ($($process.ProcessName)) is using port $port"
        }
    } else {
        Write-Host "No process is using port $port"
    }
    
    Start-Sleep -Seconds 2
}
```

## Testing and Verification

After troubleshooting, verify the system is functioning correctly:

### 1. Test MCP Server Connectivity

```powershell
Invoke-WebRequest -Uri "http://localhost:4323/.identity" -UseBasicParsing
```

Expected output:
```
StatusCode        : 200
StatusDescription : OK
Content           : {"name":"Claude Desktop Extension","version":"1.0.0","signature":"claude-desktop-extension","capabilities":["tools","resources"]}
```

### 2. Test Tool Availability

Use the test client to verify tools are registered correctly:
```powershell
node scripts/test-client.js
```

Select option 1 to see available tools. You should see a list including:
- open_conversation
- switch_model
- analyze_file
- save_conversation
- execute_from_code
- check_trigger_status

### 3. Test Bridge Process

Create a test trigger to verify the bridge is processing files:
```powershell
$triggerContent = @{
  id = "test-trigger-$(Get-Date -Format 'yyyyMMddHHmmss')"
  action = "test"
  params = @{
    message = "This is a test trigger"
  }
  status = "pending"
  timestamp = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
} | ConvertTo-Json

$triggerFile = Join-Path -Path $env:APPDATA -ChildPath "Claude\code_triggers\test-trigger.json"
$triggerContent | Out-File -FilePath $triggerFile -Encoding utf8
```

Check the bridge logs to see if it detected and processed the trigger.

### 4. Test WSL Integration

Test WSL integration by running Claude Code commands:
```powershell
wsl -d Ubuntu-24.04 -e claude -p "Hello from WSL"
```

### 5. Test Bidirectional Communication

Test the communication from Claude Code to Desktop:
```powershell
# Run in WSL
wsl -d Ubuntu-24.04 -e bash -c "echo '{\"action\":\"open_conversation\",\"params\":{\"conversation_id\":\"test\"}}' > /mnt/c/Users/username/claude-bridge/pending/request-$(date +%s).json"
```

Check if the bridge process detects and processes this request.

## Common Error Messages and Solutions

### "Expected ',' or ']' after array element in JSON"

**Root Cause:** Trailing commas in JSON structures that Claude Desktop's strict parser rejects.

**Solution:** 
1. Use the Stdio-based MCP server
2. Implement JSON validation for all tool definitions
3. Use `JSON.parse(JSON.stringify(obj))` to sanitize objects

### "Server transport closed unexpectedly"

**Root Cause:** The MCP server process crashed or exited unexpectedly.

**Solution:**
1. Check for port conflicts
2. Verify the MCP server code doesn't have syntax errors
3. Look for uncaught exceptions in the MCP server logs
4. Check permissions if running as different users

### "listen EADDRINUSE: address already in use"

**Root Cause:** Another process is already using port 4323.

**Solution:**
1. Find and terminate the process using port 4323
2. Use a different port for the MCP server
3. Implement a lock file mechanism to prevent multiple instances
4. Wait for ports to be released before starting

### "Cannot find module" or "Error: Cannot find module"

**Root Cause:** Issues with Node.js module resolution, especially with ESM imports.

**Solution:**
1. Check for typos in import paths
2. Use absolute paths instead of relative paths
3. Verify package.json has correct "type" field
4. For ESM modules, use fileURLToPath for proper path resolution

### "ENOENT: no such file or directory"

**Root Cause:** File path issues, especially between WSL and Windows.

**Solution:**
1. Use path translation functions to convert between WSL and Windows paths
2. Check file permissions and existence before operations
3. Implement robust path resolution and validation
4. Use absolute paths whenever possible

## Comprehensive Start-up Script

For a complete solution, use this start-up script that handles all common issues:

```powershell
param([switch]$Stop = $false)

# Request admin if needed
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" $($Stop ? '-Stop' : '')" -Verb RunAs
    exit
}

function Close-AllProcesses {
    # Kill all Claude processes
    Get-Process | Where-Object { $_.ProcessName -like "*claude*" } | ForEach-Object {
        Write-Host "Stopping Claude process: $($_.Id) - $($_.ProcessName)"
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }

    # Kill all Node.js processes
    Get-Process | Where-Object { $_.ProcessName -eq "node" } | ForEach-Object {
        $cmdLine = (Get-WmiObject Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
        Write-Host "Stopping Node.js process: $($_.Id) - $cmdLine"
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }

    # Release port 4323
    $port = 4323
    $processId = (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue).OwningProcess
    if ($processId) {
        Write-Host "Stopping process using port $port: $processId"
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }

    # Close monitoring windows
    Get-Process | Where-Object { $_.MainWindowTitle -like "*Log*" -and $_.ProcessName -eq "powershell" } | Stop-Process -Force

    Write-Host "All processes closed." -ForegroundColor Green
}

function Start-LogMonitoring {
    # Create log monitoring windows as described earlier
}

function Start-ClaudeDesktopWithMonitoring {
    Write-Host "Starting Claude Desktop with full monitoring..." -ForegroundColor Green

    # Clean up existing processes
    Close-AllProcesses
    Start-Sleep -Seconds 2

    # Create log directories
    if (-not (Test-Path ".\logs")) {
        New-Item -Path ".\logs" -ItemType Directory | Out-Null
    }

    # Configure Claude Desktop to use the MCP server
    $configDir = "$env:APPDATA\Claude"
    $configPath = "$configDir\claude_desktop_config.json"
    
    # Create config directory if it doesn't exist
    if (-not (Test-Path $configDir)) {
        New-Item -Path $configDir -ItemType Directory | Out-Null
    }

    # Choose the right MCP server implementation
    $stdioServerPath = "$PWD\src\custom-claude-mcp-stdio.js"
    $wsServerPath = "$PWD\src\custom-claude-mcp.js"
    
    $serverPath = if (Test-Path $stdioServerPath) { $stdioServerPath } else { $wsServerPath }
    $serverName = if ($serverPath -like "*stdio*") { "stdio-server" } else { "ws-server" }
    
    # Create or update the config
    $config = @{
        mcpServers = @{
            "custom-extension" = @{
                command = "node"
                args = @($serverPath)
                env = @{}
                disabled = $false
            }
        }
    }

    # Save the config
    $config | ConvertTo-Json -Depth 10 | Out-File -FilePath $configPath -Encoding utf8

    # Create session state file if it doesn't exist
    $sessionStatePath = "$configDir\session_state.json"
    if (-not (Test-Path $sessionStatePath)) {
        @{
            last_updated = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
            pending_actions = @()
            bridge_info = @{
                status = 'initializing'
                timestamp = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
            }
        } | ConvertTo-Json -Depth 10 | Out-File -FilePath $sessionStatePath -Encoding utf8
    }

    # Start log monitoring
    Write-Host "Starting log monitoring..." -ForegroundColor Yellow
    Start-LogMonitoring
    Start-Sleep -Seconds 2

    # Start bridge process
    Write-Host "Starting bridge process..." -ForegroundColor Yellow
    Start-Process node -ArgumentList "$PWD\src\claude-desktop-bridge.js" -WindowStyle Hidden

    # Start Claude Desktop
    Write-Host "Starting Claude Desktop..." -ForegroundColor Yellow
    Start-Process -FilePath "${env:LOCALAPPDATA}\Claude\Claude.exe"

    # Wait for MCP server to start
    Write-Host "Waiting for MCP server to start..." -ForegroundColor Yellow
    $maxAttempts = 30
    $attempts = 0
    $success = $false

    while ($attempts -lt $maxAttempts -and -not $success) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:4323/.identity" -UseBasicParsing -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                $success = $true
                Write-Host "MCP server is running!" -ForegroundColor Green
                Write-Host "Response: $($response.Content)" -ForegroundColor Green
            }
        } catch {
            Write-Host "Waiting for MCP server... (attempt $($attempts+1)/$maxAttempts)" -ForegroundColor Yellow
            Start-Sleep -Seconds 2
        }
        $attempts++
    }

    if (-not $success) {
        Write-Host "Warning: MCP server did not respond after $maxAttempts attempts." -ForegroundColor Red
        Write-Host "Check the logs for more information." -ForegroundColor Red
    } else {
        # Create a test trigger to verify bridge functionality
        Write-Host "Creating test trigger to verify bridge functionality..." -ForegroundColor Yellow
        $triggerContent = @{
            id = "test-trigger-$(Get-Date -Format 'yyyyMMddHHmmss')"
            action = "test"
            params = @{
                message = "This is a test trigger"
            }
            status = "pending"
            timestamp = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
        } | ConvertTo-Json

        $triggerDir = "$env:APPDATA\Claude\code_triggers"
        if (-not (Test-Path $triggerDir)) {
            New-Item -Path $triggerDir -ItemType Directory | Out-Null
        }

        $triggerFile = Join-Path -Path $triggerDir -ChildPath "test-trigger.json"
        $triggerContent | Out-File -FilePath $triggerFile -Encoding utf8

        Write-Host "Test trigger created at: $triggerFile" -ForegroundColor Green
        Write-Host "Check the bridge log window to see if it was processed." -ForegroundColor Green
    }

    Write-Host "Setup complete!" -ForegroundColor Green
    Write-Host "Claude Desktop should be running with the extension configured." -ForegroundColor Green
    Write-Host "To stop all processes, run: .\start-claude-admin-with-monitoring.ps1 -Stop" -ForegroundColor Yellow
}

# Main execution
if ($Stop) {
    Close-AllProcesses
} else {
    Start-ClaudeDesktopWithMonitoring
}
```

## MCP Architecture Deep Dive

Understanding the Model Context Protocol (MCP) architecture is crucial for troubleshooting:

### Transport Mechanisms

Claude Desktop supports two transport mechanisms:

1. **WebSocket Transport**:
   - Uses WebSocket protocol for communication
   - Requires port binding (usually 4323)
   - Allows network-based communication
   - More prone to JSON parsing errors

2. **Stdio Transport**:
   - Uses standard input/output streams
   - No port binding required
   - Limited to local processes
   - More reliable for JSON handling
   - Requires careful separation of logging and communication

### MCP Configuration File Hierarchy

The MCP system uses multiple configuration files:

1. **Claude Desktop Application Config**:
   - Located at `%LOCALAPPDATA%\AnthropicClaude\config.json`
   - Controls auto-start behavior
   - References the MCP server config file

2. **MCP Server Config**:
   - Located at `%APPDATA%\Claude\claude_desktop_config.json`
   - Defines MCP server launch parameters
   - Specifies command, arguments, and environment variables

3. **Session State File**:
   - Located at `%APPDATA%\Claude\session_state.json`
   - Tracks bridge process status
   - Contains pending actions and results
   - Monitored by the bridge process

### JSON-RPC Protocol

The MCP uses JSON-RPC 2.0 for communication:

1. **Request Format**:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "tools/list",
     "params": {}
   }
   ```

2. **Response Format**:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "result": {
       "tools": [...]
     }
   }
   ```

3. **Error Response Format**:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "error": {
       "code": -32700,
       "message": "Parse error"
     }
   }
   ```

### Tool Registration

Tools must be registered in a specific format:

```javascript
{
  name: "tool_name",
  description: "Tool description",
  inputSchema: {  // Note: Claude Desktop prefers inputSchema over parameters
    type: "object",
    properties: {
      param1: {
        type: "string",
        description: "Parameter description"
      }
    },
    required: ["param1"]
  },
  handler: async (params) => {
    // Tool implementation
  }
}
```

## WSL/Windows Integration: The Core Architectural Challenge

The fundamental challenge this project addresses is communication between two different execution environments:

### Two Different Execution Environments

```
Claude Desktop: Running on Windows (native app)
Claude Code: Running in WSL (Linux subsystem)
```

This creates several challenges:

1. **File System Differences**:
   - Windows paths: `C:\Users\username\...`
   - WSL paths: `/mnt/c/Users/username/...`

2. **Process Isolation**:
   - Windows processes can't directly access WSL processes and vice versa
   - Different permission models and user contexts

3. **Authentication Differences**:
   - Claude Desktop uses Windows authentication
   - Claude Code uses WSL (Linux) authentication
   - Credentials stored in different locations

### The Bridge Solution

The system uses a file-based bridge to solve these challenges:

1. **Shared Directory**:
   - Windows: `C:\Users\username\claude-bridge\`
   - WSL: `/mnt/c/Users/username/claude-bridge/`
   - Files in this directory can be accessed from both environments

2. **File-Based Communication**:
   - `pending/` directory for requests from Claude Code to Claude Desktop
   - `completed/` directory for responses from Claude Desktop to Claude Code
   - `claude-env.bat` for sharing authentication data

3. **Authentication Bridge**:
   - `wsl-auth-bridge.js` script synchronizes credentials between environments
   - Extracts credentials from Claude Code in WSL
   - Creates Windows-accessible credentials for Claude Desktop

This approach allows secure bidirectional communication without requiring complex network setup.

## Production Deployment

For production environments, consider these additional steps:

### 1. Windows Service Setup

Use NSSM (Non-Sucking Service Manager) to create a Windows service:

```powershell
# Install NSSM (if not already installed)
# Download from http://nssm.cc/ and place in PATH

# Create the service
nssm install "Claude Desktop Extension" powershell.exe -ExecutionPolicy Bypass -File "C:\path\to\start-claude-admin-with-monitoring.ps1"
nssm set "Claude Desktop Extension" DisplayName "Claude Desktop Extension"
nssm set "Claude Desktop Extension" Description "MCP server and bridge for Claude Desktop integration"
nssm set "Claude Desktop Extension" Start SERVICE_AUTO_START
```

### 2. Scheduled Task Alternative

Alternatively, create a scheduled task to run at startup:

```powershell
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"C:\path\to\start-claude-admin-with-monitoring.ps1`""
$trigger = New-ScheduledTaskTrigger -AtLogon
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName "Claude Desktop Extension" -Action $action -Trigger $trigger -Principal $principal -Settings $settings
```

### 3. WSL Auto-Start

Configure the WSL bridge to start automatically:

1. Create a startup script in WSL:
   ```bash
   #!/bin/bash
   # Save as /home/username/start-claude-bridge.sh
   node /mnt/c/Users/username/claude-bridge/wsl-auth-bridge.js
   ```

2. Make it executable:
   ```bash
   chmod +x /home/username/start-claude-bridge.sh
   ```

3. Add to `.profile` in WSL:
   ```bash
   echo "/home/username/start-claude-bridge.sh" >> ~/.profile
   ```

## Conclusion

This troubleshooting guide covers the most common issues encountered when setting up and using the Claude Desktop Extension system, particularly with WSL integration. The key to success is understanding the cross-environment architecture and implementing proper validation and error handling.

For ongoing maintenance:

1. **Regular Log Monitoring**: Check logs regularly for errors or warnings
2. **Configuration Backup**: Keep backups of all configuration files
3. **Process Monitoring**: Monitor system resource usage for any abnormalities
4. **Testing**: Regularly test functionality with the provided test scripts
5. **Updates**: Keep all components (Node.js, Claude Desktop, WSL) updated

By following this guide, you should be able to diagnose and resolve most issues with the Claude Desktop Extension system and maintain a reliable integration between Claude Desktop and Claude Code.

## Additional Resources

- [Claude Desktop Documentation](https://docs.anthropic.com/claude/docs/claude-desktop)
- [Claude Code CLI Documentation](https://docs.anthropic.com/claude/docs/claude-code)
- [Model Context Protocol (MCP) Specification](https://docs.anthropic.com/claude/docs/model-context-protocol-mcp)
- [WSL Documentation](https://learn.microsoft.com/en-us/windows/wsl/)
- [Node.js Documentation](https://nodejs.org/en/docs/)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)