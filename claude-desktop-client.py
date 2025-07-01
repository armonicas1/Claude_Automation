# claude-desktop-client-v4.py
import os
import json
import asyncio
import time
import uuid
import argparse
from pathlib import Path
from typing import Dict, Any, Tuple, Optional

# Define type aliases for clarity
JsonDict = Dict[str, Any]
ActionParams = Optional[JsonDict]

class ClaudeDesktopClient:
    def __init__(self) -> None:
        # Use environment variables for portability and type safety
        appdata_dir_str = os.getenv('APPDATA')
        if not appdata_dir_str:
            raise EnvironmentError("APPDATA environment variable not set. This script is intended for Windows.")
        
        self.claude_dir: Path = Path(appdata_dir_str) / 'Claude'
        self.bridge_dir: Path = self.claude_dir / 'python-bridge'
        self.pending_dir: Path = self.bridge_dir / 'pending'
        self.completed_dir: Path = self.bridge_dir / 'completed'
        self.failed_dir: Path = self.bridge_dir / 'failed'
        self.bridge_status_file: Path = self.bridge_dir / 'bridge_status.json'
        
        # Ensure directories exist
        for dir_path in [self.bridge_dir, self.pending_dir, self.completed_dir, self.failed_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)

    def check_bridge_status(self) -> Tuple[bool, str]:
        """Check if the bridge is running and responsive."""
        if not self.bridge_status_file.exists():
            return False, "Bridge status file not found."
        
        try:
            with open(self.bridge_status_file, 'r') as f:
                status: JsonDict = json.load(f)
            
            last_heartbeat: float = status.get('timestamp', 0)
            if time.time() - last_heartbeat > 15: # 15-second tolerance
                return False, f"Bridge not responsive. Last heartbeat was {int(time.time() - last_heartbeat)}s ago."

            return True, f"Bridge is {status.get('status', 'unknown')} (PID: {status.get('pid')})."
        except (json.JSONDecodeError, IOError) as e:
            return False, f"Error reading bridge status: {e}"

    async def send_action(self, action_type: str, params: ActionParams = None) -> Optional[JsonDict]:
        """Sends an action by creating a new file in the pending directory."""
        action_id = str(uuid.uuid4())
        action_payload: JsonDict = {
            "id": action_id,
            "action": action_type,
            "params": params or {},
            "timestamp": time.time(),
            "status": "pending",
            "client": "claude-desktop-client-v4"
        }
        
        action_file = self.pending_dir / f"{action_id}.json"

        try:
            with open(action_file, 'w') as f:
                json.dump(action_payload, f, indent=2)
            
            print(f"✅ Action '{action_type}' (ID: {action_id[:8]}) submitted.")
            
            # Wait for conclusive feedback from the bridge
            return await self.wait_for_completion(action_id)
            
        except IOError as e:
            print(f"❌ Error submitting action: {e}")
            return None

    async def wait_for_completion(self, action_id: str, timeout: int = 10) -> Optional[JsonDict]:
        """Waits for an action file to be moved to completed or failed."""
        start_time = time.time()
        completed_file = self.completed_dir / f"{action_id}.json"
        failed_file = self.failed_dir / f"{action_id}.json"

        print("... waiting for bridge to process...")
        while time.time() - start_time < timeout:
            if completed_file.exists():
                try:
                    with open(completed_file, 'r') as f:
                        result: JsonDict = json.load(f)
                    print(f"✔️  SUCCESS: {result.get('result', 'Action completed.')}")
                    return result
                except (IOError, json.JSONDecodeError) as e:
                    print(f"❌ Error reading result file: {e}")
                    return None
            
            if failed_file.exists():
                try:
                    with open(failed_file, 'r') as f:
                        result = json.load(f)
                    print(f"❌ FAILED: {result.get('error', 'Action failed.')}")
                    return result
                except (IOError, json.JSONDecodeError) as e:
                    print(f"❌ Error reading failure file: {e}")
                    return None

            await asyncio.sleep(0.5)
        
        print("⌛️ TIMEOUT: Bridge did not process the action within the timeout period.")
        return None

def main() -> None:
    parser = argparse.ArgumentParser(description="A command-line client to interact with the Claude Desktop Bridge.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Status command
    subparsers.add_parser("status", help="Check the status of the bridge daemon.")

    # Restart command
    subparsers.add_parser("restart", help="Request the bridge to restart the Claude Desktop application.")

    # Add-server command
    add_parser = subparsers.add_parser("add-server", help="Add or update an MCP server configuration.")
    add_parser.add_argument("name", help="A unique name for the server (e.g., 'my-custom-tools').")
    add_parser.add_argument("command", help="The command to execute (e.g., 'node').")
    add_parser.add_argument("script_path", help="The full path to the MCP server script.")

    # Remove-server command
    remove_parser = subparsers.add_parser("remove-server", help="Remove an MCP server configuration.")
    remove_parser.add_argument("name", help="The name of the server to remove.")

    args = parser.parse_args()
    client = ClaudeDesktopClient()
    
    if args.command == "status":
        is_running, message = client.check_bridge_status()
        color_code = "\033[92m" if is_running else "\033[91m"
        print(f"{color_code}{message}\033[0m")
        return

    # Check bridge status for all action commands
    is_running, message = client.check_bridge_status()
    if not is_running:
        print(f"\033[91mWarning: {message}\033[0m")
        if input("Continue anyway? (y/n): ").lower() != 'y':
            return
    
    if args.command == "restart":
        asyncio.run(client.send_action("restart_claude"))
    
    elif args.command == "add-server":
        config: JsonDict = {
            "command": args.command,
            "args": [args.script_path],
            "env": {},
            "disabled": False
        }
        params: JsonDict = {"name": args.name, "config": config}
        asyncio.run(client.send_action("add_mcp_server", params))

    elif args.command == "remove-server":
        params = {"name": args.name}
        asyncio.run(client.send_action("remove_mcp_server", params))

if __name__ == "__main__":
    main()