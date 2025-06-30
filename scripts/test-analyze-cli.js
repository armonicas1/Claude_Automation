// Test client for the stdio MCP server
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create request message
const request = {
  jsonrpc: "2.0",
  id: "test-analyze-request",
  method: "tools/call",
  params: {
    name: "analyze_claude_code_cli",
    arguments: {
      analysis_type: "full"
    }
  }
};

// Send request to stdout
console.log(JSON.stringify(request));

// Listen for a response
process.stdin.on('data', (data) => {
  try {
    const responses = data.toString().trim().split('\n');
    
    for (const responseText of responses) {
      if (responseText.trim().startsWith('{') && responseText.trim().endsWith('}')) {
        try {
          const response = JSON.parse(responseText);
          
          if (response.id === "test-analyze-request") {
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
}, 10000);
