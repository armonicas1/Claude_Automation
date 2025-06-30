// custom-claude-mcp.js
// MCP server implementation that Claude Desktop can connect to

import http from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';

// WSL Authentication Auto-Detection
function detectAndSetWslAuth() {
  // Only auto-detect if ANTHROPIC_API_KEY is not already set
  if (process.env.ANTHROPIC_API_KEY) {
    return;
  }

  // Try multiple paths based on platform
  const wslCredentialsPaths = [
    '/home/dimas/.claude/.credentials.json',  // Direct WSL path (if running in WSL)
    'C:\\Users\\dimas\\AppData\\Local\\Packages\\CanonicalGroupLimited.Ubuntu24.04LTS_79rhkp1fndgsc\\LocalState\\rootfs\\home\\dimas\\.claude\\.credentials.json',  // Windows to WSL path
    '\\\\wsl$\\Ubuntu-24.04\\home\\dimas\\.claude\\.credentials.json',  // WSL network path
    '\\\\wsl.localhost\\Ubuntu-24.04\\home\\dimas\\.claude\\.credentials.json'  // Alternative WSL network path
  ];
  
  try {
    for (const credentialsPath of wslCredentialsPaths) {
      if (fs.existsSync(credentialsPath)) {
        const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        
        if (credentials.claudeAiOauth && credentials.claudeAiOauth.accessToken) {
          process.env.ANTHROPIC_API_KEY = credentials.claudeAiOauth.accessToken;
          process.env.CLAUDE_API_KEY = credentials.claudeAiOauth.accessToken;
          console.log(`[${new Date().toISOString()}] INFO: Auto-detected WSL Claude Code credentials from ${credentialsPath}`);
          return; // Success, exit early
        }
      }
    }
  } catch (error) {
    // Silently fail - this is auto-detection, not critical
  }
}

// Run WSL auth detection immediately
detectAndSetWslAuth();

// Calculate absolute paths regardless of working directory
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const CONFIG_PATH = path.join(PROJECT_ROOT, 'config', 'claude-config.json');
const PLUGINS_DIR = path.join(PROJECT_ROOT, 'plugins');
const LOG_DIR = path.join(PROJECT_ROOT, 'logs');

// Ensure directories exist
if (!fs.existsSync(path.join(PROJECT_ROOT, 'config'))) {
  fs.mkdirSync(path.join(PROJECT_ROOT, 'config'), { recursive: true });
}
if (!fs.existsSync(PLUGINS_DIR)) {
  fs.mkdirSync(PLUGINS_DIR, { recursive: true });
}
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Default config if not exists
const defaultConfig = {
  mcpPort: 4323,
  toolsPort: 4322,
  logLevel: 'info'
};

