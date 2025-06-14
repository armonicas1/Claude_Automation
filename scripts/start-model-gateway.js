// start-model-gateway.js
// Script to start both the Dev Hub MCP server and Claude Desktop Gateway

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

console.log('Starting Claude Desktop Model Gateway services...');
console.log(`Working directory: ${process.cwd()}`);
console.log(`Source directory: ${SRC_DIR}`);

// Start the Dev Hub MCP server
const devHubMcp = spawn('node', [path.join(SRC_DIR, 'dev-hub-mcp-server.js')], {
  stdio: 'inherit',
  shell: true
});

devHubMcp.on('error', (err) => {
  console.error(`Failed to start Dev Hub MCP server: ${err.message}`);
});

// Wait a moment before starting the gateway
setTimeout(() => {
  // Start the Claude Desktop Gateway
  const gateway = spawn('node', [path.join(SRC_DIR, 'claude-desktop-gateway.js')], {
    stdio: 'inherit',
    shell: true
  });
  
  gateway.on('error', (err) => {
    console.error(`Failed to start Claude Desktop Gateway: ${err.message}`);
  });
  
  console.log('All services started. Press Ctrl+C to stop all services.');
}, 2000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down all services...');
  
  if (devHubMcp && !devHubMcp.killed) {
    devHubMcp.kill();
  }
  
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});
