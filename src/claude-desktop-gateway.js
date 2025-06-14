// claude-desktop-gateway.js
// Gateway process that monitors requests from MCP server and interacts with Claude Desktop

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { exec } from 'child_process';
import chokidar from 'chokidar';

// Calculate absolute paths
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const LOG_DIR = path.join(PROJECT_ROOT, 'logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Setup logging
const logFile = fs.createWriteStream(path.join(LOG_DIR, 'desktop-gateway.log'), { flags: 'a' });
const logger = {
  info: (message) => {
    const logEntry = `[${new Date().toISOString()}] INFO: ${message}`;
    console.log(logEntry);
    logFile.write(logEntry + '\n');
  },
  error: (message) => {
    const logEntry = `[${new Date().toISOString()}] ERROR: ${message}`;
    console.error(logEntry);
    logFile.write(logEntry + '\n');
  }
};

// Claude directories and files
const claudeDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Claude');
const requestsDir = path.join(claudeDir, 'code_requests');
const responsesDir = path.join(claudeDir, 'code_responses');
const sessionStatePath = path.join(claudeDir, 'session_state.json');

// Ensure directories exist
if (!fs.existsSync(claudeDir)) {
  fs.mkdirSync(claudeDir, { recursive: true });
}
if (!fs.existsSync(requestsDir)) {
  fs.mkdirSync(requestsDir, { recursive: true });
}
if (!fs.existsSync(responsesDir)) {
  fs.mkdirSync(responsesDir, { recursive: true });
}

// Check if Claude Desktop is running
async function isClaudeDesktopRunning() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec('tasklist /FI "IMAGENAME eq claude.exe"', (err, stdout) => {
        if (err) {
          logger.error(`Error checking Claude process: ${err.message}`);
          resolve(false);
          return;
        }
        resolve(stdout.toLowerCase().includes('claude.exe'));
      });
    } else {
      exec('pgrep -f "Claude Desktop"', (err, stdout) => {
        if (err && err.code !== 1) {
          logger.error(`Error checking Claude process: ${err.message}`);
          resolve(false);
          return;
        }
        resolve(!!stdout.trim());
      });
    }
  });
}

// Start Claude Desktop if not running
async function startClaudeDesktop() {
  try {
    const claudePath = path.join(process.env.LOCALAPPDATA || `${os.homedir()}/AppData/Local`, 'AnthropicClaude', 'Claude.exe');
    
    if (fs.existsSync(claudePath)) {
      logger.info('Starting Claude Desktop...');
      exec(`"${claudePath}"`, (err) => {
        if (err) {
          logger.error(`Error starting Claude Desktop: ${err.message}`);
          return false;
        }
      });
      return true;
    }
    
    logger.error('Could not find Claude Desktop executable');
    return false;
  } catch (err) {
    logger.error(`Error starting Claude Desktop: ${err.message}`);
    return false;
  }
}

