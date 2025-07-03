// claude-desktop-bridge.js
// Bridge process to monitor shared state and execute actions

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { exec } from 'child_process';
import chokidar from 'chokidar';

// Calculate absolute paths
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const LOG_DIR = path.join(PROJECT_ROOT, 'logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Setup logging
const logFile = fs.createWriteStream(path.join(LOG_DIR, 'bridge.log'), { flags: 'a' });
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

// Claude directories and files
const claudeDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Claude');
const sessionStatePath = path.join(claudeDir, 'session_state.json');
const configFilePath = path.join(claudeDir, 'claude_desktop_config.json');
const codeTriggersDirPath = path.join(claudeDir, 'code_triggers');

// Ensure the code triggers directory exists
if (!fs.existsSync(codeTriggersDirPath)) {
  fs.mkdirSync(codeTriggersDirPath, { recursive: true });
}

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

// Helper functions
function isClaudeDesktopRunning() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec('tasklist /FI "IMAGENAME eq claude.exe"', (err, stdout) => {
        if (err) {
          logger.error(`Error checking Claude process: ${err.message}`);
          resolve(false);
          return;
        }
        resolve(stdout.toLowerCase().includes('claude.exe'));
      });
    } else {
      exec('pgrep -f "Claude Desktop"', (err, stdout) => {
        if (err && err.code !== 1) {
          logger.error(`Error checking Claude process: ${err.message}`);
          resolve(false);
          return;
        }
        resolve(!!stdout.trim());
      });
    }
  });
}

async function startClaudeDesktop() {
  try {
    const claudePath = path.join(process.env.LOCALAPPDATA, 'AnthropicClaude', 'Claude.exe');
    
    if (fs.existsSync(claudePath)) {
      logger.info('Starting Claude Desktop...');
      exec(`"${claudePath}"`, (err) => {
        if (err) {
          logger.error(`Error starting Claude Desktop: ${err.message}`);
          return false;
        }
      });
      return true;
    }
    
    logger.error('Could not find Claude Desktop executable');
    return false;
  } catch (err) {
    logger.error(`Error starting Claude Desktop: ${err.message}`);
    return false;
  }
}

// Make a backup of a file before modifying it
function backupFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const backupPath = `${filePath}.backup.${Date.now()}`;
      fs.copyFileSync(filePath, backupPath);
      logger.info(`Created backup at ${backupPath}`);
      return true;
    }
  } catch (err) {
    logger.error(`Error creating backup: ${err.message}`);
  }
  return false;
}

async function processSessionState() {
  try {
    if (!fs.existsSync(sessionStatePath)) {
      logger.info('Session state file does not exist, creating it');
      const initialState = {
        last_updated: Date.now(),
        pending_actions: [],
        bridge_info: {
          status: 'running',
          timestamp: Date.now(),
          pid: process.pid
        }
      };
      fs.writeFileSync(sessionStatePath, JSON.stringify(initialState, null, 2));
      return;
    }
    
    // Read current state
    let sessionState = JSON.parse(fs.readFileSync(sessionStatePath, 'utf8'));
    
    // Get pending actions
    const pendingActions = sessionState.pending_actions || [];
    
    // Process only pending actions
    const pendingOnly = pendingActions.filter(a => a.status === 'pending');
    
    // Only proceed if there are actually pending actions to avoid constant writes
    if (pendingOnly.length === 0) {
      return; // Don't update the file if there's nothing to process
    }
    
    logger.info(`Found ${pendingOnly.length} pending actions to process`);
    
    let hasChanges = false;
    
    for (const action of pendingOnly) {
      logger.info(`Processing action: ${action.type}`);
      
      try {
        await executeAction(action);
        
        // Mark as completed
        action.status = 'completed';
        action.completed_at = Date.now();
        hasChanges = true;
      } catch (err) {
        logger.error(`Error executing action ${action.type}: ${err.message}`);
        action.status = 'failed';
        action.error = err.message;
        hasChanges = true;
      }
    }
    
    // Only write if there were actual changes
    if (hasChanges) {
      // Clean up old completed actions (older than 1 hour)
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      sessionState.pending_actions = pendingActions.filter(a => 
        a.status !== 'completed' || !a.completed_at || a.completed_at > oneHourAgo
      );
      
      // Update last_updated timestamp only when there are actual changes
      sessionState.last_updated = Date.now();
      
      // Write back updated state
      fs.writeFileSync(sessionStatePath, JSON.stringify(sessionState, null, 2));
      logger.info('Updated session state with processed actions');
    }
    
  } catch (err) {
    logger.error(`Error processing session state: ${err.message}`);
  }
}

