// Testing the analyze_claude_code_cli API with proper JSON-RPC format
import fetch from 'node-fetch';

async function main() {
  console.log("Starting API test...");
  console.log("Connecting to MCP server at http://localhost:4323/claude/api/tools/call");
  
  try {
    console.log("Sending request...");
    const requestBody = {
      jsonrpc: '2.0',
      id: 'test-request',
      method: 'tools/call',
      params: {
        name: 'analyze_claude_code_cli',
        arguments: {
          analysis_type: 'full'
        }
      }
    };
    
    console.log("Request payload:", JSON.stringify(requestBody, null, 2));
    
    const response = await fetch('http://localhost:4323/claude/api/tools/call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    console.log("Response status:", response.status);
    console.log("Response headers:", response.headers);
    
    const result = await response.json();
    console.log("Response body:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Error details:', error);
    
    // Check if server is running
    try {
      console.log("Checking if server is running...");
      const healthCheck = await fetch('http://localhost:4323/claude/api', {
        method: 'GET',
        timeout: 5000
      });
      console.log("Server health check status:", healthCheck.status);
    } catch (healthError) {
      console.error("Server health check failed:", healthError.message);
      console.log("It appears the MCP server is not running on port 4323");
      console.log("Please make sure to start the MCP server first");
    }
  }
}

main();
