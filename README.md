### [README.md](file:///c%3A/Users/dimas/Projects/claude-desktop-extension/README.md)

```markdown
# Claude Desktop Extension

Add automation capabilities to Claude Desktop through the Model Context Protocol (MCP) and use Claude Desktop as a model gateway for Claude Code.

## Table of Contents
- [Overview](#overview)
- [Installation](#installation)
  - [Prerequisites](#prerequisites)
  - [Setup](#setup)
- [Configuration](#configuration)
- [Features](#features)
  - [Claude Desktop Extension](#claude-desktop-extension)
  - [Claude Desktop as Model Gateway](#claude-desktop-as-model-gateway)
- [Architecture](#architecture)
  - [Key Components](#key-components)
  - [Python Files](#python-files)
  - [JavaScript Source Files](#javascript-source-files)
  - [Plugin Files](#plugin-files)
  - [Script Files](#script-files)
  - [Documentation](#documentation)
  - [Key Insights on Project Architecture](#key-insights-on-project-architecture)
- [Development](#development)
  - [Project Structure](#project-structure)
  - [Adding New Tools](#adding-new-tools)
  - [Debugging](#debugging)
  - [Testing](#testing)
- [Using Claude Desktop as a Model Gateway](#using-claude-desktop-as-a-model-gateway)
  - [Architecture](#architecture-1)
  - [Benefits](#benefits)
  - [Example Usage](#example-usage)

## Overview

This project provides an extension system for Claude Desktop that enables:

- Tool integration through the Model Context Protocol (MCP)
- Automation of Claude Desktop through a bridge process
- Plugin system for extending functionality
- Using Claude Desktop as a model gateway for Claude Code
- Enhanced development tools with browser and code context

## Installation

### Prerequisites

- Node.js 16.0 or higher
- Claude Desktop installed
- Windows (or macOS/Linux with modifications)

### Setup

1. Clone this repository:
   ```
   git clone https://your-repo-url/claude-desktop-extension.git
   cd claude-desktop-extension
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Update Claude Desktop configuration:
   
   Edit `%APPDATA%\Claude\claude_desktop_config.json` to include the custom MCP server:
   
   ```json
   {
     "mcpServers": {
       "custom-extension": {
         "external": true,
         "port": 4323,
         "host": "localhost"
       }
     }
   }
   ```

4. Start the services:
   
   For the basic extension:
   ```
   npm run start:all
   ```
   
   For the Model Gateway (Claude Code integration):
   ```
   npm run start:model-gateway
   ```
   
   Or on Windows, simply run one of these batch files:
   ```
   start.bat             # Basic extension
   start-model-gateway.bat  # Model Gateway
   ```

5. Launch Claude Desktop and it should connect to your custom MCP server

## Configuration

The project has two main configuration files:

1. **Claude Desktop Extension**: `config/claude-config.json`:
   ```json
   {
     "mcpPort": 4323,
     "toolsPort": 4322,
     "logLevel": "info"
   }
   ```

2. **Model Gateway**: `config/dev-hub-config.json`:
   ```json
   {
     "port": 4323,
     "browserToolsPort": 4322,
     "heartbeatIntervalMs": 30000,
     "logLevel": "info"
   }
   ```

## Features

### Claude Desktop Extension

#### Built-in Tools
- **open_conversation**: Open a specific conversation in Claude Desktop
- **switch_model**: Switch the Claude Desktop model
- **update_mcp_config**: Update MCP server configuration
- **analyze_file**: Analyze a file in Claude Desktop
- **save_conversation**: Save the current conversation to a file
- **execute_from_code**: Execute actions in Claude Desktop triggered from Claude Code

#### Plugin System
The system can be extended with plugins. See the `plugins` directory for examples:
- `file-operations-plugin.js`: Adds file operation tools
- `code-to-desktop-plugin.js`: Enables Claude Code to Claude Desktop communication

To create a plugin:
1. Create a new JavaScript file in the `plugins` directory
2. Export a default object with metadata and tools
3. Restart the MCP server

### Claude Desktop as Model Gateway

#### Development Tools
- **analyze_codebase**: Analyze a codebase using Claude Desktop as the model provider
- **debug_with_browser_context**: Debug an issue using both code and browser context
- **analyze_performance**: Analyze performance issues combining code and browser data
- **code_review**: Review code changes with browser context for enhanced understanding

## Architecture

This project uses a hybrid approach with two main architectural patterns:

1. **Claude Desktop Extension**:
   - **MCP Server**: Implements the Model Context Protocol for direct integration with Claude Desktop
   - **Bridge Process**: Monitors shared state and executes actions
   - **Shared State**: Uses files in the Claude directory for communication
   - **Plugin System**: Allows extending functionality with additional tools

