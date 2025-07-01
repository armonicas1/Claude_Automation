

The monitoring scripts I inherited had several foundational issues that went beyond simple bugs:

1.  **Critical Parser Errors:** The most significant problem was that key scripts like `claude-system-monitor.ps1` were unusable due to fundamental PowerShell syntax errors, including mismatched braces (`{}`), unterminated strings, and invalid `try`/`catch` blocks. Simple patching was insufficient.
2.  **Character Encoding Problems:** The presence of garbled characters (`â”œâ”€`) indicated that files were saved with incorrect encoding, making them unreliable and prone to breaking in different terminal environments.
3.  **Invalid Variable Syntax:** A recurring issue in multiple scripts was the use of `"$Variable: "`, which is invalid syntax in PowerShell. This required fixing with the correct `"$($Variable) : "` or `${Variable}` syntax.
4.  **Lack of Real-time Insight:** The biggest conceptual issue was that the system was designed for static snapshots. The `tool-call-debugger.ps1` script could only test a tool or show a log file; it couldn't provide a live, intuitive view of the communication happening between Claude Desktop and the MCP server.

This led to a necessary shift in approach: instead of continuing to patch broken and limited scripts, I performed a **complete rewrite of the core monitoring tools** (`claude-system-monitor.ps1` and especially `tool-call-debugger.ps1`) to be stable, reliable, and provide the real-time, conclusive feedback you needed.

---

### Summary of New Changes and Enhanced Features

The monitoring system has been transformed from a set of static checkers into a dynamic, interactive debugging suite.

#### 1. `tool-call-debugger.ps1` - **The Flagship Upgrade**

This script underwent the most significant evolution.

*   **Before:** A simple command-line tool that could either display a log file (`-Live`) or send a single, one-off test request (`-TestTool`). It provided no context or correlation between system health and tool call events.
*   **After:** A **full-screen, interactive, real-time dashboard** that provides end-to-end visibility.
    *   **Live Health Panel:** The top of the dashboard constantly displays the live status (Running/Not Running) and Process ID (PID) of the MCP Server and Bridge processes, along with the listening status of the critical Port 4323.
    *   **Live Tool Call Analysis Panel:** This is the most critical new feature. It focuses exclusively on the **most recent tool call** and displays its entire lifecycle:
        *   **The Request:** Shows the exact tool name and the JSON parameters sent to it.
        *   **The Status:** Updates in real-time from "Executing..." to "Success" or "Failed".
        *   **The Conclusive Result:** Displays the full JSON response on success or the full JSON error object on failure.
    *   **Intelligent Log Parsing:** The live event log no longer just prints lines. It actively parses each line for JSON-RPC traffic, identifying tool call requests and correlating them with their responses by ID. This is what powers the analysis panel.

#### 2. `claude-system-monitor.ps1`

This script was completely rewritten from a broken state to be a stable and reliable system-wide dashboard.

*   **Before:** Unusable due to critical syntax and encoding errors.
*   **After:** A robust, clean, and functional script.
    *   **Guaranteed Stability:** The rewrite eliminated all parser errors.
    *   **Clean & Portable UI:** All broken Unicode characters were replaced with standard ASCII characters (`-`, `+`, `|`) for perfect display in any terminal.
    *   **Code Quality:** Best practices were implemented, such as using approved PowerShell verbs (`Invoke-Monitor` instead of `Run-Monitor`) and structuring checks into clear, dedicated functions (`Get-ProcessStatus`, `Get-PortStatus`, etc.).

#### 3. `bridge-monitor.ps1` & `claude-master-control.ps1`

These scripts received targeted quality-of-life and reliability fixes.

*   **Before:** Contained minor bugs, stylistic inconsistencies, and hardcoded paths.
*   **After:**
    *   **Code Best Practices:** Corrected the `$null` comparison syntax in `claude-master-control.ps1` to prevent potential bugs.
    *   **Dynamic Paths:** Where applicable, hardcoded user paths were replaced to improve portability.
    *   **Reliability:** Unused variables and minor logic flaws were cleaned up to ensure the scripts run predictably.

