// test-dev-hub.js
// Test script to demonstrate Claude Code → Claude Desktop integration through Dev Hub MCP

import DevHubClient from '../src/dev-hub-client.js';
import readline from 'readline';
import path from 'path';

// Create interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to ask questions
function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

// Main function
async function main() {
  console.log('Claude Code → Claude Desktop Integration Test');
  console.log('============================================\n');
  
  const client = new DevHubClient();
  
  console.log('Connecting to Dev Hub MCP server...');
  
  try {
    const capabilities = await client.connect();
    console.log('Connected successfully!\n');
    
    if (capabilities && capabilities.tools) {
      console.log('Available tools:');
      for (const tool of capabilities.tools) {
        console.log(`- ${tool.name}: ${tool.description}`);
      }
      console.log('');
    }
    
    while (true) {
      console.log('\nAvailable actions:');
      console.log('1. Analyze codebase');
      console.log('2. Debug with browser context');
      console.log('3. Analyze performance');
      console.log('4. Review code');
      console.log('5. Exit');
      
      const choice = await question('\nSelect an action (1-5): ');
      
      try {
        let result;
        
        switch (choice) {
          case '1':
            const directory = await question('Enter directory path to analyze: ');
            const analysisType = await question('Analysis type (overview, security, performance, architecture, comprehensive): ');
            
            console.log('\nSending request to analyze codebase...');
            result = await client.analyzeCodebase(directory, analysisType);
            break;
            
          case '2':
            const errorMessage = await question('Enter error message or description: ');
            const codeFilesInput = await question('Enter code files to include (comma-separated): ');
            const codeFiles = codeFilesInput.split(',').map(f => f.trim()).filter(Boolean);
            
            console.log('\nSending request to debug with browser context...');
            result = await client.debugWithBrowserContext(errorMessage, codeFiles);
            break;
            
          case '3':
            const page = await question('Enter page or route to analyze: ');
            const captureNetwork = (await question('Capture network activity? (y/n): ')).toLowerCase() === 'y';
            const captureConsole = (await question('Capture console logs? (y/n): ')).toLowerCase() === 'y';
            
            console.log('\nSending request to analyze performance...');
            result = await client.analyzePerformance(page, captureNetwork, captureConsole);
            break;
            
          case '4':
            const repoDirectory = await question('Enter repository directory: ');
            const prNumberInput = await question('Enter PR number (or leave empty): ');
            const prNumber = prNumberInput ? parseInt(prNumberInput, 10) : undefined;
            const includeBrowserContext = (await question('Include browser context? (y/n): ')).toLowerCase() === 'y';
            
            console.log('\nSending request to review code...');
            result = await client.reviewCode(repoDirectory, prNumber, includeBrowserContext);
            break;
            
          case '5':
            console.log('Disconnecting from Dev Hub MCP server...');
            client.disconnect();
            rl.close();
            return;
            
          default:
            console.log('Invalid choice. Please try again.');
            continue;
        }
        
        console.log('\nResult:');
        console.log(JSON.stringify(result, null, 2));
        
      } catch (err) {
        console.error(`Error: ${err.message}`);
      }
    }
  } catch (err) {
    console.error(`Failed to connect: ${err.message}`);
    console.error('Make sure the Dev Hub MCP server is running.');
    rl.close();
  }
}

// Run the main function
main().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
