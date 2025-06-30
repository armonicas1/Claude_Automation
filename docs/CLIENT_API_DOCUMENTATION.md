# Client API Documentation

This document provides detailed information about the client APIs available in the Claude Automation project, explaining how to use them to interact with Claude Desktop and related services.

## Overview

The Claude Automation project provides several client APIs for different use cases:

1. **Claude Desktop Client**: For interacting with Claude Desktop through the bridge
2. **Claude Code Client**: For interacting with Claude Code
3. **Dev Hub Client**: For accessing development tooling
4. **MCP Client**: For communicating with the MCP server

These APIs enable developers to:
- Automate interactions with Claude
- Integrate Claude into other applications
- Extend Claude's capabilities with custom tools
- Build development workflows around Claude

## Claude Desktop Client API

The Claude Desktop Client is implemented in `claude-desktop-client.py` and provides a Python interface for interacting with Claude Desktop.

### Initialization

```python
from claude_desktop_client import ClaudeDesktopClient

# Initialize the client
client = ClaudeDesktopClient()
```

### Key Methods

#### Check Bridge Status

```python
# Check if the bridge is running
is_running, status = client.check_bridge_status()
if is_running:
    print(f"Bridge is running, last updated: {status['timestamp']}")
else:
    print("Bridge is not running")
```

#### Send Request to Claude

```python
# Send a message to Claude
response = client.send_to_claude(
    message="What is the capital of France?",
    conversation_id="my-conversation"
)
print(response['text'])
```

#### Execute Tool

```python
# Execute a tool through Claude
result = client.execute_tool(
    tool_name="file_read",
    parameters={"path": "/path/to/file.txt"},
    conversation_id="my-conversation"
)
print(result)
```

#### Manage Conversations

```python
# Create a new conversation
conversation_id = client.create_conversation("My New Conversation")

# List conversations
conversations = client.list_conversations()
for conv in conversations:
    print(f"ID: {conv['id']}, Name: {conv['name']}")

# Delete a conversation
client.delete_conversation(conversation_id)
```

## Claude Code Client API

The Claude Code Client is implemented in `claude-code-client.js` and provides a JavaScript interface for interacting with Claude Code.

### Initialization

```javascript
import { ClaudeCodeClient } from './claude-code-client.js';

// Initialize the client
const client = new ClaudeCodeClient();
```

### Key Methods

#### Connect to Claude Code

```javascript
// Connect to Claude Code
await client.connect();
```

#### Send Code Query

```javascript
// Send a code-related query to Claude
const response = await client.sendCodeQuery({
  code: "function add(a, b) { return a + b; }",
  query: "What does this function do?",
  language: "javascript"
});

console.log(response.explanation);
```

#### Get Code Completion

```javascript
// Get code completion suggestions
const completions = await client.getCodeCompletion({
  code: "function calculate",
  language: "javascript",
  maxCompletions: 3
});

completions.forEach(completion => {
  console.log(completion.text);
});
```

#### Analyze Code

```javascript
// Analyze code for issues
const analysis = await client.analyzeCode({
  code: "function divide(a, b) { return a / b; }",
  language: "javascript"
});

console.log("Issues found:", analysis.issues);
```

## Dev Hub Client API

The Dev Hub Client is implemented in `dev-hub-client.js` and provides a JavaScript interface for accessing development tooling.

### Initialization

```javascript
import { DevHubClient } from './dev-hub-client.js';

// Initialize the client
const client = new DevHubClient({
  host: 'localhost',
  port: 4322
});
```

### Key Methods

#### Connect to Dev Hub

```javascript
// Connect to Dev Hub
await client.connect();
```

#### Get Project Information

```javascript
// Get information about the current project
const projectInfo = await client.getProjectInfo();
console.log("Project name:", projectInfo.name);
console.log("Project structure:", projectInfo.structure);
```

#### Execute Development Tool

```javascript
// Execute a development tool
const result = await client.executeTool("run_command", {
  command: "npm install",
  cwd: "/path/to/project"
});

console.log("Exit code:", result.exitCode);
console.log("Output:", result.output);
```

#### Register Custom Tool

```javascript
// Register a custom development tool
await client.registerTool({
  name: "custom_formatter",
  description: "Format code according to custom rules",
  parameters: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "Code to format"
      },
      language: {
        type: "string",
        description: "Programming language"
      }
    },
    required: ["code", "language"]
  },
  handler: async (params) => {
    // Implementation
    return { formattedCode: "// Formatted code" };
  }
});
```

## MCP Client API

The MCP Client is a general-purpose client for communicating with any MCP server, including the custom Claude MCP implementation.

### Initialization

```javascript
import { McpClient } from './mcp-client.js';

// Initialize the client
const client = new McpClient({
  serverUrl: 'http://localhost:4323',
  apiKey: 'your-api-key'
});
```

### Key Methods

#### Send Message

```javascript
// Send a message to the model
const response = await client.sendMessage({
  messages: [
    { role: "user", content: "What is the weather like today?" }
  ]
});

console.log(response.content);
```

#### Stream Response

