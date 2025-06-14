// session-manager.js
// Utility for managing Claude sessions across Code and Desktop

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

// Claude directories and files
const claudeDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Claude');
const sessionsFilePath = path.join(claudeDir, 'authenticated_sessions.json');

// Ensure Claude directory exists
if (!fs.existsSync(claudeDir)) {
  fs.mkdirSync(claudeDir, { recursive: true });
}

// Ensure sessions file exists
if (!fs.existsSync(sessionsFilePath)) {
  fs.writeFileSync(sessionsFilePath, JSON.stringify({ sessions: {} }));
}

/**
 * Generate a new session token
 * @param {string} sessionId - The Claude session ID
 * @param {string} source - The source of the session (code, desktop)
 * @returns {object} Session information including token
 */
function createSession(sessionId, source) {
  try {
    // Generate a secure random token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Set expiration (24 hours from now)
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000);
    
    // Load existing sessions
    const sessionsData = JSON.parse(fs.readFileSync(sessionsFilePath, 'utf8'));
    
    // Add the new session
    sessionsData.sessions[sessionId] = {
      token,
      source,
      created_at: Date.now(),
      expires: expiresAt
    };
    
    // Save updated sessions
    fs.writeFileSync(sessionsFilePath, JSON.stringify(sessionsData, null, 2));
    
    return {
      session_id: sessionId,
      token,
      expires: expiresAt
    };
  } catch (err) {
    console.error(`Error creating session: ${err.message}`);
    throw new Error(`Failed to create session: ${err.message}`);
  }
}

/**
 * Verify a session token is valid
 * @param {string} sessionId - The Claude session ID
 * @param {string} token - The session token to verify
 * @returns {boolean} Whether the token is valid
 */
function verifySession(sessionId, token) {
  try {
    // Load sessions
    const sessionsData = JSON.parse(fs.readFileSync(sessionsFilePath, 'utf8'));
    
    // Check if session exists
    const session = sessionsData.sessions[sessionId];
    if (!session) {
      return false;
    }
    
    // Verify token matches and hasn't expired
    return session.token === token && session.expires > Date.now();
  } catch (err) {
    console.error(`Error verifying session: ${err.message}`);
    return false;
  }
}

/**
 * Get a session by ID
 * @param {string} sessionId - The Claude session ID
 * @returns {object|null} The session data or null if not found
 */
function getSession(sessionId) {
  try {
    // Load sessions
    const sessionsData = JSON.parse(fs.readFileSync(sessionsFilePath, 'utf8'));
    
    // Return the session if it exists
    return sessionsData.sessions[sessionId] || null;
  } catch (err) {
    console.error(`Error getting session: ${err.message}`);
    return null;
  }
}

/**
 * Clean up expired sessions
 */
function cleanupSessions() {
  try {
    // Load sessions
    const sessionsData = JSON.parse(fs.readFileSync(sessionsFilePath, 'utf8'));
    
    // Filter out expired sessions
    const now = Date.now();
    Object.keys(sessionsData.sessions).forEach(sessionId => {
      if (sessionsData.sessions[sessionId].expires < now) {
        delete sessionsData.sessions[sessionId];
      }
    });
    
    // Save updated sessions
    fs.writeFileSync(sessionsFilePath, JSON.stringify(sessionsData, null, 2));
  } catch (err) {
    console.error(`Error cleaning up sessions: ${err.message}`);
  }
}

// Clean up expired sessions on startup
cleanupSessions();

// Schedule periodic cleanup (every hour)
setInterval(cleanupSessions, 60 * 60 * 1000);

export default {
  createSession,
  verifySession,
  getSession
};