async function executeAction(action) {
  const { type, params } = action;
  
  switch (type) {
    case 'open_conversation':
      // This is a placeholder - would require interaction with Claude Desktop
      logger.info(`Would open conversation: ${params.conversation_id}`);
      // In a real implementation, this might involve updating a preference file
      // or using another mechanism to signal Claude Desktop
      return true;
      
    case 'switch_model':
      // Update config to change the model
      logger.info(`Switching default model to ${params.model}`);
      if (fs.existsSync(configFilePath)) {
        // Make backup
        backupFile(configFilePath);
        
        const config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
        config.defaultModel = params.model;
        fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
        logger.info(`Changed default model to ${params.model}`);
        
        // Create reload signal
        const reloadSignal = path.join(claudeDir, 'reload_config');
        fs.writeFileSync(reloadSignal, Date.now().toString());
      } else {
        throw new Error('Claude Desktop config file not found');
      }
      return true;
      
    case 'update_mcp_config':
      // Update MCP server configuration
      logger.info(`Updating MCP config for server: ${params.serverName}`);
      if (fs.existsSync(configFilePath)) {
        // Make backup
        backupFile(configFilePath);
        
        const config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
        
        // Ensure mcpServers section exists
        config.mcpServers = config.mcpServers || {};
        
        // Update server config
        config.mcpServers[params.serverName] = params.config;
        
        // If autoStart is specified, handle it
        if (params.config.autoStart) {
          config.autoStart = config.autoStart || { servers: [] };
          if (!config.autoStart.servers.includes(params.serverName)) {
            config.autoStart.servers.push(params.serverName);
          }
        }
        
        fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
        logger.info(`Updated MCP config for ${params.serverName}`);
        
        // Create reload signal
        const reloadSignal = path.join(claudeDir, 'reload_config');
        fs.writeFileSync(reloadSignal, Date.now().toString());
      } else {
        throw new Error('Claude Desktop config file not found');
      }
      return true;
      
    case 'restart_claude':
      logger.info('Attempting to restart Claude Desktop');
      
      // Check if Claude is running and kill it
      const isRunning = await isClaudeDesktopRunning();
      if (isRunning) {
        // This is OS-specific and might need adjustments
        if (process.platform === 'win32') {
          exec('taskkill /F /IM claude.exe', async (err) => {
            if (err) {
              logger.error(`Error killing Claude: ${err.message}`);
              return false;
            }
            
            // Wait a moment and start Claude
            setTimeout(async () => {
              await startClaudeDesktop();
            }, 2000);
          });
        } else {
          exec('pkill -f "Claude Desktop"', async (err) => {
            if (err) {
              logger.error(`Error killing Claude: ${err.message}`);
              return false;
            }
            
            // Wait a moment and start Claude
            setTimeout(async () => {
              await startClaudeDesktop();
            }, 2000);
          });
        }
      } else {
        // Just start Claude if it's not running
        await startClaudeDesktop();
      }
      return true;
      
    default:
      logger.info(`Unknown action type: ${type}`);
      throw new Error(`Unknown action type: ${type}`);
  }
}

// Function to update bridge status in session state
function updateBridgeStatus(status) {
  try {
    let sessionState = {};
    if (fs.existsSync(sessionStatePath)) {
      sessionState = JSON.parse(fs.readFileSync(sessionStatePath, 'utf8'));
    }
    
    sessionState.bridge_status = status;
    sessionState.last_updated = Date.now();
    
    fs.writeFileSync(sessionStatePath, JSON.stringify(sessionState, null, 2));
    logger.info(`Bridge status updated to: ${status}`);
  } catch (error) {
    logger.error(`Failed to update bridge status: ${error.message}`);
  }
}

