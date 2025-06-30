# System Architecture

This document provides a comprehensive overview of the Claude Automation project's architecture, describing how different components interact and the overall system design.

## System Overview

The Claude Automation project consists of several interconnected components that work together to:

1. Enable automation capabilities for Claude Desktop
2. Provide a Model Context Protocol (MCP) server implementation
3. Allow Claude Desktop to act as a model gateway for other applications
4. Facilitate development tools integration through plugins
5. Support code context sharing between Claude Code and Claude Desktop

## Core Architecture Layers

The system architecture is organized into several layers:

### 1. User Interface Layer

- **Claude Desktop**: The main application that provides the user interface for interacting with Claude
- **Development Tools**: External tools and IDEs that can connect to the system

### 2. Bridge Layer

- **Claude Desktop Bridge**: Python-based bridge that connects to Claude Desktop
- **Bridge JavaScript API**: JavaScript implementation providing event-driven bridge capabilities

### 3. Gateway Layer

- **Claude Desktop Gateway**: Routes requests between MCP server and Claude Desktop
- **Session Manager**: Manages user sessions and authentication

### 4. Protocol Layer

- **MCP Server**: Implements the Model Context Protocol for standardized communication
- **Custom Claude MCP**: Extends the standard MCP with Claude-specific features

### 5. Plugin Layer

- **Code-to-Desktop Plugin**: Enables integration between Claude Code and Claude Desktop
- **File Operations Plugin**: Provides file system operation capabilities
- **Other Plugins**: Extensible system for additional functionality

### 6. Client Layer

- **Claude Desktop Client**: Client interface for interacting with the Claude Desktop Bridge
- **Claude Code Client**: Client library for interacting with Claude Code
- **Dev Hub Client**: Client library for the development hub services

## Component Interactions

### Startup Flow

1. The user runs `start.bat` which launches `start-services.js`
2. `start-services.js` initializes the MCP server, gateway, and required plugins
3. The gateway establishes communication with Claude Desktop through the bridge
4. Clients can connect to the MCP server once all services are running

### Request Processing Flow

1. A client sends a request to the MCP server
2. The MCP server processes the request and invokes any required tools
3. If Claude's capabilities are needed, the request is forwarded to the gateway
4. The gateway translates the request and writes it to a file for the bridge
5. The bridge detects the file change and processes the request with Claude Desktop
6. The response flows back through the bridge, gateway, and MCP server to the client

### Tool Execution Flow

1. A client requests a tool execution via the MCP server
2. The MCP server identifies the appropriate plugin for the tool
3. The plugin executes the tool with provided parameters
4. Results are returned to the MCP server and back to the client

## Key Design Patterns

### Observer Pattern

The bridge uses an observer pattern (via watchdog) to monitor file system changes, allowing for event-driven communication between components.

### Adapter Pattern

The gateway serves as an adapter between the MCP protocol and Claude Desktop's internal communication mechanisms.

### Plugin Pattern

The system uses a plugin architecture for extensibility, allowing new tools and capabilities to be added without modifying core components.

### Proxy Pattern

The bridge acts as a proxy for Claude Desktop, enabling external components to interact with Claude indirectly.

## Communication Protocols

### File-Based Communication

- Used between the gateway and bridge
- JSON-formatted messages in designated files
- File system events trigger processing

### HTTP-Based Communication

- Used between clients and the MCP server
- REST API endpoints for requests and responses
- WebSocket for real-time updates when needed

### MCP Protocol

- Standardized Model Context Protocol for AI interactions
- Tool registration and execution framework
- Context management for conversations

## Data Flow Diagrams

```
Client Application → MCP Server → Gateway → Bridge → Claude Desktop
                  ↑                                            ↓
                  └────────────────────────────────────────────┘
```

```
Dev Tools → Dev Hub Client → Dev Hub MCP Server → Custom Tools
                                               ↓
                                        Gateway → Claude Desktop
```

## Deployment Architecture

### Development Environment

- All components run locally on the developer's machine
- Local file paths for communication
- Development-specific configuration

### Production Environment

- Components can be distributed across different machines
- Network communication between components
- Production-specific configuration with enhanced security

## Security Architecture

- Local-only communication by default
- Session-based authentication
- Request validation and sanitization
- Controlled execution environment for tools
- Configuration validation

## Error Handling and Recovery

- Heartbeat mechanism to detect component availability
- Automatic reconnection attempts
- Persistent request storage for recovery
- Graceful degradation when components are unavailable

## Configuration Management

- JSON-based configuration files
- Runtime configuration updates
- Environment-specific configurations
- Validation of configuration changes

## Extensibility Points

1. **New Plugins**: Additional plugins can be created to extend functionality
2. **Custom Tools**: New tools can be registered with the MCP server
3. **Protocol Extensions**: The MCP protocol can be extended for specific use cases
4. **Alternative Clients**: New client implementations can be created for different platforms

## System Requirements

- Node.js 16.0 or higher
- Python 3.8 or higher
- Claude Desktop installed
- Sufficient disk space for logs and temporary files
- Network connectivity between distributed components (if applicable)

## Performance Considerations

- File-based communication introduces some latency
- Concurrent request handling is limited
- Tool execution may have performance implications
- Response times depend on Claude Desktop's processing speed