2. **Claude Desktop as Model Gateway**:
   - **Dev Hub MCP Server**: Provides development tools for Claude Code
   - **Desktop Gateway**: Routes requests from Claude Code to Claude Desktop
   - **Shared Directory Protocol**: Enables secure communication between components
   - **Browser Tools Integration**: Leverages browser context for enhanced analysis

### Key Components

The Claude Desktop Extension project implements a hybrid architecture with two main patterns:

1. **Basic Extension Pattern**:
   - Uses an MCP server that Claude Desktop connects to directly
   - Employs a bridge process for monitoring shared state
   - Offers a plugin system for extending functionality
   - Communication happens through shared files in the Claude directory

2. **Model Gateway Pattern**:
   - Enables Claude Desktop to act as a model gateway for Claude Code
   - Implements a Dev Hub MCP server for development tools
   - Uses a Desktop Gateway for routing requests
   - Integrates with browser tools for enhanced context

### Python Files

1. **claude-desktop-bridge.py**
   - **Purpose**: Acts as a bridge between the Claude Desktop application and the extension system.
   - **State**: Fully implemented Python script that monitors shared files (like `pending_actions.json`) and executes actions requested by the extension.
   - **Utilization**: Core component that handles communication between Claude Desktop and the custom extension. It processes actions like adding/removing MCP servers, switching models, and reloading configurations.
   - **Key functionality**: File watching, action processing, and configuration management for Claude Desktop.

2. **claude-desktop-client.py**
   - **Purpose**: Client utility to send commands to the bridge from command line.
   - **State**: Complete implementation with command-line interface for interacting with the bridge.
   - **Utilization**: Used for testing and manual interaction with the bridge process.
   - **Key functionality**: Provides commands for adding/removing MCP servers, switching models, reloading configurations, and checking bridge status.

### JavaScript Source Files

3. **claude-desktop-bridge.js**
   - **Purpose**: JavaScript implementation of the bridge functionality.
   - **State**: Complete implementation with more advanced features than the Python version.
   - **Utilization**: Alternative to the Python bridge with enhanced capabilities and integration with Node.js ecosystem.
   - **Key functionality**: Monitors session state, processes actions, triggers Claude Desktop functions, and handles code triggers from Claude Code.

4. **custom-claude-mcp.js**
   - **Purpose**: Model Context Protocol (MCP) server implementation for Claude Desktop integration.
   - **State**: Fully implemented MCP server that Claude Desktop can connect to.
   - **Utilization**: Core component for extending Claude Desktop with custom tools. It implements WebSocket server, tool definitions, and dynamic plugin loading.
   - **Key functionality**: Provides tool interface for Claude Desktop, processes tool calls, and routes them to appropriate handlers.

5. **claude-code-client.js**
   - **Purpose**: Client utility for Claude Code to trigger Claude Desktop actions.
   - **State**: Complete implementation with session management and action execution.
   - **Utilization**: Used by Claude Code to communicate with Claude Desktop through the MCP server.
   - **Key functionality**: Manages sessions, executes actions, and checks trigger status.

6. **claude-desktop-gateway.js**
   - **Purpose**: Gateway process that monitors requests from MCP server and interacts with Claude Desktop.
   - **State**: Comprehensive implementation that acts as intermediary between Dev Hub and Claude Desktop.
   - **Utilization**: Core component of the model gateway architecture.
   - **Key functionality**: Formats prompts based on request type, manages communication through file-based protocol.

7. **dev-hub-client.js**
   - **Purpose**: Client library for Claude Code to interact with the Dev Hub MCP server.
   - **State**: Complete implementation with WebSocket-based communication.
   - **Utilization**: Used by Claude Code to access the enhanced development tools.
   - **Key functionality**: Connects to Dev Hub MCP server, initializes session, and provides convenience methods for common development tasks.

8. **dev-hub-mcp-server.js**
   - **Purpose**: Development Hub MCP server that routes requests from Claude Code to Claude Desktop.
   - **State**: Appears to be a complex implementation with extensive tool definitions.
   - **Utilization**: Core component of the model gateway architecture, providing developer tools.
   - **Key functionality**: Routes requests between Claude Code and Claude Desktop, integrates with browser tools.

9. **session-manager.js**
   - **Purpose**: Utility for managing Claude sessions across Code and Desktop environments.
   - **State**: Complete implementation of session creation, verification, and cleanup.
   - **Utilization**: Used by both Claude Code and Claude Desktop components to share authentication.
   - **Key functionality**: Creates and verifies session tokens, periodically cleans up expired sessions.