// Load or create configuration
let config = defaultConfig;
try {
  if (fs.existsSync(CONFIG_PATH)) {
    config = { ...defaultConfig, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
  } else {
    // Create default config if doesn't exist
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
  }
} catch (err) {
  console.error('Error loading configuration:', err);
}

// Setup logging
const logFile = fs.createWriteStream(path.join(LOG_DIR, 'mcp-server.log'), { flags: 'a' });
const logger = {
  info: (message) => {
    const logEntry = `[${new Date().toISOString()}] INFO: ${message}`;
    console.log(logEntry);
    logFile.write(logEntry + '\n');
  },
  error: (message) => {
    const logEntry = `[${new Date().toISOString()}] ERROR: ${message}`;
    console.error(logEntry);
    logFile.write(logEntry + '\n');
  }
};

// Get the Claude directory
const claudeDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Claude');
const sessionStatePath = path.join(claudeDir, 'session_state.json');

// Ensure session state file exists
if (!fs.existsSync(sessionStatePath)) {
  const initialState = {
    last_updated: Date.now(),
    pending_actions: [],
    bridge_info: {
      status: 'initializing',
      timestamp: Date.now()
    }
  };
  fs.writeFileSync(sessionStatePath, JSON.stringify(initialState, null, 2));
}

// Port for the MCP server
const PORT = config.mcpPort || 4323;

logger.info(`Starting MCP server on port ${PORT}`);

// Create HTTP server for identity endpoint
const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Log request
  logger.info(`HTTP ${req.method} request for ${req.url}`);
  
  if (req.url === '/.identity') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({
      name: "Custom Claude Extension",
      version: "1.0.0",
      signature: "claude-desktop-extension",
      capabilities: ["tools", "resources"]
    }));
    return;
  }
  
  res.writeHead(404);
  res.end('Not Found');
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Tool definitions
const tools = [
  {
    name: "open_conversation",
    description: "Opens a specific conversation in Claude Desktop",
    parameters: {
      type: "object",
      properties: {
        conversation_id: {
          type: "string",
          description: "ID of the conversation to open"
        }
      },
      required: ["conversation_id"]
    },
    handler: async (params) => {
      const { conversation_id } = params;
      
      // Update shared state file to signal Claude Desktop
      try {
        let sessionState = {};
        try {
          if (fs.existsSync(sessionStatePath)) {
            sessionState = JSON.parse(fs.readFileSync(sessionStatePath, 'utf8'));
          }
        } catch (err) {
          logger.error('Error reading session state:', err);
        }
        
        // Update the state
        sessionState.pending_actions = sessionState.pending_actions || [];
        sessionState.pending_actions.push({
          id: `action_${Date.now()}`,
          type: "open_conversation",
          params: { conversation_id },
          timestamp: Date.now(),
          status: "pending"
        });
        
        // Write back the updated state
        fs.writeFileSync(sessionStatePath, JSON.stringify(sessionState, null, 2));
        
        logger.info(`Requested to open conversation ${conversation_id}`);
        return { success: true, message: `Requested to open conversation ${conversation_id}` };
      } catch (err) {
        logger.error(`Error opening conversation: ${err.message}`);
        throw new Error(`Failed to open conversation: ${err.message}`);
      }
    }
  },
  {
    name: "switch_model",
    description: "Switch the Claude Desktop model",
    parameters: {
      type: "object",
      properties: {
        model: {
          type: "string",
          description: "Model name to switch to (e.g., 'claude-3-opus', 'claude-3-sonnet')"
        }
      },
      required: ["model"]
    },
    handler: async (params) => {
      const { model } = params;
      
      try {
        let sessionState = {};
        try {
          if (fs.existsSync(sessionStatePath)) {
            sessionState = JSON.parse(fs.readFileSync(sessionStatePath, 'utf8'));
          }
        } catch (err) {
          logger.error('Error reading session state:', err);
        }
        
        // Update the state
        sessionState.pending_actions = sessionState.pending_actions || [];
        sessionState.pending_actions.push({
          id: `action_${Date.now()}`,
          type: "switch_model",
          params: { model },
          timestamp: Date.now(),
          status: "pending"
        });
        
        // Write back the updated state
        fs.writeFileSync(sessionStatePath, JSON.stringify(sessionState, null, 2));
        
        logger.info(`Requested to switch model to ${model}`);
        return { success: true, message: `Requested to switch model to ${model}` };
      } catch (err) {
        logger.error(`Error switching model: ${err.message}`);
        throw new Error(`Failed to switch model: ${err.message}`);
      }
    }
  },
  {
    name: "update_mcp_config",
    description: "Update MCP server configuration",
    parameters: {
      type: "object",
      properties: {
        serverName: {
          type: "string",
          description: "Name of the MCP server to update"
        },
        config: {
          type: "object",
          description: "Server configuration object"
        }
      },
      required: ["serverName", "config"]
    },
    handler: async (params) => {
      const { serverName, config } = params;
      
      try {
        let sessionState = {};
        try {
          if (fs.existsSync(sessionStatePath)) {
            sessionState = JSON.parse(fs.readFileSync(sessionStatePath, 'utf8'));
          }
        } catch (err) {
          logger.error('Error reading session state:', err);
        }
        
        // Update the state
        sessionState.pending_actions = sessionState.pending_actions || [];
        sessionState.pending_actions.push({
          id: `action_${Date.now()}`,
          type: "update_mcp_config",
          params: { serverName, config },
          timestamp: Date.now(),
          status: "pending"
        });
        
        // Write back the updated state
        fs.writeFileSync(sessionStatePath, JSON.stringify(sessionState, null, 2));
        
        logger.info(`Requested to update MCP config for ${serverName}`);
        return { success: true, message: `Requested to update MCP config for ${serverName}` };
      } catch (err) {
        logger.error(`Error updating MCP config: ${err.message}`);
        throw new Error(`Failed to update MCP config: ${err.message}`);
      }
    }
  }
];

