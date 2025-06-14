# Claude Desktop Extension Architecture

This document outlines the architecture and interaction model for the Claude Desktop Extension system.

## Directory Structure

The extension uses the existing Claude Desktop configuration directory with additional files:

```
%APPDATA%\Claude\
├── claude_desktop_config.json     # Main Claude config (already exists)
├── config.json                    # Claude config (already exists)
├── pending_actions.json           # Queue of actions to be processed
├── bridge_status.json             # Status of the bridge process
└── reload_config                  # Signal file for config reload
```

## Configuration Schema

### claude_desktop_config.json

The existing Claude Desktop configuration file, with MCP server configurations:

```json
{
  "mcpServers": {
    "claude-mcp": {
      "external": false,           // Whether Claude manages this server
      "port": 3026,                // Server port
      "host": "localhost",         // Server host
      "command": "node",           // Command to run (if not external)
      "args": ["path/to/script"],  // Arguments for command
      "env": {                     // Environment variables
        "PORT": "3026",
        "NODE_ENV": "production"
      },
      "cwd": "path/to/directory"   // Working directory
    },
    "browser-tools": {
      // Similar configuration
    }
  },
  "autoStart": {
    "servers": ["claude-mcp", "browser-tools"] // Servers to auto-start
  },
  // Other Claude Desktop settings
}
```

### pending_actions.json

Stores the queue of actions to be processed by the bridge:

```json
{
  "actions": [
    {
      "action": "add_mcp_server",    // Action type
      "params": {                    // Action parameters
        "name": "my-server",
        "config": {
          "external": true,
          "port": 4322,
          "host": "localhost"
        },
        "autoStart": true
      },
      "timestamp": 1686754800.123,   // When the action was created
      "status": "pending",           // Status: pending, completed, failed
      "client": "claude-desktop-client" // Client that created the action
    }
  ]
}
```

### bridge_status.json

Status information for the bridge process:

```json
{
  "status": "running",            // running, stopped, error
  "pid": 12345,                   // Process ID of the bridge
  "timestamp": 1686754800.123,    // Last update time
  "host": "localhost"             // Host the bridge is running on
}
```

## Supported Actions

The bridge supports the following actions:

### 1. add_mcp_server

Add a new MCP server configuration to Claude Desktop.

```json
{
  "action": "add_mcp_server",
  "params": {
    "name": "my-server",              // Server name
    "config": {                        // Server configuration
      "external": true,                // Always true for external servers
      "port": 4322,                    // Server port
      "host": "localhost"              // Server host
    },
    "autoStart": true                  // Whether to auto-start
  }
}
```

### 2. remove_mcp_server

Remove an MCP server configuration.

```json
{
  "action": "remove_mcp_server",
  "params": {
    "name": "my-server"               // Server name to remove
  }
}
```

### 3. reload_config

Request Claude Desktop to reload its configuration.

```json
{
  "action": "reload_config",
  "params": {}
}
```

### 4. restart_claude

Request Claude Desktop to restart.

```json
{
  "action": "restart_claude",
  "params": {}
}
```

### 5. switch_model

Request Claude Desktop to switch its default model (if supported).

```json
{
  "action": "switch_model",
  "params": {
    "model": "claude-3-opus"         // Model name
  }
}
```

## Implementation Notes

1. The bridge monitors the `pending_actions.json` file for changes
2. Claude Desktop would need to check for this file and process actions on startup
3. Both programs need appropriate error handling for file access conflicts
4. The bridge creates backups before modifying configuration files
5. All timestamps use Unix time (seconds since epoch)
6. Actions have a status to track their processing state

## Dependencies

- Python 3.7+
- watchdog (for file monitoring)
- psutil (for process management on Windows)

## Security Considerations

1. This approach only modifies configuration files, not running processes
2. It relies on file-based IPC, so access to the Claude directory implies full control
3. There is no authentication mechanism between client and bridge
4. Actions are limited to configuration changes only

## Future Extensions

1. WebSocket server for real-time control
2. Authentication mechanism for clients
3. Event notifications from Claude Desktop
4. Support for more granular control over conversations
5. Actual plugin support if Claude Desktop adds such capability