### Plugin Files

10. **file-operations-plugin.js**
    - **Purpose**: Plugin that adds file operation tools to the MCP server.
    - **State**: Complete plugin implementation with multiple tools.
    - **Utilization**: Demonstrates the plugin architecture and adds useful file operation capabilities.
    - **Key functionality**: Provides tools for analyzing files and saving conversations to files.

### Script Files

11. **start-services.js**
    - **Purpose**: Script to start both the MCP server and bridge process.
    - **State**: Simple but complete script for starting the extension services.
    - **Utilization**: Used as entry point for launching the extension system.
    - **Key functionality**: Spawns both the MCP server and bridge process with proper timing.

12. **update-claude-config.js**
    - **Purpose**: Script to update Claude Desktop configuration to use the custom MCP server.
    - **State**: Complete utility for configuring Claude Desktop.
    - **Utilization**: Used during setup to configure Claude Desktop to connect to the custom MCP server.
    - **Key functionality**: Updates Claude Desktop configuration with custom MCP server details, creates backups, and signals Claude to reload.

13. **test-client.js**
    - **Purpose**: Test client for the Claude Desktop Extension.
    - **State**: Fully implemented interactive client for testing the MCP server.
    - **Utilization**: Used for testing and demonstrating the extension's functionality.
    - **Key functionality**: Connects to the MCP server, provides an interactive menu for calling different tools, and displays responses.

14. **start-model-gateway.js**
    - **Purpose**: Script to start both the Dev Hub MCP server and Claude Desktop Gateway.
    - **State**: Complete implementation similar to start-services.js but for the model gateway components.
    - **Utilization**: Used to launch the model gateway architecture components.
    - **Key functionality**: Spawns both the Dev Hub MCP server and the Claude Desktop Gateway with proper timing.
 
15. **test-dev-hub.js**
    - **Purpose**: Test script to demonstrate Claude Code → Claude Desktop integration through the Dev Hub MCP.
    - **State**: Fully functional interactive test client for the Dev Hub.
    - **Utilization**: Used for testing and demonstrating the integration between Claude Code and Claude Desktop.
    - **Key functionality**: Provides an interactive menu for selecting various development tasks like code analysis, debugging, performance analysis, and code review.
 
16. **test-code-to-desktop.js**
    - **Purpose**: Test script for demonstrating Claude Code → Claude Desktop direct communication.
    - **State**: Complete test implementation with interactive CLI.
    - **Utilization**: Used for testing the direct communication from Claude Code to Claude Desktop.
    - **Key functionality**: Creates a test session and allows switching models, analyzing files, and opening conversations.

### Documentation

17. **README.md**
    - **Purpose**: Project documentation with installation, usage, and architecture information.
    - **State**: Comprehensive documentation covering all aspects of the project.
    - **Utilization**: Main reference for users and developers.
    - **Key sections**: Overview, installation, configuration, features, architecture, development, and usage guides.

### Key Insights on Project Architecture

**Two-Tier Architecture**:

- **Basic Extension Tier**: Represented by claude-desktop-bridge.py/js and custom-claude-mcp.js, providing direct tool integration with Claude Desktop.
- **Model Gateway Tier**: Represented by dev-hub-mcp-server.js, claude-desktop-gateway.js, and related clients, enabling Claude Desktop to serve as a model gateway for Claude Code.

**Communication Patterns**:

- **WebSocket-Based Communication**: Used for MCP server interactions (standard Model Context Protocol)
- **File-Based Communication**: Used for communicating between services through shared directories
- **Session-Based Authentication**: Implemented in session-manager.js for secure cross-application communication

**Development Tools Integration**:

- The project implements a robust system for development tasks through the Dev Hub MCP server
- Tools include code analysis, debugging with browser context, performance analysis, and code review
- Integration with browser tools provides full-stack context for development tasks

**Client Libraries**:

- claude-code-client.js provides a clean API for Claude Code to trigger actions in Claude Desktop
- dev-hub-client.js offers a high-level interface for accessing development tools

For more details, see the [Architecture Documentation](docs/ARCHITECTURE.md) and [Model Gateway Architecture](docs/GATEWAY_ARCHITECTURE.md).

## Development

### Project Structure