// Load plugins from plugins directory
try {
  if (fs.existsSync(PLUGINS_DIR)) {
    const pluginFiles = fs.readdirSync(PLUGINS_DIR).filter(file => file.endsWith('.js'));
    
    for (const pluginFile of pluginFiles) {
      try {
        logger.info(`Loading plugin: ${pluginFile}`);
        const pluginPath = path.join(PLUGINS_DIR, pluginFile);
        
        // Convert to file URL for ESM imports (Windows compatibility fix)
        const pluginUrl = new URL(`file://${pluginPath.replace(/\\/g, '/')}`);
        logger.info(`Loading plugin from URL: ${pluginUrl.href}`);
        
        const { default: plugin } = await import(pluginUrl);
        
        if (plugin && Array.isArray(plugin.tools)) {
          // Validate JSON structures in tools before adding
          const sanitizedTools = plugin.tools.map(tool => {
            try {
              // Deep clone tool definition to avoid reference issues
              const sanitizedTool = { ...tool };
              
              // Validate parameters JSON structure
              if (sanitizedTool.parameters) {
                const serialized = JSON.stringify(sanitizedTool.parameters);
                sanitizedTool.parameters = JSON.parse(serialized);
              }
              
              return sanitizedTool;
            } catch (error) {
              logger.error(`Tool validation failed for ${tool.name}: ${error.message}`);
              return null;
            }
          }).filter(Boolean); // Remove any null tools (failed validation)
          
          tools.push(...sanitizedTools);
          logger.info(`Added ${sanitizedTools.length} tools from plugin ${pluginFile}`);
        }
      } catch (err) {
        logger.error(`Error loading plugin ${pluginFile}: ${err.message}`);
      }
    }
  }
} catch (err) {
  logger.error(`Error loading plugins: ${err.message}`);
}

// Track connected clients
const clients = new Set();

