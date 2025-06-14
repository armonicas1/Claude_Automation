// update-claude-config.js
// Script to update Claude Desktop configuration to use the custom MCP server

import fs from 'fs';
import path from 'path';
import os from 'os';

// Claude configuration paths
const claudeDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Claude');
const configFilePath = path.join(claudeDir, 'claude_desktop_config.json');

// Our configuration
const customMcpConfig = {
  "mcpServers": {
    "custom-extension": {
      "external": true,
      "port": 4323,
      "host": "localhost"
    }
  }
};

console.log('Updating Claude Desktop configuration...');

// Make backup of existing config
function backupConfig() {
  if (fs.existsSync(configFilePath)) {
    const backupPath = `${configFilePath}.backup.${Date.now()}`;
    fs.copyFileSync(configFilePath, backupPath);
    console.log(`Created backup at ${backupPath}`);
    return true;
  }
  return false;
}

// Update the configuration
function updateConfig() {
  try {
    // Create backup
    backupConfig();
    
    // Read existing config or create a new one
    let config = {};
    if (fs.existsSync(configFilePath)) {
      config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
    }
    
    // Update mcpServers section
    config.mcpServers = config.mcpServers || {};
    config.mcpServers['custom-extension'] = customMcpConfig.mcpServers['custom-extension'];
    
    // Write updated config
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
    console.log('Claude Desktop configuration updated successfully');
    
    // Create reload signal
    const reloadSignal = path.join(claudeDir, 'reload_config');
    fs.writeFileSync(reloadSignal, Date.now().toString());
    console.log('Created reload signal file');
    
    return true;
  } catch (err) {
    console.error('Error updating Claude Desktop configuration:', err.message);
    return false;
  }
}

// Create session state file if it doesn't exist
function createSessionState() {
  const sessionStatePath = path.join(claudeDir, 'session_state.json');
  
  if (!fs.existsSync(sessionStatePath)) {
    try {
      const initialState = {
        last_updated: Date.now(),
        pending_actions: [],
        bridge_info: {
          status: 'initializing',
          timestamp: Date.now()
        }
      };
      fs.writeFileSync(sessionStatePath, JSON.stringify(initialState, null, 2));
      console.log('Created initial session state file');
      return true;
    } catch (err) {
      console.error('Error creating session state file:', err.message);
      return false;
    }
  }
  
  return true;
}

// Ensure Claude directory exists
if (!fs.existsSync(claudeDir)) {
  fs.mkdirSync(claudeDir, { recursive: true });
  console.log(`Created Claude directory at ${claudeDir}`);
}

// Update configuration
if (updateConfig() && createSessionState()) {
  console.log('Claude Desktop is now configured to use the custom MCP server');
  console.log('Please restart Claude Desktop for the changes to take effect');
} else {
  console.error('Failed to update Claude Desktop configuration');
}
