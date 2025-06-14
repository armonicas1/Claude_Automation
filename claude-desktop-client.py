# claude-desktop-client.py
import os
import sys
import json
import asyncio
import time
from pathlib import Path

class ClaudeDesktopClient:
    def __init__(self):
        # Use the actual Claude directory structure
        self.claude_dir = Path(os.path.expanduser('~')) / 'AppData' / 'Roaming' / 'Claude'
        self.pending_actions_file = self.claude_dir / 'pending_actions.json'
        self.bridge_status_file = self.claude_dir / 'bridge_status.json'
        
        # Ensure the files exist
        if not self.pending_actions_file.exists():
            with open(self.pending_actions_file, 'w') as f:
                json.dump({"actions": []}, f)
    
    def check_bridge_status(self):
        """Check if the bridge is running"""
        try:
            if self.bridge_status_file.exists():
                with open(self.bridge_status_file, 'r') as f:
                    status = json.load(f)
                
                # Check if the bridge has updated its status recently (within 30 seconds)
                if time.time() - status.get('timestamp', 0) < 30:
                    return True, status
            
            return False, {"status": "unknown"}
        except Exception as e:
            print(f"Error checking bridge status: {e}")
            return False, {"status": "error", "message": str(e)}
    
    async def add_pending_action(self, action_type, params=None):
        """Add an action to the pending actions queue"""
        try:
            # First check if bridge is running
            bridge_running, status = self.check_bridge_status()
            if not bridge_running:
                print("Warning: Claude Desktop Bridge does not appear to be running.")
                print("Actions may not be processed until the bridge is started.")
            
            # Create the action
            action = {
                "action": action_type,
                "params": params or {},
                "timestamp": time.time(),
                "status": "pending",
                "client": "claude-desktop-client"
            }
            
            # Load existing actions
            with open(self.pending_actions_file, 'r') as f:
                data = json.load(f)
            
            # Add the new action
            data['actions'].append(action)
            
            # Save the updated actions
            with open(self.pending_actions_file, 'w') as f:
                json.dump(data, f, indent=2)
            
            print(f"Action '{action_type}' added to pending actions queue")
            
            # If the bridge is running, we can wait a moment to see if it processes the action
            if bridge_running:
                print("Waiting for bridge to process the action...")
                await asyncio.sleep(2)
                
                # Check if the action was processed
                with open(self.pending_actions_file, 'r') as f:
                    updated_data = json.load(f)
                
                # Find our action by timestamp
                for updated_action in updated_data['actions']:
                    if (updated_action.get('timestamp') == action['timestamp'] and 
                        updated_action.get('action') == action['action']):
                        if updated_action.get('status') != 'pending':
                            print(f"Action processed with status: {updated_action.get('status')}")
                        else:
                            print("Action is still pending.")
                        break
            
            return True
        except Exception as e:
            print(f"Error adding action: {e}")
            return False
    
    async def add_mcp_server(self, name, config, auto_start=False):
        """Add an MCP server configuration"""
        params = {
            "name": name,
            "config": config,
            "autoStart": auto_start
        }
        return await self.add_pending_action("add_mcp_server", params)
    
    async def remove_mcp_server(self, name):
        """Remove an MCP server configuration"""
        params = {
            "name": name
        }
        return await self.add_pending_action("remove_mcp_server", params)
    
    async def switch_model(self, model_name):
        """Switch the default model"""
        params = {
            "model": model_name
        }
        return await self.add_pending_action("switch_model", params)
    
    async def reload_config(self):
        """Request config reload"""
        return await self.add_pending_action("reload_config")
    
    async def restart_claude(self):
        """Request Claude Desktop restart"""
        return await self.add_pending_action("restart_claude")
    
    def print_usage(self):
        """Print usage instructions"""
        print("Claude Desktop Client Usage:")
        print("  add-server <name> <port> <host> [auto]  - Add new MCP server")
        print("  remove-server <name>                   - Remove MCP server")
        print("  switch-model <model_name>              - Switch default model")
        print("  reload                                - Reload configuration")
        print("  restart                               - Restart Claude Desktop")
        print("  status                                - Check bridge status")
        print("")
        print("Examples:")
        print("  python claude-desktop-client.py add-server my-server 4322 localhost auto")
        print("  python claude-desktop-client.py remove-server my-server")
        print("  python claude-desktop-client.py reload")

# Main entry point
async def main():
    client = ClaudeDesktopClient()
    
    if len(sys.argv) < 2:
        client.print_usage()
        return
    
    command = sys.argv[1]
    
    if command == "add-server" and len(sys.argv) >= 4:
        name = sys.argv[2]
        port = int(sys.argv[3])
        host = sys.argv[4] if len(sys.argv) > 4 else "localhost"
        auto_start = len(sys.argv) > 5 and sys.argv[5] == "auto"
        
        config = {
            "external": True,
            "port": port,
            "host": host
        }
        
        await client.add_mcp_server(name, config, auto_start)
    
    elif command == "remove-server" and len(sys.argv) >= 3:
        name = sys.argv[2]
        await client.remove_mcp_server(name)
    
    elif command == "switch-model" and len(sys.argv) >= 3:
        model = sys.argv[2]
        await client.switch_model(model)
    
    elif command == "reload":
        await client.reload_config()
    
    elif command == "restart":
        await client.restart_claude()
    
    elif command == "status":
        running, status = client.check_bridge_status()
        if running:
            print(f"Bridge is running. Status: {status['status']}")
            print(f"Last updated: {time.ctime(status['timestamp'])}")
        else:
            print("Bridge is not running or not responding.")
    
    else:
        client.print_usage()

if __name__ == "__main__":
    asyncio.run(main())
