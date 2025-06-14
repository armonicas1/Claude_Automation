// claude-code-client.js
// Client utility for Claude Code to trigger Claude Desktop actions

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import os from 'os';

class ClaudeCodeClient {
  constructor(options = {}) {
    this.host = options.host || 'localhost';
    this.port = options.port || 4323;
    this.baseUrl = `http://${this.host}:${this.port}`;
    
    // Claude directories and files
    this.claudeDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Claude');
    this.sessionId = options.sessionId;
    this.sessionToken = options.sessionToken;
  }
  
  /**
   * Set the session credentials
   * @param {string} sessionId - The Claude session ID
   * @param {string} sessionToken - The session token
   */
  setSession(sessionId, sessionToken) {
    this.sessionId = sessionId;
    this.sessionToken = sessionToken;
  }
  
  /**
   * Check if the MCP server is running
   * @returns {Promise<boolean>} Whether the server is running
   */
  async checkMcpServer() {
    try {
      const response = await fetch(`${this.baseUrl}/.identity`);
      return response.ok;
    } catch (err) {
      return false;
    }
  }
  
  /**
   * Execute an action in Claude Desktop
   * @param {string} action - The action to execute
   * @param {object} params - The parameters for the action
   * @returns {Promise<object>} The result of the action
   */
  async executeAction(action, params = {}) {
    if (!this.sessionId || !this.sessionToken) {
      throw new Error('Session credentials not set. Call setSession() first.');
    }
    
    // Check if MCP server is running
    const serverRunning = await this.checkMcpServer();
    if (!serverRunning) {
      throw new Error('MCP server is not running. Please start the Claude Desktop Extension first.');
    }
    
    try {
      // Call the MCP server's execute_from_code tool
      const response = await fetch(`${this.baseUrl}/rpc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now().toString(),
          method: 'execute_tool',
          params: {
            tool: 'execute_from_code',
            input: {
              action,
              params,
              session_id: this.sessionId,
              session_token: this.sessionToken
            }
          }
        })
      });
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error.message || 'Unknown error');
      }
      
      return result.result;
    } catch (err) {
      throw new Error(`Failed to execute action: ${err.message}`);
    }
  }
  
  /**
   * Check the status of a previously triggered action
   * @param {string} triggerId - The ID of the trigger to check
   * @returns {Promise<object>} The status of the trigger
   */
  async checkTriggerStatus(triggerId) {
    if (!this.sessionId || !this.sessionToken) {
      throw new Error('Session credentials not set. Call setSession() first.');
    }
    
    try {
      // Call the MCP server's check_trigger_status tool
      const response = await fetch(`${this.baseUrl}/rpc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now().toString(),
          method: 'execute_tool',
          params: {
            tool: 'check_trigger_status',
            input: {
              trigger_id: triggerId,
              session_id: this.sessionId,
              session_token: this.sessionToken
            }
          }
        })
      });
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error.message || 'Unknown error');
      }
      
      return result.result;
    } catch (err) {
      throw new Error(`Failed to check trigger status: ${err.message}`);
    }
  }
}

export default ClaudeCodeClient;
