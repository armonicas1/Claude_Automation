const fs = require('fs');
const path = require('path');
const util = require('util');
const os = require('os');

// Determine the appropriate log directory
const APP_DATA = process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.local', 'share'));
const LOG_DIR = path.join(APP_DATA, 'Claude', 'logs');
const PROJECT_LOG_DIR = path.join(process.cwd(), 'logs');

// Ensure log directories exist
[LOG_DIR, PROJECT_LOG_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        try {
            fs.mkdirSync(dir, { recursive: true });
        } catch (error) {
            console.error(`Failed to create log directory at ${dir}:`, error);
        }
    }
});

// Define the unified log file path
const UNIFIED_LOG = path.join(PROJECT_LOG_DIR, 'unified-monitoring.log');
const SYSTEM_EVENT_LOG = path.join(LOG_DIR, 'system-events.log');

// Create writable streams with append mode
const unifiedLogStream = fs.createWriteStream(UNIFIED_LOG, { flags: 'a' });
const systemEventStream = fs.createWriteStream(SYSTEM_EVENT_LOG, { flags: 'a' });

/**
 * Logs an event to both the unified log and the system event log
 * @param {string} source - The component logging the event (e.g., 'MCP_SERVER', 'BRIDGE', 'TOOL_DEBUGGER')
 * @param {string} event - A short description of the event (e.g., 'TOOL_CALL_RECEIVED')
 * @param {object} data - A JSON-serializable object with event details
 * @param {boolean} unifiedOnly - If true, only logs to the unified log (not to system events)
 */
function logEvent(source, event, data = {}, unifiedOnly = false) {
    const timestamp = new Date().toISOString();
    
    // Add process info to help track which component generated this log
    const processInfo = {
        pid: process.pid,
        ppid: process.ppid,
    };
    
    // Add port information if available in the data
    const portInfo = data.port ? { port: data.port } : {};
    
    // Create the full log entry
    const logEntry = {
        timestamp,
        source,
        event,
        process: processInfo,
        ...portInfo,
        data
    };
    
    try {
        // Format for unified log (includes source in the message line)
        const unifiedLine = `[${timestamp}] [${source}] [${event}] ${JSON.stringify(logEntry, null, 2)}`;
        unifiedLogStream.write(unifiedLine + '\n');
        
        // Also write to system events log unless unifiedOnly is true
        if (!unifiedOnly) {
            const systemEventLine = JSON.stringify(logEntry) + '\n';
            systemEventStream.write(systemEventLine);
        }

        // Console output for debugging
        console.log(`[${timestamp}] [${source}] [${event}]`, util.inspect(data, { depth: null, colors: true }));
    } catch (error) {
        console.error('Error logging event:', error);
        unifiedLogStream.write(`[${timestamp}] [ERROR] Error logging event: ${error.message}\n`);
    }
}

/**
 * Logs system monitoring information at regular intervals
 * @param {string} source - The monitoring component (e.g., 'SYSTEM_MONITOR', 'BRIDGE_MONITOR')
 * @param {function} dataCollector - Function that returns monitoring data
 * @param {number} interval - Interval in milliseconds between log entries
 */
function setupPeriodicMonitoring(source, dataCollector, interval = 5000) {
    setInterval(async () => {
        try {
            const monitorData = await dataCollector();
            logEvent(source, 'PERIODIC_UPDATE', monitorData, true);
        } catch (error) {
            console.error(`Error in periodic monitoring for ${source}:`, error);
        }
    }, interval);
}

/**
 * Logs a tool call with detailed information
 * @param {string} toolName - Name of the tool being called
 * @param {object} request - The request parameters
 * @param {string} [requestId] - Optional request ID
 */
function logToolCall(toolName, request, requestId = null) {
    logEvent('TOOL_CALL', 'EXECUTION_STARTED', {
        tool: toolName,
        requestId,
        request,
        timestamp_start: Date.now()
    });
}

/**
 * Logs a tool call result
 * @param {string} toolName - Name of the tool that was called
 * @param {object} result - The result returned by the tool
 * @param {string} [requestId] - Optional request ID
 * @param {Error} [error] - Optional error if the tool call failed
 */
function logToolResult(toolName, result, requestId = null, error = null) {
    logEvent('TOOL_CALL', 'EXECUTION_COMPLETED', {
        tool: toolName,
        requestId,
        result,
        error: error ? error.message : null,
        success: !error,
        timestamp_end: Date.now()
    });
}

/**
 * Logs bridge communication activity
 * @param {string} direction - Either 'REQUEST' or 'RESPONSE'
 * @param {string} filePath - The file path of the request/response
 * @param {object} content - The content of the request/response
 */
function logBridgeActivity(direction, filePath, content) {
    logEvent('BRIDGE', `${direction}_FILE_PROCESSED`, {
        file: path.basename(filePath),
        path: filePath,
        content
    });
}

/**
 * Creates a reader for the unified log that can be used for real-time monitoring
 * @param {number} maxLines - Maximum number of lines to return
 * @returns {Function} A function that returns the latest log entries
 */
function createUnifiedLogReader(maxLines = 100) {
    return function getLatestLogs() {
        try {
            if (fs.existsSync(UNIFIED_LOG)) {
                const content = fs.readFileSync(UNIFIED_LOG, 'utf8');
                return content.trim().split('\n').slice(-maxLines);
            }
        } catch (error) {
            console.error('Error reading unified log:', error);
        }
        return [];
    };
}

/**
 * Safely close log streams when the process exits
 */
function closeLogStreams() {
    unifiedLogStream.end();
    systemEventStream.end();
}

// Register cleanup handler
process.on('exit', closeLogStreams);
process.on('SIGINT', () => {
    closeLogStreams();
    process.exit(0);
});

module.exports = {
    logEvent,
    logToolCall,
    logToolResult,
    logBridgeActivity,
    setupPeriodicMonitoring,
    createUnifiedLogReader,
    UNIFIED_LOG,
    SYSTEM_EVENT_LOG
};