// Format context for Claude Desktop conversation
function formatPrompt(requestData) {
  const { type, context } = requestData;
  
  let prompt = [];
  
  // Add header based on type
  switch (type) {
    case "code_analysis":
      prompt.push("# Code Analysis Request\n");
      prompt.push(`I need your help analyzing a codebase (${context.analysis_type} analysis):\n`);
      break;
    case "debugging_session":
      prompt.push("# Debugging Session\n");
      prompt.push(`I need help debugging this issue: ${context.error_message}\n`);
      break;
    case "performance_analysis":
      prompt.push("# Performance Analysis Request\n");
      prompt.push(`I need help analyzing performance issues on page: ${context.page}\n`);
      break;
    case "code_review":
      prompt.push("# Code Review Request\n");
      prompt.push(`I need your help reviewing code changes${context.pr_number ? ` for PR #${context.pr_number}` : ''}:\n`);
      break;
    default:
      prompt.push("# Analysis Request\n");
      prompt.push("I need your help with the following:\n");
  }
  
  // Add structured context sections
  for (const [key, value] of Object.entries(context)) {
    if (value && typeof value === 'object') {
      prompt.push(`## ${key.replace(/_/g, ' ').toUpperCase()}\n`);
      
      if (Array.isArray(value)) {
        for (const item of value) {
          prompt.push(`- ${item}`);
        }
        prompt.push('\n');
      } else if (Object.keys(value).length > 0) {
        for (const [subKey, subValue] of Object.entries(value)) {
          if (subValue) {
            prompt.push(`### ${subKey.replace(/_/g, ' ')}\n`);
            if (typeof subValue === 'object') {
              prompt.push('```json\n');
              prompt.push(JSON.stringify(subValue, null, 2));
              prompt.push('\n```\n');
            } else {
              prompt.push(String(subValue));
              prompt.push('\n');
            }
          }
        }
      }
    } else if (value) {
      prompt.push(`## ${key.replace(/_/g, ' ').toUpperCase()}\n`);
      prompt.push(String(value));
      prompt.push('\n');
    }
  }
  
  // Add instructions based on type
  switch (type) {
    case "code_analysis":
      prompt.push("\n## INSTRUCTIONS\n");
      prompt.push("1. Analyze the code structure and organization");
      prompt.push("2. Identify potential issues, bugs, or areas for improvement");
      prompt.push("3. Suggest optimizations or best practices");
      prompt.push("4. Provide a summary of the codebase strengths and weaknesses");
      break;
    case "debugging_session":
      prompt.push("\n## INSTRUCTIONS\n");
      prompt.push("1. Identify the root cause of the error based on the provided context");
      prompt.push("2. Explain how the issue might be occurring");
      prompt.push("3. Suggest potential fixes with code examples");
      prompt.push("4. Recommend testing strategies to confirm the fix");
      break;
    case "performance_analysis":
      prompt.push("\n## INSTRUCTIONS\n");
      prompt.push("1. Identify performance bottlenecks from the provided data");
      prompt.push("2. Analyze network requests, rendering, and JavaScript execution");
      prompt.push("3. Suggest specific optimizations with examples");
      prompt.push("4. Provide a prioritized list of improvements");
      break;
    case "code_review":
      prompt.push("\n## INSTRUCTIONS\n");
      prompt.push("1. Review the code changes for quality, style, and potential issues");
      prompt.push("2. Highlight any security concerns or performance problems");
      prompt.push("3. Suggest improvements or alternative approaches");
      prompt.push("4. Provide an overall assessment of the changes");
      break;
  }
  
  // Add response structure guidance
  prompt.push("\n## RESPONSE FORMAT\n");
  prompt.push("Please structure your response with these sections:");
  prompt.push("1. **Summary** - Brief overview of findings");
  prompt.push("2. **Detailed Analysis** - In-depth examination of issues and context");
  prompt.push("3. **Recommendations** - Specific, actionable suggestions");
  prompt.push("4. **Next Steps** - Prioritized follow-up actions");
  
  return prompt.join('\n');
}

// Process a request from the MCP server
async function processRequest(requestFile) {
  try {
    logger.info(`Processing request file: ${requestFile}`);
    const requestData = JSON.parse(fs.readFileSync(requestFile, 'utf8'));
    const { id, request, status } = requestData;
    
    // Skip if already processed
    if (status !== "pending") {
      logger.info(`Request ${id} is already ${status}, skipping`);
      return;
    }
    
    // Update the request status to processing
    requestData.status = "processing";
    requestData.processing_started = Date.now();
    fs.writeFileSync(requestFile, JSON.stringify(requestData, null, 2));
    
    // Format the prompt for Claude Desktop
    const prompt = formatPrompt(request);
    
    logger.info(`Formatted prompt for request ${id}`);
    
    // Check if Claude Desktop is running
    const isRunning = await isClaudeDesktopRunning();
    if (!isRunning) {
      logger.info('Claude Desktop is not running, attempting to start it');
      await startClaudeDesktop();
      // Wait for it to start
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // In a real implementation, we would use Claude Desktop's API or UI automation
    // to create a new conversation with the prompt
    // For now, we'll simulate a response
    
    logger.info(`Simulating Claude Desktop processing for request ${id}`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Create a simulated response based on the request type
    let simulatedResponse;
    switch (request.type) {
      case "code_analysis":
        simulatedResponse = {
          summary: `This is a simulated code analysis for ${request.context.analysis_type} analysis`,
          detailed_analysis: {
            structure: "Analysis of code structure would appear here",
            patterns: "Analysis of code patterns would appear here",
            issues: ["Issue 1 would be listed here", "Issue 2 would be listed here"]
          },
          recommendations: [
            "Recommendation 1 for improving the codebase",
            "Recommendation 2 for improving the codebase"
          ],
          next_steps: [
            "Priority 1: First action item",
            "Priority 2: Second action item"
          ]
        };
        break;
      case "debugging_session":
        simulatedResponse = {
          summary: `Analysis of the error: ${request.context.error_message}`,
          root_cause: "Explanation of the root cause would appear here",
          code_issues: {
            identified_problems: ["Problem 1", "Problem 2"],
            affected_files: Object.keys(request.context.code_context || {})
          },
          solutions: [
            {
              description: "Solution 1 description",
              code_example: "Example code would appear here",
              pros_cons: "Analysis of pros and cons"
            },
            {
              description: "Solution 2 description",
              code_example: "Example code would appear here",
              pros_cons: "Analysis of pros and cons"
            }
          ],
          next_steps: ["Step 1", "Step 2", "Step 3"]
        };
        break;
      case "performance_analysis":
        simulatedResponse = {
          summary: `Performance analysis for page: ${request.context.page}`,
          bottlenecks: [
            "Bottleneck 1 description",
            "Bottleneck 2 description"
          ],
          optimization_opportunities: [
            {
              area: "JavaScript",
              description: "Optimization opportunity description",
              impact: "High/Medium/Low",
              implementation_difficulty: "Easy/Medium/Hard"
            },
            {
              area: "Network",
              description: "Optimization opportunity description",
              impact: "High/Medium/Low",
              implementation_difficulty: "Easy/Medium/Hard"
            }
          ],
          recommendations: [
            "Recommendation 1",
            "Recommendation 2"
          ]
        };
        break;
      case "code_review":
        simulatedResponse = {
          summary: request.context.pr_number 
            ? `Code review for PR #${request.context.pr_number}` 
            : "Code review for recent changes",
          quality_assessment: {
            code_style: "Assessment of code style",
            maintainability: "Assessment of maintainability",
            security: "Assessment of security implications"
          },
          issues: [
            {
              severity: "High/Medium/Low",
              description: "Issue description",
              suggestion: "Suggestion for improvement"
            }
          ],
          positive_aspects: [
            "Positive aspect 1",
            "Positive aspect 2"
          ],
          overall_assessment: "Overall assessment of the code changes"
        };
        break;
      default:
        simulatedResponse = {
          summary: "Simulated response for unknown request type",
          details: "This is a placeholder response",
          next_steps: ["Contact support for more information"]
        };
    }
    
    // Write the response to the responses directory
    const responseFile = path.join(responsesDir, `${id}.json`);
    fs.writeFileSync(responseFile, JSON.stringify({
      id: id,
      response: simulatedResponse,
      status: "completed",
      completed_at: Date.now()
    }, null, 2));
    
    logger.info(`Wrote response for request ${id} to ${responseFile}`);
    
    // Update the original request status
    requestData.status = "completed";
    requestData.completed_at = Date.now();
    fs.writeFileSync(requestFile, JSON.stringify(requestData, null, 2));
    
    // Clean up the request file after a delay to allow the MCP server to read the response
    setTimeout(() => {
      try {
        if (fs.existsSync(requestFile)) {
          fs.unlinkSync(requestFile);
          logger.info(`Cleaned up request file: ${requestFile}`);
        }
      } catch (err) {
        logger.error(`Error cleaning up request file: ${err.message}`);
      }
    }, 10000);
    
  } catch (err) {
    logger.error(`Error processing request: ${err.message}`);
    
    // Try to update the request status if possible
    try {
      const requestData = JSON.parse(fs.readFileSync(requestFile, 'utf8'));
      const { id } = requestData;
      
      // Update the request status to error
      requestData.status = "error";
      requestData.error = err.message;
      requestData.error_at = Date.now();
      fs.writeFileSync(requestFile, JSON.stringify(requestData, null, 2));
      
      // Write an error response
      const responseFile = path.join(responsesDir, `${id}.json`);
      fs.writeFileSync(responseFile, JSON.stringify({
        id: id,
        response: {
          error: err.message,
          status: "error"
        },
        status: "error",
        error_at: Date.now()
      }, null, 2));
      
    } catch (updateErr) {
      logger.error(`Error updating request status: ${updateErr.message}`);
    }
  }
}

// Update gateway status in session state
function updateGatewayStatus(status) {
  try {
    let sessionState = {};
    if (fs.existsSync(sessionStatePath)) {
      sessionState = JSON.parse(fs.readFileSync(sessionStatePath, 'utf8'));
    }
    
    sessionState.desktop_gateway = {
      status: status,
      pid: process.pid,
      timestamp: Date.now()
    };
    
    fs.writeFileSync(sessionStatePath, JSON.stringify(sessionState, null, 2));
    logger.info(`Updated gateway status: ${status}`);
  } catch (err) {
    logger.error(`Error updating gateway status: ${err.message}`);
  }
}

// Start the gateway
async function startGateway() {
  try {
    logger.info('Starting Claude Desktop Gateway...');
    
    // Update gateway status
    updateGatewayStatus('starting');
    
    // Process any existing requests
    const existingRequests = fs.readdirSync(requestsDir)
      .filter(file => file.endsWith('.json'));
    
    logger.info(`Found ${existingRequests.length} existing requests`);
    
    for (const requestFile of existingRequests) {
      await processRequest(path.join(requestsDir, requestFile));
    }
    
    // Set up watcher for new requests
    const watcher = chokidar.watch(requestsDir, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    });
    
    watcher.on('add', (filePath) => {
      if (path.extname(filePath) === '.json') {
        logger.info(`New request detected: ${filePath}`);
        processRequest(filePath);
      }
    });
    
    // Update gateway status
    updateGatewayStatus('running');
    
    logger.info('Claude Desktop Gateway is running');
    logger.info(`Monitoring requests directory: ${requestsDir}`);
    logger.info(`Writing responses to: ${responsesDir}`);
    
    // Set up health check interval
    setInterval(() => {
      updateGatewayStatus('running');
    }, 60000);
    
    // Handle process termination
    process.on('SIGINT', () => {
      logger.info('Shutting down gateway...');
      updateGatewayStatus('stopped');
      setTimeout(() => {
        process.exit(0);
      }, 1000);
    });
    
  } catch (err) {
    logger.error(`Error starting gateway: ${err.message}`);
    updateGatewayStatus('error');
    process.exit(1);
  }
}

// Start the gateway
startGateway();
