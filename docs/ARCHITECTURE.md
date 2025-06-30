# Claude Desktop Extension Architecture

This document describes the architecture and implementation of the Claude Desktop Extension system, which adds automation capabilities to Claude Desktop without modifying the application itself.

## Overview

The Claude Desktop Extension uses the Model Context Protocol (MCP) to integrate with Claude Desktop. It consists of:

1. **Custom MCP Server**: Implements the MCP protocol that Claude Desktop can connect to
2. **Bridge Process**: Monitors and processes shared state between the MCP server and Claude Desktop
3. **Plugin System**: Allows extending the functionality with additional tools

## Architecture Diagram

```
┌─────────────────┐      ┌────────────────┐     ┌─────────────────┐
│ Claude Desktop  │◄────►│   MCP Server   │◄───►│  Your Extension │
└─────────────────┘      └────────────────┘     └─────────────────┘
         ▲                       ▲
         │                       │
         ▼                       ▼
┌─────────────────┐      ┌────────────────┐
│  Config Files   │◄────►│ Bridge Process │
└─────────────────┘      └────────────────┘
```

## Directory Structure

```
claude-desktop-extension/
├── src/
│   ├── custom-claude-mcp.js     # MCP server implementation
│   └── claude-desktop-bridge.js # Bridge process implementation
├── scripts/
│   └── start-services.js        # Script to start all services
├── plugins/
│   └── file-operations-plugin.js # Sample plugin
├── config/
│   └── claude-config.json       # Configuration file
├── logs/
│   ├── mcp-server.log           # MCP server logs
│   └── bridge.log               # Bridge process logs
├── package.json                 # Node.js package file
└── start.bat                    # Windows batch file to start services
```

## Communication Protocol

The extension supports two methods of communication:

1. **MCP Protocol**:
   - **Stdio Transport (✅ Recommended)**:
     - Claude Desktop connects directly to the MCP server via stdin/stdout
     - Reliable, direct communication with no networking issues
     - Improved stability and reduced error rates
   
   - **WebSocket Transport (Legacy)**:
     - Claude Desktop connects to the MCP server via WebSockets
     - Requires port management and can have network-related issues
   
   - Both methods use JSON-RPC 2.0 format for requests and responses
   - Used for real-time interactions (e.g., tool calls)

2. **Shared State Files**:
   - Located in the Claude configuration directory (`%APPDATA%\Claude\`)
   - Used for asynchronous actions that the bridge process handles
   - Bridge monitors these files for changes and executes actions

## Session State Protocol

The `session_state.json` file in the Claude directory serves as the shared state:

```json
{
  "last_updated": 1686754800123,
  "active_conversation": "conv_123",
  "pending_actions": [
    {
      "id": "action_001",
      "type": "analyze_file",
      "params": {"file_path": "C:/path/to/file.py"},
      "timestamp": 1686754800123,
      "status": "pending"
    }
  ],
  "bridge_info": {
    "status": "running",
    "timestamp": 1686754800123,
    "pid": 12345,
    "mcp_server": {
      "status": "running",
      "port": 4323,
      "started_at": 1686754800123,
      "pid": 12346
    }
  }
}
```

## MCP Server

The custom MCP server implements the Model Context Protocol that Claude Desktop uses to communicate with external tools. Key features:

- **Transport Options**:
  - **Stdio (✅ Recommended)**: Direct stdin/stdout communication (`custom-claude-mcp-stdio.js`)
  - **WebSocket (Legacy)**: WebSocket server on port 4323 (`custom-claude-mcp.js`)
- **Identity Endpoint**: Provides server identity info
- **Tool Registration**: Registers tools that Claude can use
- **Plugin System**: Loads additional tools from plugins directory
- **JSON-RPC 2.0**: Uses standard RPC format for communication
- **Lock File Mechanism**: Prevents multiple instances from running concurrently

## Bridge Process

The bridge process is responsible for executing actions requested through the MCP server:

- **File Monitoring**: Watches for changes to shared state files
- **Action Processing**: Processes pending actions in the session state
- **Configuration Management**: Updates Claude Desktop configuration files
- **Backup Creation**: Creates backups before modifying files
- **Error Handling**: Robust error handling and logging

## Supported Actions

The system supports these actions (and can be extended):

1. **open_conversation**: Open a specific conversation in Claude Desktop
2. **switch_model**: Switch the Claude Desktop model
3. **update_mcp_config**: Update MCP server configuration
4. **analyze_file**: Analyze a file in Claude Desktop
5. **save_conversation**: Save the current conversation to a file
6. **execute_from_code**: Execute actions in Claude Desktop triggered from Claude Code

## Plugin System

The plugin system allows extending the MCP server with additional tools:

- Plugins are JavaScript files in the `plugins` directory
- Each plugin exports a default object with metadata and tools
- Tools consist of a name, description, parameters schema, and handler function
- Plugins are loaded automatically when the MCP server starts

Example plugin structure:

```javascript
export default {
  name: 'plugin-name',
  version: '1.0.0',
  description: 'Plugin description',
  tools: [
    {
      name: "tool_name",
      description: "Tool description",
      parameters: {
        // JSON Schema for parameters
      },
      handler: async (params) => {
        // Tool implementation
      }
    }
  ]
};
```

## Code to Desktop Integration

The extension enables secure communication between Claude Code and Claude Desktop through the MCP server:

```
┌───────────────┐     ┌────────────────┐     ┌─────────────────┐
│  Claude Code  │────►│   MCP Server   │────►│ Claude Desktop  │
└───────────────┘     └────────────────┘     └─────────────────┘
        │                     ▲                      │
        │                     │                      │
        └─────────────────────┼──────────────────────┘
                  Shared Session Verification
```

### Key Components:

1. **Session Verification**:
   - Uses a shared session token system to verify that both clients belong to the same user
   - Prevents unauthorized triggers from external sources

2. **Trigger Mechanism**:
   - Claude Code creates trigger files in a shared directory
   - Bridge process monitors the directory and executes the requested actions
   - Actions run in the context of the local Claude Desktop session

3. **Execution Flow**:
   - Claude Code issues a command through the MCP server
   - MCP server verifies the session token
   - Bridge process detects the trigger and executes the action in Claude Desktop
   - Results are stored in the shared state for Claude Code to retrieve

### Security Considerations:

- All communication happens locally without exposing external APIs
- Session tokens are required to prevent unauthorized access
- Tokens expire after a set period (default: 24 hours)
- All actions and trigger files are logged for audit purposes

## Implementation Notes

1. **Working Directory**: The system uses absolute paths to avoid issues with working directory
2. **Error Handling**: Comprehensive error handling and logging
3. **Configuration**: Configurable through JSON files
4. **Backup System**: Creates backups before modifying important files
5. **Heartbeat**: WebSocket connections use heartbeats to detect disconnections

## Future Enhancements

1. **User Interface**: Add a web-based UI for management
2. **Authentication**: Add authentication for secure remote access
3. **Event System**: Add support for events from Claude Desktop
4. **Advanced Automation**: Add support for more complex automation scenarios
5. **Distribution**: Package the system for easy installation

## Setup Instructions

See the [Installation Guide](../README.md) for setup instructions.
