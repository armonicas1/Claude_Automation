// dev-hub-mcp-server.js
// Development Hub MCP server that routes requests from Claude Code to Claude Desktop

import http from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { exec, execSync } from 'child_process';
import crypto from 'crypto';

// Calculate absolute paths regardless of working directory
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const CONFIG_PATH = path.join(PROJECT_ROOT, 'config', 'dev-hub-config.json');
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
  port: 4323,
  browserToolsPort: 4322,
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
const logFile = fs.createWriteStream(path.join(LOG_DIR, 'dev-hub-mcp.log'), { flags: 'a' });
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
const requestsDir = path.join(claudeDir, 'code_requests');
const responsesDir = path.join(claudeDir, 'code_responses');

// Ensure Claude directories exist
if (!fs.existsSync(claudeDir)) {
  fs.mkdirSync(claudeDir, { recursive: true });
}
if (!fs.existsSync(requestsDir)) {
  fs.mkdirSync(requestsDir, { recursive: true });
}
if (!fs.existsSync(responsesDir)) {
  fs.mkdirSync(responsesDir, { recursive: true });
}

// Port for the MCP server
const PORT = config.port || 4323;
const BROWSER_TOOLS_PORT = config.browserToolsPort || 4322;

logger.info(`Starting Development Hub MCP server on port ${PORT}`);
logger.info(`Looking for Browser Tools MCP on port ${BROWSER_TOOLS_PORT}`);

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
  
  // Identity endpoint
  if (req.url === '/.identity') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({
      name: "Claude Development Hub MCP",
      version: "1.0.0",
      signature: "claude-dev-hub-mcp",
      capabilities: ["tools", "resources"]
    }));
    return;
  }
  
  res.writeHead(404);
  res.end('Not Found');
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Helper function: Send request to Claude Desktop
async function sendToClaudeDesktop(requestData) {
  const requestId = crypto.randomUUID();
  const requestFile = path.join(requestsDir, `${requestId}.json`);
  
  // Write request to shared directory
  fs.writeFileSync(requestFile, JSON.stringify({
    id: requestId,
    request: requestData,
    status: "pending",
    created_at: Date.now()
  }, null, 2));
  
  logger.info(`Sent request ${requestId} to Claude Desktop`);
  
  // Wait for response
  return waitForDesktopResponse(requestId, 120000); // 2 minute timeout
}

