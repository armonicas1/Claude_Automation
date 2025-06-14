# claude-desktop-bridge.py
import os
import json
import time
import asyncio
import logging
import subprocess
import signal
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(Path.home() / '.claude' / 'bridge.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('ClaudeDesktopBridge')

class ConfigChangeHandler(FileSystemEventHandler):
    def __init__(self, bridge):
        self.bridge = bridge
        self.last_modified = 0
        
    def on_modified(self, event):
        if event.src_path.endswith('pending_actions.json'):
            # Debounce to prevent multiple rapid triggers
            current_time = time.time()
            if current_time - self.last_modified > 1.0:  # 1 second debounce
                self.last_modified = current_time
                asyncio.run(self.bridge.process_pending_actions())

class ClaudeDesktopBridge:
    def __init__(self):
        # Use the actual Claude directory structure
        self.claude_dir = Path(os.path.expanduser('~')) / 'AppData' / 'Roaming' / 'Claude'
        
        # Create directory structure if it doesn't exist
        self.triggers_dir = self.claude_dir / 'desktop_triggers'
        self.triggers_dir.mkdir(exist_ok=True)
        
        self.pending_actions_file = self.claude_dir / 'pending_actions.json'
        if not self.pending_actions_file.exists():
            with open(self.pending_actions_file, 'w') as f:
                json.dump({"actions": []}, f)
        
        self.bridge_status_file = self.claude_dir / 'bridge_status.json'
        self.update_bridge_status('initialized')
        
        # Set up file watcher
        self.observer = Observer()
        self.event_handler = ConfigChangeHandler(self)
        
        logger.info(f"Claude Desktop Bridge initialized. Watching: {self.claude_dir}")
    
    def update_bridge_status(self, status):
        try:
            bridge_status = {
                "status": status,
                "pid": os.getpid(),
                "timestamp": time.time(),
                "host": "localhost"
            }
            with open(self.bridge_status_file, 'w') as f:
                json.dump(bridge_status, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to update bridge status: {e}")
    
    def load_config(self):
        try:
            config_file = self.claude_dir / 'claude_desktop_config.json'
            with open(config_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load config file: {e}")
            return {}
    
    def save_config(self, config):
        try:
            config_file = self.claude_dir / 'claude_desktop_config.json'
            # Create a backup
            backup_file = self.claude_dir / f'claude_desktop_config.backup.{int(time.time())}.json'
            with open(config_file, 'r') as src, open(backup_file, 'w') as dst:
                dst.write(src.read())
            
            # Save the new config
            with open(config_file, 'w') as f:
                json.dump(config, f, indent=2)
            logger.info(f"Config saved successfully. Backup at: {backup_file}")
            return True
        except Exception as e:
            logger.error(f"Failed to save config file: {e}")
            return False
    
    async def add_pending_action(self, action):
        try:
            with open(self.pending_actions_file, 'r') as f:
                data = json.load(f)
            
            # Add the action with a timestamp
            action['timestamp'] = time.time()
            action['status'] = 'pending'
            data['actions'].append(action)
            
            with open(self.pending_actions_file, 'w') as f:
                json.dump(data, f, indent=2)
            
            logger.info(f"Added pending action: {action['action']}")
            return True
        except Exception as e:
            logger.error(f"Failed to add pending action: {e}")
            return False
    
    async def process_pending_actions(self):
        try:
            with open(self.pending_actions_file, 'r') as f:
                data = json.load(f)
            
            # Process each pending action
            processed = []
            for i, action in enumerate(data['actions']):
                if action['status'] == 'pending':
                    success = await self.execute_action(action)
                    if success:
                        action['status'] = 'completed'
                    else:
                        action['status'] = 'failed'
                    processed.append(i)
            
            # Update the file with processed results
            with open(self.pending_actions_file, 'w') as f:
                json.dump(data, f, indent=2)
            
            # Clean up old processed actions (keep last 10)
            if len(processed) > 0:
                self.cleanup_processed_actions()
                
            return len(processed)
        except Exception as e:
            logger.error(f"Failed to process pending actions: {e}")
            return 0
    
    def cleanup_processed_actions(self):
        try:
            with open(self.pending_actions_file, 'r') as f:
                data = json.load(f)
            
            # Keep only pending actions and the last 10 completed/failed ones
            pending = [a for a in data['actions'] if a['status'] == 'pending']
            completed = [a for a in data['actions'] if a['status'] != 'pending']
            completed = sorted(completed, key=lambda x: x['timestamp'], reverse=True)[:10]
            
            data['actions'] = pending + completed
            
            with open(self.pending_actions_file, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to cleanup processed actions: {e}")
    
    async def execute_action(self, action):
        action_type = action.get('action')
        params = action.get('params', {})
        
        logger.info(f"Executing action: {action_type} with params: {params}")
        
        try:
            if action_type == 'add_mcp_server':
                return await self.add_mcp_server(params)
            elif action_type == 'remove_mcp_server':
                return await self.remove_mcp_server(params)
            elif action_type == 'switch_model':
                return await self.switch_model(params)
            elif action_type == 'reload_config':
                return await self.reload_config()
            elif action_type == 'restart_claude':
                return await self.restart_claude()
            else:
                logger.warning(f"Unknown action type: {action_type}")
                return False
        except Exception as e:
            logger.error(f"Failed to execute action {action_type}: {e}")
            return False
    
    async def add_mcp_server(self, params):
        try:
            server_name = params.get('name')
            server_config = params.get('config', {})
            
            if not server_name or not server_config:
                logger.error("Missing server name or configuration")
                return False
            
            config = self.load_config()
            if 'mcpServers' not in config:
                config['mcpServers'] = {}
            
            # Add or update server configuration
            config['mcpServers'][server_name] = server_config
            
            # Auto-start if specified
            if params.get('autoStart', False):
                if 'autoStart' not in config:
                    config['autoStart'] = {'servers': []}
                
                if server_name not in config['autoStart']['servers']:
                    config['autoStart']['servers'].append(server_name)
            
            return self.save_config(config)
        except Exception as e:
            logger.error(f"Failed to add MCP server: {e}")
            return False
    
    async def remove_mcp_server(self, params):
        try:
            server_name = params.get('name')
            
            if not server_name:
                logger.error("Missing server name")
                return False
            
            config = self.load_config()
            if 'mcpServers' in config and server_name in config['mcpServers']:
                del config['mcpServers'][server_name]
                
                # Remove from auto-start if present
                if 'autoStart' in config and 'servers' in config['autoStart']:
                    if server_name in config['autoStart']['servers']:
                        config['autoStart']['servers'].remove(server_name)
                
                return self.save_config(config)
            else:
                logger.warning(f"Server {server_name} not found in config")
                return False
        except Exception as e:
            logger.error(f"Failed to remove MCP server: {e}")
            return False
    
    async def switch_model(self, params):
        # This would require Claude Desktop to have a way to read preferred model settings
        # For now, just log that we received the request
        logger.info(f"Switch model request received: {params}")
        return True
    
    async def reload_config(self):
        # Signal Claude Desktop to reload its configuration
        # This is implementation-dependent on how Claude Desktop handles config changes
        
        # Option 1: Touch a reload signal file
        reload_signal = self.claude_dir / 'reload_config'
        reload_signal.touch(exist_ok=True)
        
        # Option 2: Try to find Claude Desktop process and send a signal
        # This depends on platform and would need customization
        return True
    
    async def restart_claude(self):
        # Find Claude Desktop process and restart it
        # Highly platform-dependent, so just log for now
        logger.info("Restart Claude Desktop request received")
        return True
    
    async def is_claude_desktop_running(self):
        # Platform-specific implementation to check if Claude Desktop is running
        try:
            if os.name == 'nt':  # Windows
                import psutil
                for proc in psutil.process_iter(['pid', 'name']):
                    if 'claude' in proc.info['name'].lower():
                        return True
            else:  # Unix-like
                result = subprocess.run(["pgrep", "-f", "Claude Desktop"], 
                                       capture_output=True, text=True)
                return result.returncode == 0
        except Exception as e:
            logger.error(f"Error checking if Claude Desktop is running: {e}")
        
        return False
    
    async def start(self):
        # Start the file watcher
        self.observer.schedule(self.event_handler, self.claude_dir, recursive=False)
        self.observer.start()
        
        self.update_bridge_status('running')
        logger.info("Claude Desktop Bridge started")
        
        try:
            # Main loop
            while True:
                # Periodically check for pending actions (backup to file watcher)
                await self.process_pending_actions()
                # Update status to show we're still alive
                self.update_bridge_status('running')
                await asyncio.sleep(5)
        except KeyboardInterrupt:
            self.observer.stop()
        
        self.observer.join()
        self.update_bridge_status('stopped')
        logger.info("Claude Desktop Bridge stopped")

# Helper function to create an action file
async def create_action_file(action_type, params):
    bridge = ClaudeDesktopBridge()
    await bridge.add_pending_action({
        "action": action_type,
        "params": params
    })
    print(f"Action '{action_type}' added to pending actions queue")

# Main entry point
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        # Command-line action creation
        if sys.argv[1] == "add-server" and len(sys.argv) >= 4:
            asyncio.run(create_action_file("add_mcp_server", {
                "name": sys.argv[2],
                "config": json.loads(sys.argv[3]),
                "autoStart": True if len(sys.argv) > 4 and sys.argv[4] == "auto" else False
            }))
        elif sys.argv[1] == "remove-server" and len(sys.argv) >= 3:
            asyncio.run(create_action_file("remove_mcp_server", {
                "name": sys.argv[2]
            }))
        elif sys.argv[1] == "reload":
            asyncio.run(create_action_file("reload_config", {}))
        else:
            print("Unknown command or missing arguments")
            print("Usage:")
            print("  add-server <name> '<config_json>' [auto]")
            print("  remove-server <name>")
            print("  reload")
    else:
        # Start the bridge service
        bridge = ClaudeDesktopBridge()
        asyncio.run(bridge.start())