// Start bridge
async function startBridge() {
  try {
    // Update bridge status
    updateBridgeStatus('starting');
    
    // Set up watchers
    const configWatcher = chokidar.watch(configFilePath, {
      persistent: true
    });
    
    const sessionStateWatcher = chokidar.watch(sessionStatePath, {
      persistent: true
    });
    
    // Add watcher for code triggers from Claude Code
    const codeTriggerWatcher = chokidar.watch(codeTriggersDirPath, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    });
    
    // Handle code triggers from Claude Code
    codeTriggerWatcher.on('add', async (filePath) => {
      if (path.extname(filePath) !== '.json') return;
      
      logger.info(`Detected new code trigger: ${path.basename(filePath)}`);
      
      try {
        // Wait a short time to make sure the file is completely written
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Read the trigger file
        const triggerData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Validate the trigger
        if (!triggerData.id || !triggerData.action) {
          logger.error(`Invalid code trigger format: ${filePath}`);
          return;
        }
        
        // Process the trigger based on the action
        const result = await processCodeTrigger(triggerData);
        
        // Update the trigger status
        triggerData.status = result.success ? 'completed' : 'failed';
        triggerData.result = result;
        triggerData.processed_at = Date.now();
        
        // Save updated trigger data
        fs.writeFileSync(filePath, JSON.stringify(triggerData, null, 2));
        
        // Record completed trigger in session state
        let sessionState = {};
        if (fs.existsSync(sessionStatePath)) {
          sessionState = JSON.parse(fs.readFileSync(sessionStatePath, 'utf8'));
        }
        
        sessionState.completed_code_triggers = sessionState.completed_code_triggers || [];
        sessionState.completed_code_triggers.push({
          id: triggerData.id,
          action: triggerData.action,
          result: result,
          completed_at: Date.now()
        });
        
        fs.writeFileSync(sessionStatePath, JSON.stringify(sessionState, null, 2));
        
        // Remove the trigger file after a short delay
        setTimeout(() => {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }, 5000);
        
      } catch (err) {
        logger.error(`Error processing code trigger: ${err.message}`);
      }
    });
    
    // Process Claude Code trigger
    async function processCodeTrigger(triggerData) {
      const { action, params } = triggerData;
      
      logger.info(`Processing code trigger: ${action}`);
      
      try {
        switch (action) {
          case 'open_conversation':
            // Implement opening a conversation in Claude Desktop
            return await openConversation(params);
            
          case 'switch_model':
            // Implement model switching
            return await switchModel(params);
            
          case 'analyze_file':
            // Implement file analysis
            return await analyzeFile(params);
            
          case 'save_conversation':
            // Implement saving conversation
            return await saveConversation(params);
            
          default:
            logger.warn(`Unknown code trigger action: ${action}`);
            return {
              success: false,
              message: `Unknown action: ${action}`
            };
        }
      } catch (err) {
        logger.error(`Error in processCodeTrigger: ${err.message}`);
        return {
          success: false,
          message: `Error processing action: ${err.message}`
        };
      }
    }
    
    // Existing watchers and event handlers
    // ...

    // Update bridge status
    updateBridgeStatus('running');
    logger.info('Bridge process started successfully');
  } catch (err) {
    logger.error(`Error starting bridge: ${err.message}`);
    updateBridgeStatus('error');
  }
}

// Main function
async function main() {
  logger.info('Starting Claude Desktop Bridge...');
  
  // Check if Claude Desktop is running
  const isRunning = await isClaudeDesktopRunning();
  if (!isRunning) {
    logger.info('Claude Desktop is not running');
  } else {
    logger.info('Claude Desktop is already running');
  }
  
  // Initialize watcher for session state
  const watcher = chokidar.watch(sessionStatePath, {
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100
    }
  });
  
  watcher.on('change', async (path) => {
    logger.info(`Detected change in session state file: ${path}`);
    await processSessionState();
  });
  
  // Process initially
  await processSessionState();
  
  logger.info('Claude Desktop Bridge is running');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Bridge shutting down...');
  try {
    // Update session state to show we're stopping
    if (fs.existsSync(sessionStatePath)) {
      const sessionState = JSON.parse(fs.readFileSync(sessionStatePath, 'utf8'));
      sessionState.bridge_info = sessionState.bridge_info || {};
      sessionState.bridge_info.status = 'stopped';
      sessionState.bridge_info.timestamp = Date.now();
      fs.writeFileSync(sessionStatePath, JSON.stringify(sessionState, null, 2));
    }
  } catch (err) {
    logger.error(`Error updating session state on shutdown: ${err.message}`);
  }
  
  process.exit(0);
});

// Start the bridge
main().catch(err => {
  logger.error(`Error in main process: ${err.message}`);
  process.exit(1);
});

// Start the bridge
startBridge();
