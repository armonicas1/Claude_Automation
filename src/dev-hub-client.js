// dev-hub-client.js
// Client library for Claude Code to interact with the Dev Hub MCP server

import fetch from 'node-fetch';
import WebSocket from 'ws';
import crypto from 'crypto';

class DevHubClient {
  constructor(options = {}) {
    this.host = options.host || 'localhost';
    this.port = options.port || 4323;
    this.baseUrl = `http://${this.host}:${this.port}`;
    this.wsUrl = `ws://${this.host}:${this.port}`;
    this.sessionId = null;
    this.ws = null;
    this.nextId = 1;
    this.pendingRequests = new Map();
  }
  
  /**
   * Connect to the Dev Hub MCP server
   */
  async connect() {
    try {
      // Check if server is running
      const identityResponse = await fetch(`${this.baseUrl}/.identity`);
      
      if (!identityResponse.ok) {
        throw new Error(`Failed to connect to Dev Hub MCP server: ${identityResponse.statusText}`);
      }
      
      const identity = await identityResponse.json();
      console.log(`Connected to Dev Hub MCP server: ${identity.name} v${identity.version}`);
      
      // Create WebSocket connection
      return new Promise((resolve, reject) => {
        this.ws = new WebSocket(this.wsUrl);
        
        this.ws.on('open', async () => {
          console.log('WebSocket connection established');
          
          // Initialize with server
          try {
            const capabilities = await this.initialize();
            this.sessionId = crypto.randomUUID();
            resolve(capabilities);
          } catch (err) {
            reject(err);
          }
        });
        
        this.ws.on('message', (data) => {
          try {
            const response = JSON.parse(data.toString());
            const requestPromise = this.pendingRequests.get(response.id);
            
            if (requestPromise) {
              if (response.error) {
                requestPromise.reject(new Error(response.error.message));
              } else {
                requestPromise.resolve(response.result);
              }
              this.pendingRequests.delete(response.id);
            }
          } catch (err) {
            console.error('Error processing message:', err);
          }
        });
        
        this.ws.on('error', (err) => {
          console.error('WebSocket error:', err);
          reject(err);
        });
        
        this.ws.on('close', () => {
          console.log('WebSocket connection closed');
          // Reject all pending requests
          for (const [id, { reject }] of this.pendingRequests) {
            reject(new Error('WebSocket connection closed'));
          }
          this.pendingRequests.clear();
        });
      });
    } catch (err) {
      throw new Error(`Failed to connect to Dev Hub MCP server: ${err.message}`);
    }
  }
  
  /**
   * Initialize with the server
   */
  async initialize() {
    return this.sendRequest('initialize', {});
  }
  
  /**
   * Send a request to the server
   */
  async sendRequest(method, params) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket connection not open'));
        return;
      }
      
      const id = String(this.nextId++);
      
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };
      
      this.pendingRequests.set(id, { resolve, reject });
      
      this.ws.send(JSON.stringify(request));
    });
  }
  
  /**
   * Call a tool
   */
  async callTool(name, parameters) {
    return this.sendRequest('tools/call', {
      name,
      parameters
    });
  }
  
  /**
   * Analyze a codebase
   */
  async analyzeCodebase(directory, analysisType = 'overview') {
    return this.callTool('analyze_codebase', {
      directory,
      analysis_type: analysisType
    });
  }
  
  /**
   * Debug with browser context
   */
  async debugWithBrowserContext(errorMessage, codeFiles = []) {
    return this.callTool('debug_with_browser_context', {
      error_message: errorMessage,
      code_files: codeFiles
    });
  }
  
  /**
   * Analyze performance
   */
  async analyzePerformance(page, captureNetwork = true, captureConsole = true) {
    return this.callTool('analyze_performance', {
      page,
      capture_network: captureNetwork,
      capture_console: captureConsole
    });
  }
  
  /**
   * Review code
   */
  async reviewCode(directory, prNumber, includeBrowserContext = true) {
    return this.callTool('code_review', {
      directory,
      pr_number: prNumber,
      include_browser_context: includeBrowserContext
    });
  }
  
  /**
   * Close the connection
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export default DevHubClient;
