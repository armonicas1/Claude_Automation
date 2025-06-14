# Claude Desktop Bridge - Installation and Usage Guide

This guide explains how to set up and use the Claude Desktop Bridge system, which enables automation and integration with Claude Desktop.

## Prerequisites

- Python 3.7 or higher
- Claude Desktop installed
- Administrative access (for installing Python packages)

## Installation

1. **Install Required Python Packages**

   Open a command prompt or PowerShell window and navigate to the directory containing the `requirements.txt` file:

   ```powershell
   cd C:\Users\dimas\Desktop
   pip install -r requirements.txt
   ```

2. **Verify Claude Desktop Configuration**

   Ensure that your Claude Desktop configuration is properly set up at:
   
   ```
   %APPDATA%\Claude\claude_desktop_config.json
   ```

## Starting the Bridge

1. **Start the Bridge Service**

   Open a command prompt or PowerShell window and run:

   ```powershell
   python C:\Users\dimas\Desktop\claude-desktop-bridge.py
   ```

   This will start the bridge service, which will monitor for configuration changes and process pending actions.

2. **Verify Bridge Status**

   You can check if the bridge is running by using the client:

   ```powershell
   python C:\Users\dimas\Desktop\claude-desktop-client.py status
   ```

## Using the Client

The client script provides a command-line interface to interact with the bridge.

### Adding an MCP Server

```powershell
python C:\Users\dimas\Desktop\claude-desktop-client.py add-server my-server 4323 localhost auto
```

This adds a new MCP server named "my-server" on port 4323, and configures it to auto-start with Claude Desktop.

### Removing an MCP Server

```powershell
python C:\Users\dimas\Desktop\claude-desktop-client.py remove-server my-server
```

### Reloading Claude Desktop Configuration

```powershell
python C:\Users\dimas\Desktop\claude-desktop-client.py reload
```

### Checking Bridge Status

```powershell
python C:\Users\dimas\Desktop\claude-desktop-client.py status
```

## Running as a Background Service (Windows)

To run the bridge as a background service on Windows:

1. **Create a Batch File**

   Create a file named `start-claude-bridge.bat` with the following content:

   ```batch
   @echo off
   start /min pythonw C:\Users\dimas\Desktop\claude-desktop-bridge.py
   ```

2. **Add to Startup**

   Press `Win+R`, type `shell:startup`, and press Enter.
   Copy the batch file to this folder to run the bridge at system startup.

## Troubleshooting

1. **Bridge Not Running**

   - Ensure Python and required packages are installed
   - Check for errors in the log file at `%APPDATA%\Claude\bridge.log`
   - Verify that the bridge process is not already running

2. **Actions Not Processing**

   - Ensure Claude Desktop is running
   - Check bridge status using the client
   - Verify that the `pending_actions.json` file exists
   - Restart the bridge service

3. **Permission Errors**

   - Ensure you have write permissions to the Claude directory
   - Run the bridge with administrator privileges if necessary

## Limitations

- The bridge can only modify configuration files, not control Claude Desktop directly
- Some actions may require Claude Desktop to be restarted
- There is no authentication between client and bridge
- This is an unofficial extension and may break with Claude Desktop updates