// Helper function: Wait for Claude Desktop to respond
async function waitForDesktopResponse(requestId, timeout = 120000) {
  const responseFile = path.join(responsesDir, `${requestId}.json`);
  
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const checkResponse = () => {
      if (fs.existsSync(responseFile)) {
        try {
          const responseData = JSON.parse(fs.readFileSync(responseFile, 'utf8'));
          
          if (responseData.status === "completed") {
            // Clean up response file after reading
            setTimeout(() => {
              try { fs.unlinkSync(responseFile); } catch (e) { 
                logger.error(`Couldn't delete response file: ${e.message}`); 
              }
            }, 1000);
            
            resolve(responseData.response);
            return;
          }
        } catch (err) {
          logger.error(`Error reading response file: ${err.message}`);
        }
      }
      
      // Check for timeout
      if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout waiting for Claude Desktop response after ${timeout}ms`));
        return;
      }
      
      // Continue checking
      setTimeout(checkResponse, 500);
    };
    
    // Start checking
    checkResponse();
  });
}

// Helper function: Get project structure
function getProjectStructure(directory) {
  try {
    // Simple implementation - can be enhanced
    const ignorePatterns = ['.git', 'node_modules', '__pycache__', '*.pyc', '*.class'];
    
    if (process.platform === 'win32') {
      // Windows implementation using PowerShell
      const command = `powershell -Command "Get-ChildItem -Path '${directory}' -Recurse -File | Where-Object { $_.FullName -notmatch '(node_modules|\\.git|__pycache__)' } | Select-Object -First 100 | ForEach-Object { $_.FullName }"`;
      const output = execSync(command, { encoding: 'utf8' });
      const files = output.split('\n')
        .filter(Boolean)
        .slice(0, 100); // Limit to 100 files
      
      return {
        root: directory,
        files: files,
        file_count: files.length
      };
    } else {
      // Unix find command
      const ignoreString = ignorePatterns.map(p => `-name "${p}"`).join(' -o ');
      const command = `find "${directory}" -type f \\( ${ignoreString} \\) -prune -o -type f -print | head -100`;
      
      const output = execSync(command, { encoding: 'utf8' });
      const files = output.split('\n').filter(Boolean);
      
      return {
        root: directory,
        files: files,
        file_count: files.length
      };
    }
  } catch (err) {
    logger.error(`Error getting project structure: ${err.message}`);
    return {
      root: directory,
      error: err.message,
      files: []
    };
  }
}

// Helper function: Get Git changes
function getGitChanges(directory) {
  try {
    const output = execSync(`cd "${directory}" && git log --name-status -n 5`, { encoding: 'utf8' });
    return {
      recent_changes: output,
      format: "git_log"
    };
  } catch (err) {
    logger.error(`Error getting git changes: ${err.message}`);
    return {
      error: err.message,
      is_git_repo: false
    };
  }
}

// Helper function: Get browser context from Browser Tools MCP
async function getBrowserContext() {
  try {
    // Simple HTTP request to browser tools MCP
    const http = await import('http');
    
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: BROWSER_TOOLS_PORT,
        path: '/.identity',
        method: 'GET'
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const identity = JSON.parse(data);
              resolve({
                available: true,
                tools_version: identity.version || 'unknown',
                console_logs: "Would fetch actual console logs here",
                network_activity: "Would fetch actual network activity here"
              });
            } catch (err) {
              resolve({
                available: true,
                parse_error: err.message,
                raw_response: data
              });
            }
          } else {
            resolve({
              available: false,
              status_code: res.statusCode,
              status_message: res.statusMessage
            });
          }
        });
      });
      
      req.on('error', (err) => {
        resolve({
          available: false,
          error: err.message
        });
      });
      
      req.end();
    });
  } catch (err) {
    logger.error(`Browser tools not available: ${err.message}`);
    return {
      available: false,
      error: err.message
    };
  }
}

// Tool definitions
const tools = [
  {
    name: "analyze_codebase",
    description: "Analyze a codebase using Claude Desktop as the model provider",
    parameters: {
      type: "object",
      properties: {
        directory: {
          type: "string",
          description: "Directory path to analyze"
        },
        analysis_type: {
          type: "string",
          description: "Type of analysis to perform",
          enum: ["overview", "security", "performance", "architecture", "comprehensive"]
        }
      },
      required: ["directory"]
    },
    handler: async (params) => {
      const { directory, analysis_type = "overview" } = params;
      logger.info(`Analyzing codebase: ${directory} (${analysis_type})`);
      
      try {
        // Gather code context
        const fileTree = getProjectStructure(directory);
        const recentChanges = getGitChanges(directory);
        
        // Get browser context if available
        let browserContext = {};
        try {
          browserContext = await getBrowserContext();
        } catch (err) {
          logger.error(`Browser context not available: ${err.message}`);
        }
        
        // Prepare context for Claude Desktop
        const analysisContext = {
          project_structure: fileTree,
          recent_changes: recentChanges,
          analysis_type: analysis_type,
          browser_context: browserContext
        };
        
        // Send to Claude Desktop
        const result = await sendToClaudeDesktop({
          type: "code_analysis",
          context: analysisContext,
          model_preference: "claude-3-5-sonnet"
        });
        
        return {
          analysis: result,
          context_summary: {
            directory: directory,
            analysis_type: analysis_type,
            file_count: fileTree.files ? fileTree.files.length : 0,
            context_with_browser: Object.keys(browserContext).length > 0
          }
        };
      } catch (err) {
        logger.error(`Error analyzing codebase: ${err.message}`);
        throw new Error(`Codebase analysis failed: ${err.message}`);
      }
    }
  },
  {
    name: "debug_with_browser_context",
    description: "Debug an issue using both code and browser context",
    parameters: {
      type: "object",
      properties: {
        error_message: {
          type: "string",
          description: "Error message or description of the issue"
        },
        code_files: {
          type: "array",
          items: {
            type: "string"
          },
          description: "List of relevant code files to include in the analysis"
        }
      },
      required: ["error_message"]
    },
    handler: async (params) => {
      const { error_message, code_files = [] } = params;
      logger.info(`Debugging issue: ${error_message}`);
      
      try {
        // Gather code context
        const codeContext = {};
        for (const file of code_files) {
          try {
            codeContext[file] = fs.readFileSync(file, 'utf8');
          } catch (err) {
            codeContext[file] = `Error reading file: ${err.message}`;
          }
        }
        
        // Get browser context
        const browserContext = await getBrowserContext();
        
        // System context
        const systemContext = {
          os: process.platform,
          node_version: process.version,
          memory: process.memoryUsage()
        };
        
        // Prepare debugging context
        const debugContext = {
          error_message: error_message,
          code_context: codeContext,
          browser_context: browserContext,
          system_context: systemContext
        };
        
        // Send to Claude Desktop
        const result = await sendToClaudeDesktop({
          type: "debugging_session",
          context: debugContext,
          model_preference: "claude-3-5-sonnet"
        });
        
        return {
          debugging_analysis: result,
          included_context: {
            error: error_message,
            code_files: Object.keys(codeContext),
            browser_data: Object.keys(browserContext)
          }
        };
      } catch (err) {
        logger.error(`Error debugging with context: ${err.message}`);
        throw new Error(`Debugging session failed: ${err.message}`);
      }
    }
  },
  {
    name: "analyze_performance",
    description: "Analyze performance issues combining code and browser data",
    parameters: {
      type: "object",
      properties: {
        page: {
          type: "string",
          description: "The page or route to analyze"
        },
        capture_network: {
          type: "boolean",
          description: "Whether to capture network activity"
        },
        capture_console: {
          type: "boolean",
          description: "Whether to capture console logs"
        }
      },
      required: ["page"]
    },
    handler: async (params) => {
      const { page, capture_network = true, capture_console = true } = params;
      logger.info(`Analyzing performance for page: ${page}`);
      
      try {
        // Get browser context
        const browserContext = await getBrowserContext();
        
        // Prepare performance context
        const performanceContext = {
          page: page,
          browser_context: browserContext,
          network_capture: capture_network ? "Would include network data here" : null,
          console_capture: capture_console ? "Would include console logs here" : null
        };
        
        // Send to Claude Desktop
        const result = await sendToClaudeDesktop({
          type: "performance_analysis",
          context: performanceContext,
          model_preference: "claude-3-5-sonnet"
        });
        
        return {
          performance_analysis: result,
          analyzed_page: page,
          data_captured: {
            network: capture_network,
            console: capture_console,
            browser_context: browserContext.available
          }
        };
      } catch (err) {
        logger.error(`Error analyzing performance: ${err.message}`);
        throw new Error(`Performance analysis failed: ${err.message}`);
      }
    }
  },
  {
    name: "code_review",
    description: "Review code changes with browser context for enhanced understanding",
    parameters: {
      type: "object",
      properties: {
        directory: {
          type: "string",
          description: "Repository directory"
        },
        pr_number: {
          type: "number",
          description: "Pull request number to review"
        },
        include_browser_context: {
          type: "boolean",
          description: "Whether to include browser context in the review"
        }
      },
      required: ["directory"]
    },
    handler: async (params) => {
      const { directory, pr_number, include_browser_context = true } = params;
      logger.info(`Reviewing code: ${directory}, PR #${pr_number}`);
      
      try {
        // Get code changes
        let codeChanges = {};
        if (pr_number) {
          // This would be enhanced to fetch actual PR details
          codeChanges = {
            pr_number: pr_number,
            message: "Would fetch actual PR changes here"
          };
        } else {
          codeChanges = getGitChanges(directory);
        }
        
        // Get browser context if requested
        let browserContext = {};
        if (include_browser_context) {
          browserContext = await getBrowserContext();
        }
        
        // Prepare review context
        const reviewContext = {
          code_changes: codeChanges,
          repository: directory,
          pr_number: pr_number,
          browser_context: browserContext
        };
        
        // Send to Claude Desktop
        const result = await sendToClaudeDesktop({
          type: "code_review",
          context: reviewContext,
          model_preference: "claude-3-5-sonnet"
        });
        
        return {
          review: result,
          context_summary: {
            repo: directory,
            pr: pr_number,
            with_browser_context: include_browser_context
          }
        };
      } catch (err) {
        logger.error(`Error reviewing code: ${err.message}`);
        throw new Error(`Code review failed: ${err.message}`);
      }
    }
  }
];

