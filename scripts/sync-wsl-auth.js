#!/usr/bin/env node
// Automated WSL Authentication Sync for Claude Desktop MCP Tools
// This script automatically syncs WSL Claude Code credentials to Windows environment
// Enhanced to handle multiple WSL distributions including Docker Desktop

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import os from 'os';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const WINDOWS_USERNAME = os.userInfo().username;

// WSL and Windows paths - using dynamic username
const WSL_CREDENTIALS_PATH = `/home/${WINDOWS_USERNAME}/.claude/.credentials.json`;
const BRIDGE_DIR = `/mnt/c/Users/${WINDOWS_USERNAME}/claude-bridge`;
const ENV_FILE = path.join('C:', 'Users', WINDOWS_USERNAME, 'claude-bridge', 'claude-env.bat');
const LOG_FILE = path.join(PROJECT_ROOT, 'logs', 'wsl-auth-sync.log');

// Logger setup
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${level}: ${message}`;
  console.log(logEntry);
  
  try {
    // Ensure logs directory exists
    const logsDir = path.join(PROJECT_ROOT, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    fs.appendFileSync(LOG_FILE, logEntry + '\n');
  } catch (error) {
    console.error(`Failed to write to log: ${error.message}`);
  }
}

// Get list of WSL distributions with robust parsing
function getWslDistributions() {
  try {
    const output = execSync('wsl.exe --list --verbose', { encoding: 'utf8' });
    const lines = output.trim().split('\n');
    
    if (lines.length <= 1) {
      log('No WSL distributions found', 'WARNING');
      return [];
    }
    
    const distributions = [];
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Parse with regex for better robustness
      const match = line.match(/(\*?)\s*(\S+)\s+(\S+)\s+(\S+)/);
      if (match) {
        const [_, defaultMarker, name, state, version] = match;
        distributions.push({
          name: name,
          state: state,
          version: version,
          isDefault: defaultMarker === '*'
        });
      }
    }
    
    log(`Found distributions: ${distributions.map(d => d.name).join(', ')}`);
    return distributions;
  } catch (error) {
    log(`Failed to list WSL distributions: ${error.message}`, 'ERROR');
    return [];
  }
}

// Extract API key from a specific distribution
function extractWslApiKey(distribution) {
  try {
    // Try WSL network paths
    const wslPaths = [
      `\\\\wsl$\\${distribution}\\home\\${WINDOWS_USERNAME}\\.claude\\.credentials.json`,
      `\\\\wsl.localhost\\${distribution}\\home\\${WINDOWS_USERNAME}\\.claude\\.credentials.json`
    ];
    
    for (const path of wslPaths) {
      if (fs.existsSync(path)) {
        log(`Checking credentials at ${path}`);
        const credentials = JSON.parse(fs.readFileSync(path, 'utf8'));
        
        if (credentials.claudeAiOauth && credentials.claudeAiOauth.accessToken) {
          log(`Found valid credentials in ${distribution}`);
          return {
            apiKey: credentials.claudeAiOauth.accessToken,
            path: path,
            credentials: credentials
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    log(`Error extracting API key from ${distribution}: ${error.message}`, 'WARNING');
    return null;
  }
}

// Find a distribution with credentials
function findDistributionWithCredentials() {
  const distributions = getWslDistributions();
  
  // First try Ubuntu distributions
  const ubuntuDistros = distributions.filter(d => 
    d.name.toLowerCase().includes('ubuntu'));
  
  // Try Ubuntu distributions first in specific order
  const orderedDistros = [
    ...ubuntuDistros,
    ...distributions.filter(d => !d.name.toLowerCase().includes('ubuntu'))
  ];
  
  for (const dist of orderedDistros) {
    log(`Checking for credentials in ${dist.name}`);
    const result = extractWslApiKey(dist.name);
    if (result && result.apiKey) {
      return {
        distribution: dist.name,
        apiKey: result.apiKey,
        path: result.path,
        credentials: result.credentials
      };
    }
  }
  
  return null;
}

function updateWindowsEnvironment(apiKey) {
  try {
    // Ensure bridge directory exists
    const bridgeDir = path.dirname(ENV_FILE);
    if (!fs.existsSync(bridgeDir)) {
      fs.mkdirSync(bridgeDir, { recursive: true });
    }

    const envContent = `@echo off