```
claude-desktop-extension/
├── src/
│   ├── claude-code-client.js      # Client utility for Claude Code to trigger Claude Desktop actions
│   ├── claude-desktop-bridge.js   # Bridge process that monitors shared state and executes actions in Claude Desktop
│   ├── claude-desktop-gateway.js  # Gateway process that monitors requests from MCP server and interacts with Claude Desktop
│   ├── custom-claude-mcp.js       # MCP server implementation that Claude Desktop connects to for tool integration
│   ├── dev-hub-client.js          # Client library for Claude Code to interact with the Dev Hub MCP server
│   ├── dev-hub-mcp-server.js      # Development Hub MCP server that routes requests from Claude Code to Claude Desktop
│   └── session-manager.js         # Utility for managing Claude sessions across Code and Desktop environments
├── scripts/
│   ├── start-services.js          # Script to start extension services
│   ├── start-model-gateway.js     # Script to start model gateway services
│   ├── test-client.js             # Test client script
│   ├── test-code-to-desktop.js    # Test Code to Desktop communication
│   ├── test-dev-hub.js            # Test Dev Hub integration
│   └── update-claude-config.js    # Update Claude config script
├── plugins/
│   ├── code-to-desktop-plugin.js  # Plugin for Code to Desktop communication
│   └── file-operations-plugin.js  # Sample plugin for file operations
├── config/
│   ├── claude-config.json         # Extension configuration
│   └── dev-hub-config.json        # Dev Hub configuration
├── docs/
│   ├── ARCHITECTURE.md            # Extension architecture documentation
│   ├── claude-desktop-bridge-guide.md  # Bridge usage guide
│   ├── claude-desktop-extension-schema.md  # Extension schema
│   ├── GATEWAY_ARCHITECTURE.md    # Model gateway architecture documentation
│   └── requirements.txt           # Python requirements
├── claude-desktop-bridge.py       # Python implementation of bridge
├── claude-desktop-client.py       # Python client for Claude Desktop
├── package.json                   # Node.js package file
├── start.bat                      # Windows batch file to start extension
├── start-model-gateway.bat        # Windows batch file to start model gateway
└── update-config.bat              # Batch file to update config
```

### Adding New Tools

To add a new tool to the MCP server:

1. Add the tool definition to `src/custom-claude-mcp.js` or create a plugin
2. Implement the action handler in `src/claude-desktop-bridge.js`
3. Restart the services

To add a new development tool to the Dev Hub:

1. Add the tool definition to `src/dev-hub-mcp-server.js`
2. Update the Claude Desktop Gateway in `src/claude-desktop-gateway.js` to handle the new tool
3. Add a convenience method to `src/dev-hub-client.js`
4. Restart the model gateway services

### Debugging

Logs are stored in the `logs` directory:

- `mcp-server.log`: MCP server logs
- `bridge.log`: Bridge process logs
- `dev-hub-mcp.log`: Dev Hub MCP server logs
- `desktop-gateway.log`: Claude Desktop Gateway logs

### Testing

The project includes several test scripts:

1. **Test Code to Desktop Communication**:
   ```
   npm run test:code-to-desktop
   ```

2. **Test Dev Hub Integration**:
   ```
   npm run test:dev-hub
   ```

## Using Claude Desktop as a Model Gateway

This project enables using Claude Desktop as a model gateway for Claude Code, keeping everything within Anthropic's ecosystem while leveraging MCP servers for enhanced capabilities.

### Architecture

```
┌───────────────┐     ┌────────────────┐     ┌─────────────────┐     ┌───────────────┐
│  Claude Code  │────►│  Dev Hub MCP   │────►│ Claude Desktop  │────►│ Anthropic API │
│     CLI       │     │    Server      │     │ (Model Gateway) │     │               │
└───────────────┘     └────────────────┘     └─────────────────┘     └───────────────┘
                             │  ▲
                             │  │
                             ▼  │
                      ┌────────────────┐
                      │  Browser Tools │
                      │  MCP Server    │
                      └────────────────┘
```

### Benefits

- **Centralized Model Access**: All model requests go through Claude Desktop
- **Single API Key Management**: Only Desktop needs Anthropic credentials
- **Enhanced Context**: MCP servers provide rich development context
- **No External Dependencies**: Pure Anthropic ecosystem
- **Browser Integration**: Compatible with browser tools for full-stack context

### Example Usage

Claude Code can use Claude Desktop as a model gateway for various development tasks:

```bash
# Analyze a codebase using Claude Desktop as the model provider
claude use dev-hub analyze_codebase --directory ./my-project --analysis-type comprehensive

# Debug with browser context
claude use dev-hub debug_with_browser_context --error-message "Authentication fails" --code-files auth.js,user.js

# Analyze performance with network monitoring
claude use dev-hub analyze_performance --page "/dashboard" --capture-network true --capture-console true

# Review code changes with browser context
claude use dev-hub code_review --directory ./my-project --pr-number 123 --include-browser-context true
```

For more details, see the [Model Gateway Architecture](docs/GATEWAY_ARCHITECTURE.md).
```
