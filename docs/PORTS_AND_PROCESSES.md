# Ports and Processes Reference Guide

This document provides a comprehensive reference for all network ports and process identifiers used within the Claude Desktop Extension architecture.

## Network Ports

| Port | Component | Purpose | Configuration Source |
|------|-----------|---------|----------------------|
| 4323 | MCP Server | Primary communication port for the Model Context Protocol server | `config/claude-config.json`, `config/dev-hub-config.json` |
| 4322 | Browser Tools | Exposes tools API for browser-based connections | `config/claude-config.json`, `config/dev-hub-config.json` |
| 4324 | Dev Hub | Development and testing interface | Referenced in monitoring scripts |

### Port Details

#### Port 4323 - MCP Server
- **Primary Use**: Model Context Protocol communication between Claude Desktop and the custom extension
- **Transport Options**: 
  - `stdio` (recommended, reduces JSON parsing errors)
  - WebSocket (legacy mode)
- **Configuration**: Set in both `claude-config.json` and `dev-hub-config.json`
- **Security**: Only binds to localhost by default
- **Cleanup**: Automatically cleaned up by launcher scripts to prevent `EADDRINUSE` errors

#### Port 4322 - Browser Tools
- **Primary Use**: Exposes tool API endpoints for browsers and HTTP clients
- **Key Endpoints**:
  - `/claude/api/tools`
  - `/tools`
  - `/claude/api/tools/call`
  - `/tools/call`
  - `/claude/api/tools/list`
  - `/tools/list`
- **Configuration**: Set as `toolsPort` in `claude-config.json` and `browserToolsPort` in `dev-hub-config.json`

#### Port 4324 - Dev Hub
- **Primary Use**: Development and testing interface
- **Usage**: Referenced in `scripts/test-dev-hub.js` and monitoring tools
- **Note**: Less frequently used than primary ports 4323 and 4322

## Process Identifiers

| Process Name | Description | Launcher | Process Detection |
|--------------|-------------|----------|-------------------|
| `Claude.exe` | Claude Desktop main application | Windows application launcher | Case-sensitive detection in newer scripts, case-insensitive in older ones |
| `node` (MCP) | Custom MCP Server | `start-claude-admin-with-monitoring.ps1` | Detected by command line containing "mcp-stdio" |
| `node` (Bridge) | JavaScript Bridge | `start-claude-admin-with-monitoring.ps1` | Detected by command line containing "bridge" |
| `python` (Bridge) | Python Bridge (alternative) | `claude-desktop-bridge.py` | Used for WSL-Windows integration |
| `wsl` processes | Claude Code integration | WSL launchers | Detected using `wsl -d` commands |

### Process Details

#### Claude Desktop (`Claude.exe`)
- **Main Process**: The Claude Desktop application itself
- **Detection**: Some older scripts use lowercase `claude.exe` which can cause detection issues
- **Fix**: Case-insensitive process name matching used in newer scripts
- **Termination**: Typically cleaned up with `Get-Process | Where-Object { $_.ProcessName -like "*claude*" } | Stop-Process -Force`

#### Node.js MCP Server
- **Command Line Pattern**: Contains "mcp-stdio" or "custom-claude-mcp"
- **Transport Modes**:
  - stdio transport (recommended): Uses standard input/output
  - WebSocket transport (legacy): Binds to port 4323
- **Launched By**: `start-claude-admin-with-monitoring.ps1` or `run-claude-admin.ps1`
- **Termination**: Cleaned up with `Get-Process | Where-Object { $_.ProcessName -eq "node" } | Stop-Process -Force`

#### JavaScript Bridge
- **Source File**: `claude-desktop-bridge.js`
- **Command Line Pattern**: Contains "bridge"
- **Primary Role**: Connects Claude Desktop to the extension system
- **Monitoring**: Tracked by `scripts/bridge-monitor.ps1`

#### Python Bridge (Alternative)
- **Source File**: `claude-desktop-bridge.py`
- **Primary Role**: Alternative bridge implementation, particularly useful for WSL-Windows integration
- **Dependencies**: Listed in the `requirements/` directory
- **Usage**: Run directly with Python when JavaScript bridge is insufficient

## Cross-Environment Integration

The system uses multiple approaches to handle WSL-Windows boundaries:

1. **File-based communication**: Used for cross-environment scenarios where direct stdio/socket connections aren't possible
2. **WSL-specific authentication**: Handled by `scripts/sync-wsl-auth.js`
3. **Process monitoring**: Both Windows and WSL processes are monitored by `scripts/claude-system-monitor.ps1`

## Monitoring Tools

The following scripts provide visibility into ports and processes:

1. **`scripts/claude-system-monitor.ps1`**: Comprehensive dashboard for all system components
2. **`scripts/tool-call-debugger.ps1`**: Focused monitoring of MCP tool calls
3. **`scripts/bridge-monitor.ps1`**: Specific monitoring of the bridge component

## Port and Process Cleanup

Cleanup is handled by multiple scripts:

1. **`stop-claude-desktop.ps1`**: Terminates all Claude and Node.js processes, releases port 4323
2. **`start-claude-admin-with-monitoring.ps1`**: Contains cleanup sections before launching
3. **`run-claude-admin.ps1`**: Simpler cleanup focused on Claude processes

## Troubleshooting

Common port and process issues:

1. **`EADDRINUSE` on port 4323**: Run `stop-claude-desktop.ps1` to clean up stale processes
2. **Process detection issues**: Ensure case-sensitive process detection is used
3. **Cross-environment failures**: Check WSL distribution status and authentication sync

## References

- `config/claude-config.json`: Primary MCP configuration
- `config/dev-hub-config.json`: Development hub configuration
- `scripts/claude-system-monitor.ps1`: Complete monitoring dashboard
- `scripts/tool-call-debugger.ps1`: Tool call monitoring dashboard
- `stop-claude-desktop.ps1`: Port and process cleanup utility