REM Auto-generated WSL Authentication Bridge
REM Generated: ${new Date().toISOString()}
set ANTHROPIC_API_KEY=${apiKey}
set CLAUDE_API_KEY=${apiKey}
echo ✅ WSL Auth Bridge: API key loaded from WSL Claude Code credentials
`;

    fs.writeFileSync(ENV_FILE, envContent);
    log('✅ Windows environment file updated: ' + ENV_FILE);
    return true;
  } catch (error) {
    log(`❌ Error updating Windows environment: ${error.message}`, 'ERROR');
    return false;
  }
}

function updateMcpServerEnvironment(apiKey) {
  try {
    // Set environment variable for current Node.js process
    process.env.ANTHROPIC_API_KEY = apiKey;
    process.env.CLAUDE_API_KEY = apiKey;
    
    log('✅ MCP Server environment updated');
    return true;
  } catch (error) {
    log(`❌ Error updating MCP server environment: ${error.message}`, 'ERROR');
    return false;
  }
}

// Synchronize credentials between all distributions
function syncCredentialsBetweenDistributions(source) {
  if (!source || !source.credentials) {
    log('Invalid source credentials', 'ERROR');
    return false;
  }
  
  const distributions = getWslDistributions();
  let syncSuccess = true;
  
  // Sync to all distributions
  for (const dist of distributions) {
    if (dist.name === source.distribution) {
      // Skip source distribution
      continue; 
    }
    
    log(`Syncing credentials to ${dist.name}...`);
    
    try {
      // Create the .claude directory
      const mkdirCmd = `wsl.exe -d ${dist.name} -- mkdir -p /home/${WINDOWS_USERNAME}/.claude`;
      execSync(mkdirCmd);
      
      // Write credentials (safely escaping content)
      const credentials = JSON.stringify(source.credentials).replace(/"/g, '\\"');
      const copyCmd = `wsl.exe -d ${dist.name} -- bash -c 'echo "${credentials}" > /home/${WINDOWS_USERNAME}/.claude/.credentials.json'`;
      execSync(copyCmd);
      
      log(`Successfully synced credentials to ${dist.name}`);
    } catch (error) {
      log(`Failed to sync credentials to ${dist.name}: ${error.message}`, 'ERROR');
      syncSuccess = false;
    }
  }
  
  return syncSuccess;
}

function main() {
  log('🔗 WSL Authentication Sync');
  log('Syncing Claude Code credentials between all WSL distributions...');
  
  // Find a distribution with credentials
  const source = findDistributionWithCredentials();
  
  if (!source || !source.apiKey) {
    log('❌ No valid credentials found in any WSL distribution', 'ERROR');
    process.exit(1);
  }
  
  log(`✅ Found WSL OAuth token in ${source.distribution}`);
  
  // Sync credentials between all distributions
  const syncSuccess = syncCredentialsBetweenDistributions(source);
  
  // Update Windows batch file
  const windowsSuccess = updateWindowsEnvironment(source.apiKey);
  
  // Update current MCP server environment
  const mcpSuccess = updateMcpServerEnvironment(source.apiKey);
  
  if (syncSuccess && windowsSuccess && mcpSuccess) {
    log('');
    log('🎉 Authentication sync complete!');
    log('');
    log('The Claude Desktop MCP analyzer should now work with WSL credentials.');
    log('');
  } else {
    log('');
    log('⚠️ Authentication sync completed with some issues.');
    log('');
    process.exit(1);
  }
}

// Run the main function
main();