// WebSocket connection handler
wss.on('connection', (ws) => {
  logger.info('Client connected');
  
  ws.on('message', async (message) => {
    try {
      const request = JSON.parse(message.toString());
      logger.info(`Received message: ${request.method}`);
      
      // Handle initialization
      if (request.method === 'initialize') {
        ws.send(JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          result: {
            capabilities: {
              tools: tools.map(t => ({
                name: t.name,
                description: t.description,
                parameters: t.parameters
              }))
            }
          }
        }));
        return;
      }
      
      // Handle tool calls
      if (request.method === 'tools/call') {
        const { id, params } = request;
        const { name, parameters } = params;
        
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
        return;
      }
      
      // Handle unknown methods
      ws.send(JSON.stringify({
        jsonrpc: "2.0",
        id: request.id || null,
        error: {
          code: -32601,
          message: `Method '${request.method}' not found`
        }
      }));
      
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
  
  ws.on('close', () => {
    logger.info('Client disconnected');
  });
  
  ws.on('error', (err) => {
    logger.error(`WebSocket error: ${err.message}`);
  });
});

// Start the server
server.listen(PORT, () => {
  logger.info(`Development Hub MCP Server is running on port ${PORT}`);
});

// Handle process termination
process.on('SIGINT', () => {
  logger.info('Shutting down server...');
  server.close(() => {
    logger.info('Server shut down');
    process.exit(0);
  });
});
