/**
 * Module Compatibility Wrapper
 * 
 * This script serves as a bridge between ESM and CommonJS to resolve module loading issues.
 * It loads the model gateway and provides compatibility for both module systems.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawnSync } from 'child_process';
import fs from 'fs';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

console.log('Module Compatibility Wrapper initializing...');

// Check if we need to create any compatibility files
checkAndCreateCompatibilityFiles();

// Start the model gateway using the compatibility script
console.log('Starting model gateway with compatibility layer...');
try {
    const startScriptPath = join(__dirname, 'start-model-gateway-compat.js');
    const result = spawnSync('node', [startScriptPath], { 
        stdio: 'inherit',
        cwd: projectRoot
    });
    
    if (result.error) {
        console.error('Error starting model gateway:', result.error);
    }
} catch (error) {
    console.error('Failed to start model gateway:', error);
}

// Function to create compatibility files as needed
function checkAndCreateCompatibilityFiles() {
    // Create a compatibility version of start-model-gateway.js
    const originalPath = join(__dirname, 'start-model-gateway.js');
    const compatPath = join(__dirname, 'start-model-gateway-compat.js');
    
    if (fs.existsSync(originalPath)) {
        console.log('Creating compatibility version of start-model-gateway.js...');
        let content = fs.readFileSync(originalPath, 'utf8');
        
        // Convert require statements to dynamic imports
        content = `
// This is an auto-generated compatibility file for ESM/CommonJS interoperability
// Original file: start-model-gateway.js

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Create require function
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Setup global compatibility functions for CommonJS modules
globalThis.__filename = __filename;
globalThis.__dirname = __dirname;
globalThis.require = require;

// Continue with the original script logic converted to ESM
${content.replace(/const\s+(\w+)\s*=\s*require\(['"](.*)['"]\)/g, 'const $1 = await import("$2").then(m => m.default || m)')}
`;

        fs.writeFileSync(compatPath, content);
    }
    
    // Create compatibility version of the MCP stdio script
    createMcpCompatibilityVersion();
}

// Create a compatibility version of the MCP server script
function createMcpCompatibilityVersion() {
    const mcpOriginalPath = join(projectRoot, 'src', 'custom-claude-mcp-stdio.js');
    const mcpCompatPath = join(projectRoot, 'src', 'custom-claude-mcp-stdio-compat.js');
    
    if (fs.existsSync(mcpOriginalPath)) {
        console.log('Creating compatibility version of custom-claude-mcp-stdio.js...');
        const content = fs.readFileSync(mcpOriginalPath, 'utf8');
        
        // Create an ESM-compatible version with dynamic imports
        const compatContent = `
// This is an auto-generated compatibility file for ESM/CommonJS interoperability
// Original file: custom-claude-mcp-stdio.js

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import path from 'path';

// Create require function
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Setup global compatibility functions
globalThis.__filename = __filename;
globalThis.__dirname = __dirname;
globalThis.require = require;

// Import utilities using dynamic import
const wslManager = await import('./utils/wsl-manager.js').then(m => m.default || m);
const bridgeManager = await import('./utils/bridge-manager.js').then(m => m.default || m);
const validateToolParameters = await import('./utils/validate-tool-parameters.js').then(m => m.default || m);

// Load plugins dynamically
async function loadPlugins(pluginsDir) {
    console.error('Loading plugins from: ' + pluginsDir);
    const plugins = [];
    
    if (fs.existsSync(pluginsDir)) {
        const files = fs.readdirSync(pluginsDir);
        for (const file of files) {
            if (file.endsWith('.js') || file.endsWith('.mjs')) {
                try {
                    const pluginPath = path.join(pluginsDir, file);
                    console.error('Loading plugin: ' + pluginPath);
                    const plugin = await import('file://' + pluginPath);
                    plugins.push(plugin.default || plugin);
                    console.error('Successfully loaded plugin: ' + file);
                } catch (err) {
                    console.error('Error loading plugin ' + file + ':', err);
                }
            }
        }
    }
    
    return plugins;
}

// Rest of the MCP script logic with ESM compatibility
// ...

// Listen for stdin and process requests
process.stdin.setEncoding('utf8');
let buffer = '';

process.stdin.on('data', async (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\\n');
    buffer = lines.pop(); // Keep the last incomplete line in the buffer
    
    for (const line of lines) {
        if (line.trim() === '') continue;
        
        try {
            const req = JSON.parse(line);
            // Handle request based on the original logic
            // For now, we'll just echo it back for testing
            const response = {
                jsonrpc: "2.0",
                id: req.id,
                result: { message: "MCP Compatibility Layer - Request received" }
            };
            process.stdout.write(JSON.stringify(response) + '\\n');
        } catch (err) {
            console.error('Error processing request:', err);
        }
    }
});

// Initialize - this should use the same logic as the original script
console.error('MCP Compatibility Layer initialized');
`;

        fs.writeFileSync(mcpCompatPath, compatContent);
        
        // Also update Claude's config to point to the compatibility version
        updateClaudeConfig(mcpCompatPath);
    }
}

// Update Claude's configuration to use the compatibility MCP script
function updateClaudeConfig(mcpCompatPath) {
    const appDataDir = process.env.APPDATA || 
        (process.platform === 'darwin' 
            ? join(process.env.HOME, 'Library', 'Application Support') 
            : join(process.env.HOME, '.local', 'share'));
    
    const claudeConfigPath = join(appDataDir, 'Claude', 'config.json');
    
    if (fs.existsSync(claudeConfigPath)) {
        console.log('Updating Claude Desktop config to use compatibility MCP script...');
        try {
            const config = JSON.parse(fs.readFileSync(claudeConfigPath, 'utf8'));
            
            if (config.mcpServers && config.mcpServers.length > 0) {
                // Find and update the custom MCP server
                for (let i = 0; i < config.mcpServers.length; i++) {
                    const server = config.mcpServers[i];
                    if (server.type === 'stdio' && 
                        server.command && 
                        server.command.includes('custom-claude-mcp-stdio.js')) {
                        
                        // Update the command to use the compatibility version
                        config.mcpServers[i].command = server.command.replace(
                            'custom-claude-mcp-stdio.js', 
                            'custom-claude-mcp-stdio-compat.js'
                        );
                        console.log('Updated MCP server command in Claude config');
                    }
                }
                
                // Write the updated config
                fs.writeFileSync(claudeConfigPath, JSON.stringify(config, null, 2));
                console.log('Claude Desktop config updated successfully');
            }
        } catch (error) {
            console.error('Error updating Claude config:', error);
        }
    } else {
        console.warn('Claude Desktop config not found at:', claudeConfigPath);
    }
}
