// code-to-desktop-plugin.js
// Plugin that enables triggering Claude Desktop from Claude Code

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

// Claude directories and files
const claudeDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Claude');
const sessionStatePath = path.join(claudeDir, 'session_state.json');
const triggerDirPath = path.join(claudeDir, 'code_triggers');

// Ensure the trigger directory exists
if (!fs.existsSync(triggerDirPath)) {
  fs.mkdirSync(triggerDirPath, { recursive: true });
}

// Session verification helper
function verifySessionToken(token, sessionId) {
  try {
    // Load stored sessions data from a secure location
    const sessionsPath = path.join(claudeDir, 'authenticated_sessions.json');
    
    if (!fs.existsSync(sessionsPath)) {
      fs.writeFileSync(sessionsPath, JSON.stringify({ sessions: {} }));
      return false;
    }
    
    const sessionsData = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
    const session = sessionsData.sessions[sessionId];
    
    if (!session) {
      return false;
    }
    
    // Verify the token matches and hasn't expired
    return session.token === token && session.expires > Date.now();
  } catch (err) {
    console.error(`Error verifying session: ${err.message}`);
    return false;
  }
}

// Plugin definition
export default {
  name: 'code-to-desktop-bridge',
  version: '1.0.0',
  description: 'Enables triggering Claude Desktop from Claude Code',
  
  // Initialization function - called when the plugin is loaded
  initialize: async () => {
    // Create a watcher for the trigger directory
    console.log(`Watching for Claude Code triggers in: ${triggerDirPath}`);
    
    // The actual watching is handled by the bridge process
    // This initialization is for any plugin-specific setup
    
    // Record that this plugin is active in the session state
    try {
      let sessionState = {};
      if (fs.existsSync(sessionStatePath)) {
        sessionState = JSON.parse(fs.readFileSync(sessionStatePath, 'utf8'));
      }
      
      sessionState.plugins = sessionState.plugins || {};
      sessionState.plugins.code_to_desktop = {
        active: true,
        initialized_at: Date.now()
      };
      
      fs.writeFileSync(sessionStatePath, JSON.stringify(sessionState, null, 2));
    } catch (err) {
      console.error(`Error initializing plugin state: ${err.message}`);
    }
  },
  
  // Tools provided by this plugin
  tools: [
    {
      name: "execute_from_code",
      description: "Execute an action in Claude Desktop triggered from Claude Code",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            description: "The action to execute in Claude Desktop"
          },
          params: {
            type: "object",
            description: "Parameters for the action"
          },
          session_id: {
            type: "string",
            description: "The Claude session ID for verification"
          },
          session_token: {
            type: "string",
            description: "The Claude session token for verification"
          }
        },
        required: ["action", "session_id", "session_token"]
      },
      handler: async (params) => {
        const { action, params: actionParams, session_id, session_token } = params;
        
        // Verify the session is legitimate
        if (!verifySessionToken(session_token, session_id)) {
          throw new Error("Session verification failed. Cannot execute action.");
        }
        
        try {
          // Create a secure trigger file with a unique ID
          const triggerId = crypto.randomUUID();
          const triggerPath = path.join(triggerDirPath, `${triggerId}.json`);
          
          // Create the trigger content
          const triggerContent = {
            id: triggerId,
            action,
            params: actionParams || {},
            source: "claude_code",
            timestamp: Date.now(),
            session_id,
            status: "pending"
          };
          
          // Write the trigger file
          fs.writeFileSync(triggerPath, JSON.stringify(triggerContent, null, 2));
          
          console.log(`Created code trigger: ${action} (ID: ${triggerId})`);
          
          // Update session state to indicate a pending trigger
          let sessionState = {};
          if (fs.existsSync(sessionStatePath)) {
            sessionState = JSON.parse(fs.readFileSync(sessionStatePath, 'utf8'));
          }
          
          sessionState.pending_code_triggers = sessionState.pending_code_triggers || [];
          sessionState.pending_code_triggers.push({
            id: triggerId,
            action,
            timestamp: Date.now()
          });
          
          fs.writeFileSync(sessionStatePath, JSON.stringify(sessionState, null, 2));
          
          return { 
            success: true, 
            message: `Action '${action}' triggered for Claude Desktop`,
            trigger_id: triggerId
          };
        } catch (err) {
          console.error(`Error creating code trigger: ${err.message}`);
          throw new Error(`Failed to trigger action: ${err.message}`);
        }
      }
    },
    
    {
      name: "check_trigger_status",
      description: "Check the status of a previously triggered action",
      parameters: {
        type: "object",
        properties: {
          trigger_id: {
            type: "string",
            description: "The ID of the trigger to check"
          },
          session_id: {
            type: "string",
            description: "The Claude session ID for verification"
          },
          session_token: {
            type: "string",
            description: "The Claude session token for verification"
          }
        },
        required: ["trigger_id", "session_id", "session_token"]
      },
      handler: async (params) => {
        const { trigger_id, session_id, session_token } = params;
        
        // Verify the session is legitimate
        if (!verifySessionToken(session_token, session_id)) {
          throw new Error("Session verification failed. Cannot check trigger status.");
        }
        
        try {
          // Check if the trigger file still exists (if not, it was processed)
          const triggerPath = path.join(triggerDirPath, `${trigger_id}.json`);
          
          if (fs.existsSync(triggerPath)) {
            // Read the trigger to get its current status
            const triggerData = JSON.parse(fs.readFileSync(triggerPath, 'utf8'));
            return {
              status: triggerData.status || "pending",
              details: triggerData
            };
          }
          
          // Check session state for completed triggers
          let sessionState = {};
          if (fs.existsSync(sessionStatePath)) {
            sessionState = JSON.parse(fs.readFileSync(sessionStatePath, 'utf8'));
          }
          
          const completedTriggers = sessionState.completed_code_triggers || [];
          const trigger = completedTriggers.find(t => t.id === trigger_id);
          
          if (trigger) {
            return {
              status: "completed",
              details: trigger
            };
          }
          
          return {
            status: "unknown",
            message: "Trigger not found. It may have been processed and removed."
          };
        } catch (err) {
          console.error(`Error checking trigger status: ${err.message}`);
          throw new Error(`Failed to check trigger status: ${err.message}`);
        }
      }
    }
  ]
};
