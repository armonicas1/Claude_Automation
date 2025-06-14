// file-operations-plugin.js
// Plugin that adds file operation tools to the MCP server

import fs from 'fs';
import path from 'path';
import os from 'os';

const claudeDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Claude');
const sessionStatePath = path.join(claudeDir, 'session_state.json');

// Plugin definition
export default {
  name: 'file-operations',
  version: '1.0.0',
  description: 'Adds file operation tools to Claude Desktop',
  
  // Tools provided by this plugin
  tools: [
    {
      name: "analyze_file",
      description: "Analyze a file in Claude Desktop",
      parameters: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description: "Absolute path to the file to analyze"
          }
        },
        required: ["file_path"]
      },
      handler: async (params) => {
        const { file_path } = params;
        
        // Validate file exists
        if (!fs.existsSync(file_path)) {
          throw new Error(`File not found: ${file_path}`);
        }
        
        try {
          let sessionState = {};
          try {
            if (fs.existsSync(sessionStatePath)) {
              sessionState = JSON.parse(fs.readFileSync(sessionStatePath, 'utf8'));
            }
          } catch (err) {
            console.error('Error reading session state:', err);
          }
          
          // Update the state
          sessionState.pending_actions = sessionState.pending_actions || [];
          sessionState.pending_actions.push({
            id: `action_${Date.now()}`,
            type: "analyze_file",
            params: { file_path },
            timestamp: Date.now(),
            status: "pending"
          });
          
          // Write back the updated state
          fs.writeFileSync(sessionStatePath, JSON.stringify(sessionState, null, 2));
          
          console.log(`Requested to analyze file: ${file_path}`);
          return { 
            success: true, 
            message: `Requested to analyze file: ${file_path}`,
            file_info: {
              size: fs.statSync(file_path).size,
              type: path.extname(file_path).substring(1)
            }
          };
        } catch (err) {
          console.error(`Error requesting file analysis: ${err.message}`);
          throw new Error(`Failed to request file analysis: ${err.message}`);
        }
      }
    },
    
    {
      name: "save_conversation",
      description: "Save the current conversation to a file",
      parameters: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description: "Absolute path where to save the conversation"
          },
          format: {
            type: "string",
            enum: ["markdown", "json", "html", "text"],
            description: "Format to save the conversation in"
          }
        },
        required: ["file_path"]
      },
      handler: async (params) => {
        const { file_path, format = "markdown" } = params;
        
        try {
          let sessionState = {};
          try {
            if (fs.existsSync(sessionStatePath)) {
              sessionState = JSON.parse(fs.readFileSync(sessionStatePath, 'utf8'));
            }
          } catch (err) {
            console.error('Error reading session state:', err);
          }
          
          // Update the state
          sessionState.pending_actions = sessionState.pending_actions || [];
          sessionState.pending_actions.push({
            id: `action_${Date.now()}`,
            type: "save_conversation",
            params: { file_path, format },
            timestamp: Date.now(),
            status: "pending"
          });
          
          // Write back the updated state
          fs.writeFileSync(sessionStatePath, JSON.stringify(sessionState, null, 2));
          
          console.log(`Requested to save conversation to: ${file_path} (${format})`);
          return { 
            success: true, 
            message: `Requested to save conversation to: ${file_path} (${format})`
          };
        } catch (err) {
          console.error(`Error requesting conversation save: ${err.message}`);
          throw new Error(`Failed to request conversation save: ${err.message}`);
        }
      }
    }
  ]
};
