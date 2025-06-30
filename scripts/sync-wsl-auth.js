#!/usr/bin/env node
// Automated WSL Authentication Sync for Claude Desktop MCP Tools
// This script automatically syncs WSL Claude Code credentials to Windows environment

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');

// WSL and Windows paths
const WSL_CREDENTIALS_PATH = '/home/dimas/.claude/.credentials.json';
const BRIDGE_DIR = '/mnt/c/Users/dimas/claude-bridge';
const ENV_FILE = path.join(BRIDGE_DIR, 'claude-env.bat');

function extractWslApiKey() {
  try {
    if (!fs.existsSync(WSL_CREDENTIALS_PATH)) {
      throw new Error('WSL Claude credentials not found');
    }

    const credentials = JSON.parse(fs.readFileSync(WSL_CREDENTIALS_PATH, 'utf8'));
    
    if (credentials.claudeAiOauth && credentials.claudeAiOauth.accessToken) {
      return credentials.claudeAiOauth.accessToken;
    }
    
    throw new Error('No valid OAuth token found in WSL credentials');
  } catch (error) {
    console.error('❌ Error reading WSL credentials:', error.message);
    return null;
  }
}

function updateWindowsEnvironment(apiKey) {
  try {
    // Ensure bridge directory exists
    if (!fs.existsSync(BRIDGE_DIR)) {
      fs.mkdirSync(BRIDGE_DIR, { recursive: true });
    }

    const envContent = `@echo off
REM Auto-generated WSL Authentication Bridge
REM Generated: ${new Date().toISOString()}
set ANTHROPIC_API_KEY=${apiKey}
set CLAUDE_API_KEY=${apiKey}
echo ✅ WSL Auth Bridge: API key loaded from WSL Claude Code credentials
`;

    fs.writeFileSync(ENV_FILE, envContent);
    console.log('✅ Windows environment file updated:', ENV_FILE);
    return true;
  } catch (error) {
    console.error('❌ Error updating Windows environment:', error.message);
    return false;
  }
}

function updateMcpServerEnvironment(apiKey) {
  try {
    // Set environment variable for current Node.js process
    process.env.ANTHROPIC_API_KEY = apiKey;
    process.env.CLAUDE_API_KEY = apiKey;
    
    console.log('✅ MCP Server environment updated');
    return true;
  } catch (error) {
    console.error('❌ Error updating MCP server environment:', error.message);
    return false;
  }
}

function main() {
  console.log('🔗 WSL Authentication Sync');
  console.log('Syncing Claude Code credentials from WSL to Windows...');
  
  const apiKey = extractWslApiKey();
  if (!apiKey) {
    console.error('❌ Failed to extract WSL API key');
    process.exit(1);
  }
  
  console.log('✅ Found WSL OAuth token');
  
  // Update Windows batch file
  if (!updateWindowsEnvironment(apiKey)) {
    process.exit(1);
  }
  
  // Update current MCP server environment
  if (!updateMcpServerEnvironment(apiKey)) {
    process.exit(1);
  }
  
  console.log('');
  console.log('🎉 Authentication sync complete!');
  console.log('');
  console.log('The Claude Desktop MCP analyzer should now work with WSL credentials.');
  console.log('');
  console.log('Next steps:');
  console.log('1. Restart Claude Desktop MCP server to pick up new environment');
  console.log('2. Test the CLI analyzer tool from Claude Desktop');
  console.log('3. Run this script periodically to keep tokens synced');
}

// Export for use by other modules
export { extractWslApiKey, updateWindowsEnvironment, updateMcpServerEnvironment };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}