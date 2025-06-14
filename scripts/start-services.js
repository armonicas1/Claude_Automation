// start-services.js
// Script to start both the MCP server and bridge process

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Calculate absolute paths
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');
const LOG_DIR = path.join(PROJECT_ROOT, 'logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

console.log('Starting Claude Desktop Extension services...');

// Start the MCP server
const mcpServer = spawn('node', [path.join(SRC_DIR, 'custom-claude-mcp.js')], {
  stdio: 'inherit',
  shell: true
});

mcpServer.on('error', (err) => {
  console.error(`Failed to start MCP server: ${err.message}`);
});

// Wait a moment before starting the bridge
setTimeout(() => {
  // Start the bridge process
  const bridge = spawn('node', [path.join(SRC_DIR, 'claude-desktop-bridge.js')], {
    stdio: 'inherit',
    shell: true
  });
  
  bridge.on('error', (err) => {
    console.error(`Failed to start bridge: ${err.message}`);
  });
  
  console.log('All services started. Press Ctrl+C to stop all services.');
}, 2000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down all services...');
  
  if (mcpServer && !mcpServer.killed) {
    mcpServer.kill();
  }
  
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});