// Handle WebSocket connections
wss.on('connection', (ws) => {
  clients.add(ws);
  logger.info(`WebSocket client connected from ${ws._socket ? ws._socket.remoteAddress : 'unknown'} (${clients.size} clients total)`);
  
  // Setup heartbeat
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  
  ws.on('message', async (message) => {
    try {
      const request = JSON.parse(message.toString());
      logger.info(`Received message: ${request.method}`);
      
      // Handle initialization
      if (request.method === 'initialize') {
        try {
          // Create response with just capabilities (no tools in initialize)
          const response = {
            jsonrpc: "2.0",
            id: request.id,
            result: {
              protocolVersion: "2024-11-05",
              capabilities: {
                tools: {}
              },
              serverInfo: {
                name: "Custom Claude Extension",
                version: "1.0.0"
              }
            }
          };
          
          // Validate the entire response
          const serializedResponse = JSON.stringify(response);
          const validatedResponse = JSON.parse(serializedResponse);
          
          // Log the exact JSON being sent for debugging
          logger.info(`Sending initialization response: ${serializedResponse}`);
          logger.info(`Response length: ${serializedResponse.length} characters`);
          logger.info(`First 20 characters: "${serializedResponse.substring(0, 20)}"`);
          
          ws.send(serializedResponse);
          logger.info(`Sent initialization response to client`);
        } catch (error) {
          logger.error(`Error in initialization handler: ${error.message}`);
          ws.send(JSON.stringify({
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: -32000,
              message: "Internal error during initialization"
            }
          }));
        }
      }
      
      // Handle tools list request
      else if (request.method === 'tools/list') {
        try {
          // Create a sanitized version of tools with validated parameters
          const sanitizedTools = tools.map(t => {
            // Deep clone tool definition
            const sanitizedTool = {
              name: t.name,
              description: t.description,
              inputSchema: t.parameters || {
                type: "object",
                properties: {},
                required: []
              }
            };
            
            // Double validate JSON structure
            if (sanitizedTool.inputSchema) {
              const serialized = JSON.stringify(sanitizedTool.inputSchema);
              sanitizedTool.inputSchema = JSON.parse(serialized);
            }
            
            return sanitizedTool;
          });
          
          // Create response with sanitized tools
          const response = {
            jsonrpc: "2.0",
            id: request.id,
            result: {
              tools: sanitizedTools
            }
          };
          
          // Validate the entire response
          const serializedResponse = JSON.stringify(response);
          const validatedResponse = JSON.parse(serializedResponse);
          
          // Log the exact JSON being sent for debugging
          logger.info(`Sending tools/list response: ${serializedResponse}`);
          logger.info(`Response length: ${serializedResponse.length} characters`);
          logger.info(`First 20 characters: "${serializedResponse.substring(0, 20)}"`);
          
          ws.send(serializedResponse);
          logger.info(`Sent ${sanitizedTools.length} tools to client via tools/list`);
        } catch (error) {
          logger.error(`Error in tools/list handler: ${error.message}`);
          ws.send(JSON.stringify({
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: -32000,
              message: "Internal error during tools list"
            }
          }));
        }
      }
      
      // Handle tool calls
      else if (request.method === 'tools/call') {
        const { id, params } = request;
        const { name, parameters } = params;
        
        logger.info(`Tool call: ${name} with parameters: ${JSON.stringify(parameters)}`);
        
        const tool = tools.find(t => t.name === name);
        if (!tool) {
          ws.send(JSON.stringify({
            jsonrpc: "2.0",
            id,
            error: {
              code: -32601,
              message: `Tool '${name}' not found`
            }
          }));
          return;
        }
        
        try {
          const result = await tool.handler(parameters);
          ws.send(JSON.stringify({
            jsonrpc: "2.0",
            id,
            result
          }));
        } catch (err) {
          logger.error(`Tool execution error: ${err.message}`);
          ws.send(JSON.stringify({
            jsonrpc: "2.0",
            id,
            error: {
              code: -32000,
              message: `Tool execution error: ${err.message}`
            }
          }));
        }
      }
      
      // Handle other methods
      else {
        logger.info(`Unhandled method: ${request.method}`);
        ws.send(JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32601,
            message: `Method '${request.method}' not found`
          }
        }));
      }
    } catch (err) {
      logger.error(`Error processing message: ${err.message}`);
      try {
        ws.send(JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: `Parse error: ${err.message}`
          }
        }));
      } catch (sendErr) {
        logger.error(`Error sending error response: ${sendErr.message}`);
      }
    }
  });
  
  // Handle disconnection
  ws.on('close', () => {
    clients.delete(ws);
    logger.info(`Client disconnected (${clients.size} clients remaining)`);
  });
  
  // Send server info
  try {
    const serverInfoMessage = {
      jsonrpc: "2.0",
      method: "notification/server_info",
      params: {
        name: "Custom Claude Extension",
        version: "1.0.0",
        tools: tools.length,
        clients: clients.size
      }
    };
    
    const serializedServerInfo = JSON.stringify(serverInfoMessage);
    logger.info(`Sending server info: ${serializedServerInfo}`);
    logger.info(`Server info length: ${serializedServerInfo.length} characters`);
    logger.info(`First 20 characters: "${serializedServerInfo.substring(0, 20)}"`);
    
    ws.send(serializedServerInfo);
  } catch (err) {
    logger.error(`Error sending server info: ${err.message}`);
  }
});

// Heartbeat interval to detect dead connections
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      clients.delete(ws);
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// Start the server
server.listen(PORT, () => {
  logger.info(`MCP Server is running on http://localhost:${PORT}`);
  
  // Update bridge status
  try {
    let sessionState = {};
    if (fs.existsSync(sessionStatePath)) {
      sessionState = JSON.parse(fs.readFileSync(sessionStatePath, 'utf8'));
    }
    
    sessionState.bridge_info = sessionState.bridge_info || {};
    sessionState.bridge_info.mcp_server = {
      status: 'running',
      port: PORT,
      started_at: Date.now(),
      pid: process.pid
    };
    
    fs.writeFileSync(sessionStatePath, JSON.stringify(sessionState, null, 2));
  } catch (err) {
    logger.error(`Error updating session state: ${err.message}`);
  }
});