```javascript
// Stream a response from the model
const stream = await client.streamMessage({
  messages: [
    { role: "user", content: "Write a long story about a dragon." }
  ]
});

for await (const chunk of stream) {
  console.log(chunk.content);
}
```

#### Execute Tool

```javascript
// Execute a tool
const result = await client.executeTool("file_search", {
  pattern: "*.js",
  directory: "/path/to/search"
});

console.log("Files found:", result.files);
```

#### Register Tool

```javascript
// Register a tool with the MCP server
await client.registerTool({
  name: "weather_lookup",
  description: "Look up weather information for a location",
  parameters: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "The location to get weather for"
      }
    },
    required: ["location"]
  }
});
```

#### Manage Sessions

```javascript
// Create a new session
const sessionId = await client.createSession();

// Use a specific session
client.setSessionId(sessionId);

// Delete a session
await client.deleteSession(sessionId);
```

## Common Patterns

### Error Handling

All client APIs use consistent error handling:

```javascript
try {
  const result = await client.executeTool("some_tool", {
    // parameters
  });
  // Process result
} catch (error) {
  if (error.code === 'TOOL_NOT_FOUND') {
    console.error("Tool not available:", error.message);
  } else if (error.code === 'VALIDATION_ERROR') {
    console.error("Invalid parameters:", error.details);
  } else if (error.code === 'EXECUTION_ERROR') {
    console.error("Execution failed:", error.message);
  } else {
    console.error("Unknown error:", error);
  }
}
```

### Authentication

Authentication methods vary by client:

- **Claude Desktop Client**: Local file-based authentication
- **Claude Code Client**: API key authentication
- **Dev Hub Client**: Session-based authentication
- **MCP Client**: API key or token authentication

Example with API key:
```javascript
const client = new McpClient({
  serverUrl: 'http://localhost:4323',
  apiKey: 'your-api-key'
});
```

### Conversation Context

Maintaining conversation context:

```javascript
// First message in conversation
const response1 = await client.sendMessage({
  messages: [
    { role: "user", content: "What is the capital of France?" }
  ]
});

// Follow-up message (context is automatically maintained)
const response2 = await client.sendMessage({
  messages: [
    { role: "user", content: "What is the population of that city?" }
  ]
});
```

### Tool Chaining

Chaining multiple tool executions:

```javascript
// Find files matching a pattern
const searchResult = await client.executeTool("file_search", {
  pattern: "*.js",
  directory: "/path/to/search"
});

// Read each file found
for (const file of searchResult.files) {
  const content = await client.executeTool("file_read", {
    path: file
  });
  
  // Analyze each file
  const analysis = await client.executeTool("code_analysis", {
    code: content,
    language: "javascript"
  });
  
  console.log(`Analysis for ${file}:`, analysis);
}
```

## Integration Examples

### Integrating with Express.js

```javascript
import express from 'express';
import { ClaudeDesktopClient } from './claude-desktop-client.js';

const app = express();
app.use(express.json());

const claudeClient = new ClaudeDesktopClient();

app.post('/ask-claude', async (req, res) => {
  try {
    const { question, conversationId } = req.body;
    
    const response = await claudeClient.sendToGraude(
      question,
      conversationId
    );
    
    res.json({ answer: response.text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Integrating with Python Scripts

```python
from claude_desktop_client import ClaudeDesktopClient

def process_documents(documents):
    client = ClaudeDesktopClient()
    
    for doc in documents:
        with open(doc, 'r') as file:
            content = file.read()
        
        summary = client.send_to_claude(
            message=f"Summarize this document:\n\n{content}",
            conversation_id="document-summaries"
        )
        
        print(f"Summary of {doc}:")
        print(summary['text'])
        print("-" * 50)

if __name__ == "__main__":
    documents = ["doc1.txt", "doc2.txt", "doc3.txt"]
    process_documents(documents)
```

## Client API Best Practices

1. **Connection Management**: Reuse client connections when possible
2. **Error Handling**: Implement comprehensive error handling
3. **Timeouts**: Set appropriate timeouts for operations
4. **Retries**: Implement retry logic for transient failures
5. **Conversation Management**: Clean up unused conversations
6. **Authentication**: Securely manage API keys and tokens
7. **Validation**: Validate inputs before sending to the API
8. **Logging**: Implement appropriate logging for debugging

## Client API Limitations

1. **Rate Limits**: Clients may be subject to rate limiting
2. **Concurrency**: Limited concurrent request handling
3. **Message Size**: Limitations on message size
4. **Tool Availability**: Not all tools may be available on all servers
5. **Compatibility**: Client versions must be compatible with server versions

## Troubleshooting

Common issues and solutions:

1. **Connection Failures**:
   - Check that the server is running
   - Verify network connectivity
   - Ensure correct host and port

2. **Authentication Issues**:
   - Verify API key or token
   - Check for expired credentials
   - Ensure proper permissions

3. **Tool Execution Failures**:
   - Verify tool is registered
   - Check parameter validation
   - Look for environmental issues

4. **Performance Problems**:
   - Reduce request frequency
   - Optimize message size
   - Check for resource constraints
