// test-client.js
// Test client for the Claude Desktop Extension

import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

// Calculate absolute paths
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const CONFIG_PATH = path.join(PROJECT_ROOT, 'config', 'claude-config.json');

// Load configuration
let config = { mcpPort: 4323 };
try {
  if (fs.existsSync(CONFIG_PATH)) {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  }
} catch (err) {
  console.error('Error loading configuration:', err);
}

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Connect to the MCP server
const PORT = config.mcpPort || 4323;
const ws = new WebSocket(`ws://localhost:${PORT}`);

// Message ID counter
let messageId = 1;

// Track request promises
const pendingRequests = new Map();

// Handle WebSocket events
ws.on('open', () => {
  console.log(`Connected to MCP server on port ${PORT}`);
  
  // Initialize the connection
  sendRequest('initialize', {
    clientName: 'test-client',
    version: '1.0.0'
  }).then(response => {
    console.log('Initialization successful!');
    console.log('Available tools:');
    
    const tools = response.result.capabilities.tools;
    tools.forEach(tool => {
      console.log(`- ${tool.name}: ${tool.description}`);
    });
    
    showMainMenu();
  }).catch(error => {
    console.error('Initialization failed:', error);
    ws.close();
  });
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    
    // Handle responses to requests
    if (message.id && pendingRequests.has(message.id)) {
      const { resolve, reject } = pendingRequests.get(message.id);
      pendingRequests.delete(message.id);
      
      if (message.error) {
        reject(message.error);
      } else {
        resolve(message);
      }
    }
    // Handle notifications
    else if (message.method && message.method.startsWith('notification/')) {
      console.log(`\nNotification received: ${message.method}`);
      console.log(message.params);
    }
  } catch (err) {
    console.error('Error processing message:', err);
  }
});

ws.on('close', () => {
  console.log('Disconnected from MCP server');
  rl.close();
  process.exit(0);
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

// Helper function to send a request and get a promise for the response
function sendRequest(method, params) {
  return new Promise((resolve, reject) => {
    const id = messageId++;
    
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };
    
    pendingRequests.set(id, { resolve, reject });
    ws.send(JSON.stringify(request));
  });
}

// Function to show the main menu
function showMainMenu() {
  console.log('\n--- Claude Desktop Extension Test Client ---');
  console.log('1. Call tool: switch_model');
  console.log('2. Call tool: update_mcp_config');
  console.log('3. Call tool: open_conversation');
  console.log('4. Call tool: analyze_file');
  console.log('5. Call tool: save_conversation');
  console.log('0. Exit');
  
  rl.question('\nEnter your choice: ', (choice) => {
    switch (choice) {
      case '1':
        callSwitchModelTool();
        break;
      case '2':
        callUpdateMcpConfigTool();
        break;
      case '3':
        callOpenConversationTool();
        break;
      case '4':
        callAnalyzeFileTool();
        break;
      case '5':
        callSaveConversationTool();
        break;
      case '0':
        console.log('Exiting...');
        ws.close();
        break;
      default:
        console.log('Invalid choice');
        showMainMenu();
        break;
    }
  });
}

// Functions to call specific tools

function callSwitchModelTool() {
  rl.question('Enter model name (e.g., claude-3-opus, claude-3-sonnet): ', (model) => {
    sendRequest('tools/call', {
      name: 'switch_model',
      parameters: { model }
    }).then(response => {
      console.log('Response:', response.result);
      showMainMenu();
    }).catch(error => {
      console.error('Error:', error);
      showMainMenu();
    });
  });
}

function callUpdateMcpConfigTool() {
  rl.question('Enter server name: ', (serverName) => {
    rl.question('Enter port: ', (port) => {
      rl.question('Auto-start? (y/n): ', (autoStart) => {
        const config = {
          external: true,
          port: parseInt(port, 10),
          host: 'localhost',
          autoStart: autoStart.toLowerCase() === 'y'
        };
        
        sendRequest('tools/call', {
          name: 'update_mcp_config',
          parameters: { serverName, config }
        }).then(response => {
          console.log('Response:', response.result);
          showMainMenu();
        }).catch(error => {
          console.error('Error:', error);
          showMainMenu();
        });
      });
    });
  });
}

function callOpenConversationTool() {
  rl.question('Enter conversation ID: ', (conversation_id) => {
    sendRequest('tools/call', {
      name: 'open_conversation',
      parameters: { conversation_id }
    }).then(response => {
      console.log('Response:', response.result);
      showMainMenu();
    }).catch(error => {
      console.error('Error:', error);
      showMainMenu();
    });
  });
}

function callAnalyzeFileTool() {
  rl.question('Enter file path: ', (file_path) => {
    sendRequest('tools/call', {
      name: 'analyze_file',
      parameters: { file_path }
    }).then(response => {
      console.log('Response:', response.result);
      showMainMenu();
    }).catch(error => {
      console.error('Error:', error);
      showMainMenu();
    });
  });
}

function callSaveConversationTool() {
  rl.question('Enter file path to save: ', (file_path) => {
    rl.question('Enter format (markdown, json, html, text): ', (format) => {
      sendRequest('tools/call', {
        name: 'save_conversation',
        parameters: { file_path, format }
      }).then(response => {
        console.log('Response:', response.result);
        showMainMenu();
      }).catch(error => {
        console.error('Error:', error);
        showMainMenu();
      });
    });
  });
}
