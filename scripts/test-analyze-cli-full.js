// Test client for the stdio MCP server with initialization
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// First, send an initialization request
const initRequest = {
  jsonrpc: "2.0",
  id: "init-request",
  method: "initialize",
  params: {}
};

console.log(JSON.stringify(initRequest));
process.stdout.write('\n');  // Ensure newline and flush

// Then wait for response and send the tools/list request
let initialized = false;
let listedTools = false;

process.stdin.on('data', (data) => {
  try {
    const responses = data.toString().trim().split('\n');
    
    for (const responseText of responses) {
      if (responseText.trim().startsWith('{') && responseText.trim().endsWith('}')) {
        try {
          const response = JSON.parse(responseText);
          
          // Handle initialization response
          if (response.id === "init-request" && !initialized) {
            console.error("Server initialized successfully");
            initialized = true;
            
            // Now send the tools/list request
            const listRequest = {
              jsonrpc: "2.0",
              id: "list-tools-request",
              method: "tools/list",
              params: {}
            };
            
            console.log(JSON.stringify(listRequest));
            process.stdout.write('\n');  // Ensure newline and flush
          }
          
          // Handle tools/list response
          if (response.id === "list-tools-request" && !listedTools) {
            console.error(`Server reported ${response.result?.tools?.length || 0} available tools`);
            
            // Check if our tool is in the list
            const analyzeToolExists = response.result?.tools?.some(
              tool => tool.name === "analyze_claude_code_cli"
            );
            
            if (analyzeToolExists) {
              console.error("Found analyze_claude_code_cli tool, sending request...");
              listedTools = true;
              
              // Now send the actual tool call
              const toolRequest = {
                jsonrpc: "2.0",
                id: "tool-call-request",
                method: "tools/call",
                params: {
                  name: "analyze_claude_code_cli",
                  arguments: {
                    analysis_type: "full"
                  }
                }
              };
              
              console.log(JSON.stringify(toolRequest));
              process.stdout.write('\n');  // Ensure newline and flush
            } else {
              console.error("analyze_claude_code_cli tool not found in the tools list!");
              process.exit(1);
            }
          }
          
          // Handle tool call response
          if (response.id === "tool-call-request") {
            console.error("Received tool call response");
            
            if (response.error) {
              console.error(`Error: ${response.error.message}`);
              process.exit(1);
            }
            
            // Write result to file for inspection
            fs.writeFileSync(
              path.join(__dirname, 'analysis-result.json'), 
              JSON.stringify(response.result, null, 2)
            );
            console.error("Analysis complete! Results written to analysis-result.json");
            process.exit(0);
          }
        } catch (err) {
          console.error(`Failed to parse response: ${err.message}`);
          console.error(`Response text: ${responseText}`);
        }
      }
    }
  } catch (err) {
    console.error(`Error handling response: ${err.message}`);
  }
});

// Set a timeout in case we don't get a response
setTimeout(() => {
  console.error("Timeout waiting for response");
  process.exit(1);
}, 30000);
