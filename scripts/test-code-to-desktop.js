// test-code-to-desktop.js
// Test script to demonstrate Claude Code → Claude Desktop communication

import ClaudeCodeClient from '../src/claude-code-client.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';

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
  console.log('Claude Code → Claude Desktop Test');
  console.log('=================================\n');
  
  // Create client
  const client = new ClaudeCodeClient();
  
  // Check if MCP server is running
  const serverRunning = await client.checkMcpServer();
  if (!serverRunning) {
    console.error('Error: MCP server is not running.');
    console.error('Please start the Claude Desktop Extension first using "npm run start:all"');
    process.exit(1);
  }
  
  console.log('✅ MCP server is running\n');
  
  // For testing, we'll simulate a session
  // In a real scenario, this would be authenticated with Claude's API
  const sessionId = `test_session_${Date.now()}`;
  const sessionToken = `test_token_${Date.now()}`;
  
  // Set up a mock session in the authenticated_sessions.json file
  const claudeDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Claude');
  const sessionsFilePath = path.join(claudeDir, 'authenticated_sessions.json');
  
  let sessionsData = { sessions: {} };
  if (fs.existsSync(sessionsFilePath)) {
    sessionsData = JSON.parse(fs.readFileSync(sessionsFilePath, 'utf8'));
  }
  
  // Add our test session
  sessionsData.sessions[sessionId] = {
    token: sessionToken,
    source: 'code_test',
    created_at: Date.now(),
    expires: Date.now() + (1 * 60 * 60 * 1000) // 1 hour
  };
  
  fs.writeFileSync(sessionsFilePath, JSON.stringify(sessionsData, null, 2));
  
  console.log('Created test session for demonstration');
  client.setSession(sessionId, sessionToken);
  
  while (true) {
    console.log('\nAvailable actions:');
    console.log('1. Switch model');
    console.log('2. Analyze file');
    console.log('3. Open conversation');
    console.log('4. Exit');
    
    const choice = await question('\nSelect an action (1-4): ');
    
    try {
      let result;
      
      switch (choice) {
        case '1':
          const model = await question('Enter model name (e.g., claude-3-opus): ');
          result = await client.executeAction('switch_model', { model });
          break;
          
        case '2':
          const filePath = await question('Enter file path to analyze: ');
          result = await client.executeAction('analyze_file', { file_path: filePath });
          break;
          
        case '3':
          const conversationId = await question('Enter conversation ID: ');
          result = await client.executeAction('open_conversation', { conversation_id: conversationId });
          break;
          
        case '4':
          console.log('Exiting...');
          // Clean up our test session
          delete sessionsData.sessions[sessionId];
          fs.writeFileSync(sessionsFilePath, JSON.stringify(sessionsData, null, 2));
          rl.close();
          return;
          
        default:
          console.log('Invalid choice. Please try again.');
          continue;
      }
      
      console.log('\nAction triggered successfully:');
      console.log(result);
      
      // If we have a trigger ID, we can check its status
      if (result && result.trigger_id) {
        console.log('\nChecking trigger status in 3 seconds...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const status = await client.checkTriggerStatus(result.trigger_id);
        console.log('Trigger status:');
        console.log(status);
      }
      
    } catch (err) {
      console.error(`Error: ${err.message}`);
    }
  }
}

// Run the main function
main().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