---

Here is the updated documentation that reflects the new, vastly more powerful monitoring system.

### `MONITORING_SCRIPTS_V2.md`

This document provides information about the enhanced monitoring scripts for the Claude Automation project.

## Overview

The monitoring system has been upgraded to a suite of interactive and real-time debugging tools. It helps you conclusively identify issues by providing end-to-end visibility into the entire tool call lifecycle.

1.  **`tool-call-debugger.ps1` (V2.0):** An interactive, real-time dashboard that live-parses MCP server communication and provides a conclusive breakdown of every tool request and response. **This is the primary tool for debugging silent failures.**
2.  **`claude-system-monitor.ps1` (V2.0):** A stable, rewritten system dashboard for a high-level overview of all related processes, ports, and file system components.
3.  **`bridge-monitor.ps1`:** A focused utility for monitoring the file-based communication bridge between Windows and WSL.
4.  **`claude-master-control.ps1`:** The master script for starting, stopping, and managing all services, now with improved reliability.

## Summary of Key Enhancements

*   **Live Interactive Tool-Call Dashboard:** The `tool-call-debugger.ps1` script now provides a conclusive, real-time view of JSON-RPC requests and responses, Process IDs, and port status in a single dashboard.
*   **Complete Code Rewrite:** The `claude-system-monitor.ps1` and `tool-call-debugger.ps1` scripts were completely rewritten from scratch to eliminate critical parser errors, encoding issues, and add significant new functionality.
*   **Enhanced Stability & Reliability:** All scripts have been reviewed and fixed to adhere to PowerShell best practices, ensuring they run correctly and predictably.
*   **Clean, Portable UI:** All non-standard Unicode characters have been removed from dashboards, guaranteeing a clean display in any terminal environment.

## Usage

### Tool Call Debugger (Recommended Tool)

```powershell
# Run the live, interactive dashboard. This is the best way to see what's happening.
.\scripts\tool-call-debugger.ps1 -Live

# Send a single test request for 'open_conversation' and exit.
.\scripts\tool-call-debugger.ps1 -TestTool
```

### System Monitor

```powershell
# Show a one-time overview of the entire system.
.\scripts\claude-system-monitor.ps1

# Run the overview dashboard in a continuously updating loop.
.\scripts\claude-system-monitor.ps1 -Continuous
```

### Bridge Monitor

```powershell
# Continuously monitor the file-based bridge directories for activity.
.\scripts\bridge-monitor.ps1 -Continuous

# Create a test file in the trigger directory to test the bridge.
.\scripts\bridge-monitor.ps1 -CreateTestTrigger
```

### Master Control

```powershell
# Start all services (Claude, Bridge, etc.) with admin privileges.
.\claude-master-control.ps1 -Action start -AdminMode

# Stop all related services.
.\claude-master-control.ps1 -Action stop

# Launch all monitoring tools in separate debug windows.
.\claude-master-control.ps1 -Action debug
```

## Recent Additions (2025)

### User-Friendly Launcher

A new batch file launcher has been added to provide a simple, menu-driven interface to all monitoring tools:

```batch
# Run the menu-driven launcher for all monitoring tools
.\monitoring-tools.bat
```

The `monitoring-tools.bat` script provides the following features:
* Simple numbered options for each monitoring tool
* Launches each monitor in its own titled console window
* Sets optimal parameters for each tool (e.g., `-Live` for tool debugger)
* Properly handles scripts that require administrative privileges

### Professional Script Validator

A new script validator has been added to ensure all PowerShell scripts are free of syntax errors:

```powershell
# Check all PowerShell scripts for syntax errors
.\scripts\validate-scripts.ps1
```

The `validate-scripts.ps1` script provides the following features:
* Uses the official PowerShell language parser for 100% accurate validation
* Shows the exact line and nature of any syntax error
* Checks all critical PowerShell scripts in the project