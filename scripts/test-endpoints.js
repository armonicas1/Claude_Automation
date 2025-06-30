// Testing the MCP server endpoints
import fetch from 'node-fetch';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

async function testEndpoint(url) {
  try {
    console.log(`Testing endpoint: ${url}`);
    const response = await fetch(url, {
      method: 'GET',
      timeout: 5000
    });
    console.log(`  Status: ${response.status}`);
    
    // Try to parse response as JSON
    try {
      const text = await response.text();
      console.log(`  Response: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
      
      if (text && text.trim().startsWith('{')) {
        const json = JSON.parse(text);
        console.log(`  JSON: ${JSON.stringify(json).substring(0, 100)}...`);
      }
    } catch (parseError) {
      console.error(`  Parse error: ${parseError.message}`);
    }
    
    return response.status;
  } catch (error) {
    console.error(`  Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log("=== Testing various MCP server endpoints ===");
  
  // Base paths to try
  const basePaths = [
    'http://localhost:4323',
    'http://localhost:4322',
    'http://localhost:4323/claude/api',
    'http://localhost:4322/claude/api',
    'http://localhost:4323/api',
    'http://localhost:4322/api'
  ];
  
  // Try each base path
  for (const basePath of basePaths) {
    await testEndpoint(basePath);
  }
  
  console.log("\n=== Testing API endpoints ===");
  
  // API paths to try
  const apiPaths = [
    'http://localhost:4323/claude/api/tools',
    'http://localhost:4323/tools',
    'http://localhost:4323/claude/api/tools/call',
    'http://localhost:4323/tools/call',
    'http://localhost:4322/claude/api/tools',
    'http://localhost:4322/tools',
    'http://localhost:4322/claude/api/tools/call',
    'http://localhost:4322/tools/call'
  ];
  
  // Try each API path
  for (const apiPath of apiPaths) {
    await testEndpoint(apiPath);
  }
  
  // Test tools API
  const toolsResult = await testToolsAPI();
  
  // Test Claude Code CLI analysis if tools were found
  if (toolsResult) {
    await testClaudeCodeAnalysis(toolsResult.endpoint, toolsResult.tools);
  } else {
    console.log("\nUnable to find tools API. Check if the MCP server is running correctly.");
  }
  
  console.log("\n=== Testing Direct Analyze Script ===");
  await testDirectAnalyzeScript();
  
  console.log("\n=== Testing completed ===");
}

async function testToolsAPI() {
  console.log("\n=== Testing Tools API ===");
  
  // URLs to test
  const toolsUrls = [
    'http://localhost:4323/claude/api/tools/list',
    'http://localhost:4322/claude/api/tools/list',
    'http://localhost:4323/tools/list',
    'http://localhost:4322/tools/list'
  ];
  
  let toolsFound = false;
  
  // Test each endpoint
  for (const url of toolsUrls) {
    try {
      console.log(`Testing tools endpoint: ${url}`);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'test-tools-request',
          method: 'tools/list'
        }),
        timeout: 5000
      });
      
      console.log(`  Status: ${response.status}`);
      
      // Parse response
      try {
        const text = await response.text();
        console.log(`  Response: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
        
        if (text && text.trim().startsWith('{')) {
          const json = JSON.parse(text);
          console.log(`  Found ${json.result?.tools?.length || 0} tools`);
          
          if (json.result?.tools?.length > 0) {
            toolsFound = true;
            console.log("  Available tools:");
            json.result.tools.forEach(tool => {
              console.log(`    - ${tool.name}: ${tool.description?.substring(0, 50)}...`);
            });
            
            // Save working endpoint for testing analyze_claude_code_cli
            return { endpoint: url, tools: json.result.tools };
          }
        }
      } catch (parseError) {
        console.error(`  Parse error: ${parseError.message}`);
      }
    } catch (error) {
      console.error(`  Error: ${error.message}`);
    }
  }
  
  return null;
}

async function testClaudeCodeAnalysis(endpoint, tools) {
  console.log("\n=== Testing Claude Code CLI Analysis ===");
  
  // Check if analyze_claude_code_cli tool exists
  const analysisTool = tools.find(t => t.name === 'analyze_claude_code_cli');
  
  if (!analysisTool) {
    console.log("analyze_claude_code_cli tool not found!");
    return;
  }
  
  console.log(`Found analyze_claude_code_cli tool: ${analysisTool.description}`);
  
  // Get endpoint base path
  const basePath = endpoint.replace('/tools/list', '');
  const callEndpoint = `${basePath}/tools/call`;
  
  try {
    console.log(`Calling analysis tool at: ${callEndpoint}`);
    const response = await fetch(callEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'test-analysis-request',
        method: 'tools/call',
        params: {
          name: 'analyze_claude_code_cli',
          arguments: {
            analysis_type: 'full'
          }
        }
      }),
      timeout: 30000
    });
    
    console.log(`  Status: ${response.status}`);
    
    // Parse response
    try {
      const text = await response.text();
      console.log(`  Response: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
      
      if (text && text.trim().startsWith('{')) {
        const json = JSON.parse(text);
        
        if (json.result?.content) {
          try {
            // Parse the content
            const analysisResult = JSON.parse(json.result.content[0].text);
            console.log("  Analysis results:");
            console.log(`    Status: ${analysisResult.status}`);
            console.log(`    Installations found: ${analysisResult.installations_found?.length || 0}`);
            
            // Check for duplicates
            if (analysisResult.installations_found?.length > 0) {
              const toolkitInstallations = analysisResult.installations_found.filter(i => 
                i.type === 'wsl-toolkit' || i.path.includes('CLAUDE CODE ToolKIT'));
              
              console.log(`    WSL Toolkit installations: ${toolkitInstallations.length}`);
              
              if (toolkitInstallations.length > 1) {
                console.log("    WARNING: Duplicate WSL toolkit installations detected!");
              } else if (toolkitInstallations.length === 1) {
                console.log("    SUCCESS: No duplicate WSL toolkit installations!");
              }
              
              // Print all installations
              console.log("    All installations:");
              analysisResult.installations_found.forEach((inst, i) => {
                console.log(`      ${i+1}. ${inst.type}: ${inst.path}`);
              });
            }
          } catch (parseError) {
            console.error(`  Error parsing analysis result: ${parseError.message}`);
          }
        } else if (json.error) {
          console.error(`  Error: ${json.error.message}`);
        }
      }
    } catch (parseError) {
      console.error(`  Parse error: ${parseError.message}`);
    }
  } catch (error) {
    console.error(`  Error: ${error.message}`);
  }
}

async function testDirectAnalyzeScript() {
  try {
    console.log("Running direct-test-analyze-cli.js script...");
    const { stdout, stderr } = await execAsync('node ./scripts/direct-test-analyze-cli.js');
    
    console.log("Script output:");
    console.log(stdout);
    
    if (stderr) {
      console.error("Script errors:");
      console.error(stderr);
    }
    
    // Check the results file
    if (fs.existsSync('./scripts/direct-analysis-result.json')) {
      const result = JSON.parse(fs.readFileSync('./scripts/direct-analysis-result.json', 'utf8'));
      console.log("\nAnalysis Results Summary:");
      console.log(`Status: ${result.status}`);
      console.log(`Installations found: ${result.installations_found?.length || 0}`);
      
      // Check for duplicates
      if (result.installations_found?.length > 0) {
        const toolkitInstallations = result.installations_found.filter(i => 
          i.type === 'wsl-toolkit' || i.path.includes('CLAUDE CODE ToolKIT'));
        
        console.log(`WSL Toolkit installations: ${toolkitInstallations.length}`);
        
        if (toolkitInstallations.length > 1) {
          console.log("WARNING: Duplicate WSL toolkit installations detected!");
          
          // Print duplicate entries
          console.log("Duplicate entries:");
          toolkitInstallations.forEach((inst, i) => {
            console.log(`  ${i+1}. ${inst.type}: ${inst.path}`);
          });
        } else if (toolkitInstallations.length === 1) {
          console.log("SUCCESS: No duplicate WSL toolkit installations!");
          console.log(`Found toolkit: ${toolkitInstallations[0].path}`);
          if (toolkitInstallations[0].version) {
            console.log(`Version: ${toolkitInstallations[0].version}`);
          }
        }
      }
    } else {
      console.log("Analysis results file not found!");
    }
  } catch (error) {
    console.error("Error running direct test script:", error.message);
  }
}

main();
