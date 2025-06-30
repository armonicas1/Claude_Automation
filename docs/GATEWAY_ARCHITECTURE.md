# Gateway Architecture

This document describes the architecture of the Claude Desktop Gateway system, which enables Claude Desktop to act as a model gateway for other applications.

## Overview

The gateway architecture provides a bridge between Claude Desktop and external applications using the Model Context Protocol (MCP). It allows applications to leverage Claude's AI capabilities without directly integrating with the Claude API.

## Key Components

### 1. Claude Desktop Gateway (claude-desktop-gateway.js)

The gateway service is the central component that:
- Listens for incoming MCP requests from client applications
- Routes these requests to Claude Desktop
- Returns responses from Claude Desktop back to the clients
- Manages session state and authentication
- Handles protocol translation and error conditions

### 2. Claude Desktop Bridge (claude-desktop-bridge.py)

The bridge process:
- Runs alongside Claude Desktop
- Monitors file system for requests from the gateway
- Injects these requests into Claude Desktop
- Captures responses from Claude Desktop
- Writes responses back to files for the gateway to read

### 3. Model Context Protocol Server

The MCP server:
- Provides a standardized API for clients to communicate with Claude
- Implements the Model Context Protocol specification
- Translates client requests into a format understood by the gateway
- Handles tool registration and execution

### 4. Client Applications

Client applications connect to the MCP server and can:
- Send requests to Claude Desktop
- Receive responses from Claude
- Register custom tools that extend Claude's capabilities
- Maintain session context across interactions

## Communication Flow

1. A client application sends a request to the MCP server
2. The MCP server formats the request and sends it to the gateway
3. The gateway writes the request to a file in a designated location
4. The bridge detects the file change and reads the request
5. The bridge injects the request into Claude Desktop
6. Claude Desktop processes the request and generates a response
7. The bridge captures the response and writes it to a response file
8. The gateway detects the response file and reads the content
9. The gateway sends the response back to the MCP server
10. The MCP server formats the response and sends it to the client application

## File-Based Communication

The system uses file-based communication between the gateway and bridge:

- **pending_actions.json**: Contains requests from the gateway to the bridge
- **bridge_status.json**: Contains the current status of the bridge
- **action_results/**: Directory containing response files from the bridge

This approach allows for:
- Cross-language communication (JavaScript to Python)
- Persistence of requests and responses
- Recovery from failures
- Debugging of the communication flow

## Configuration

The gateway architecture is configured through:

- **claude-config.json**: Contains ports, timeouts, and other gateway settings
- **dev-hub-config.json**: Contains settings for development tools integration

## Security Considerations

The gateway architecture implements several security measures:

- Local-only communication by default
- Session-based authentication
- Request validation and sanitization
- Timeouts for abandoned requests
- Controlled tool execution environment

## Extending the Gateway

The gateway can be extended through:

1. **Custom Tools**: New tools can be registered with the MCP server
2. **Plugins**: Plugins can add new functionality to the gateway
3. **Protocol Extensions**: The MCP protocol can be extended for specific use cases

## Limitations

Current limitations of the gateway architecture:

- Only supports local Claude Desktop instances
- Limited concurrent request handling
- File-based communication can introduce latency
- Depends on Claude Desktop's UI stability