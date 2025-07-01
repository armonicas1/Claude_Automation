# claude-desktop-bridge-v4.py
import os
import json
import time
import asyncio
import logging
import psutil
import signal
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileSystemEvent, FileCreatedEvent
from typing import Dict, Any, Tuple, Callable

# --- Type Aliases for Readability ---
JsonDict = Dict[str, Any]
# Defines a function that takes two dicts and returns a tuple of a dict and a string
ConfigModifierFunc = Callable[[JsonDict, JsonDict], Tuple[JsonDict, str]]


# --- Global Constants and Setup ---
appdata_dir_str = os.getenv('APPDATA')
if not appdata_dir_str:
    raise EnvironmentError("APPDATA environment variable not set. This script is intended for Windows.")

CLAUDE_DIR: Path = Path(appdata_dir_str) / 'Claude'
BRIDGE_DIR: Path = CLAUDE_DIR / 'python-bridge'
PENDING_DIR: Path = BRIDGE_DIR / 'pending'
COMPLETED_DIR: Path = BRIDGE_DIR / 'completed'
FAILED_DIR: Path = BRIDGE_DIR / 'failed'
LOG_FILE: Path = BRIDGE_DIR / 'bridge.log'

# Ensure all directories exist
for dir_path in [BRIDGE_DIR, PENDING_DIR, COMPLETED_DIR, FAILED_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.FileHandler(LOG_FILE), logging.StreamHandler()]
)
logger = logging.getLogger('ClaudeBridgeV4')


class ActionHandler(FileSystemEventHandler):
    def __init__(self, bridge: 'ClaudeDesktopBridge') -> None:
        self.bridge = bridge

    def on_created(self, event: FileSystemEvent) -> None:
        # The event handler must use the base FileSystemEvent type to be compatible.
        # We then check if it's the specific type we care about.
        if isinstance(event, FileCreatedEvent) and event.src_path.endswith('.json'):
            logger.info(f"New action file detected: {event.src_path}")
            # Schedule the processing in the bridge's async loop
            asyncio.run_coroutine_threadsafe(
                self.bridge.process_action_file(Path(event.src_path)),
                self.bridge.loop
            )

class ClaudeDesktopBridge:
    def __init__(self, loop: asyncio.AbstractEventLoop) -> None:
        self.loop = loop
        local_appdata_str = os.getenv('LOCALAPPDATA')
        if not local_appdata_str:
            raise EnvironmentError("LOCALAPPDATA environment variable not set.")
        self.claude_exe_path: Path = Path(local_appdata_str) / 'Claude' / 'Claude.exe'
        self.observer = Observer()
        self.event_handler = ActionHandler(self)

    def update_bridge_status(self, status_text: str) -> None:
        """Writes the current status of the bridge to a file."""
        try:
            status_file = BRIDGE_DIR / 'bridge_status.json'
            status_payload: JsonDict = {
                "status": status_text,
                "pid": os.getpid(),
                "timestamp": time.time(),
            }
            with open(status_file, 'w') as f:
                json.dump(status_payload, f, indent=2)
        except IOError as e:
            logger.error(f"Failed to update bridge status: {e}")

    async def process_action_file(self, file_path: Path) -> None:
        """Loads, processes, and moves a single action file atomically."""
        logger.info(f"Processing {file_path.name}...")
        action: JsonDict = {"id": file_path.stem} # Default in case of read failure
        try:
            with open(file_path, 'r') as f:
                action = json.load(f)
            
            result = await self.execute_action(action)
            
            action['status'] = 'completed'
            action['result'] = result
            destination = COMPLETED_DIR / file_path.name
        except Exception as e:
            logger.error(f"Error processing action {file_path.name}: {e}")
            action['status'] = 'failed'
            action['error'] = str(e)
            destination = FAILED_DIR / file_path.name
        
        try:
            # Write results back before moving
            with open(file_path, 'w') as f:
                json.dump(action, f, indent=2)
            # Atomic move operation
            file_path.rename(destination)
            logger.info(f"Moved {file_path.name} to {destination.parent.name} directory.")
        except (IOError, OSError) as e:
            logger.error(f"Failed to move processed file {file_path.name}: {e}")

    async def execute_action(self, action: JsonDict) -> Any:
        """Routes and executes a specific action."""
        action_type: str = action.get('action', 'unknown')
        params: JsonDict = action.get('params', {})
        logger.info(f"Executing action: {action_type}")

        if action_type == 'add_mcp_server':
            return self._config_modifier(self._add_mcp_server, params)
        elif action_type == 'remove_mcp_server':
            return self._config_modifier(self._remove_mcp_server, params)
        elif action_type == 'restart_claude':
            return await self._restart_claude()
        else:
            raise ValueError(f"Unknown action type: {action_type}")

    def _config_modifier(self, func: ConfigModifierFunc, params: JsonDict) -> str:
        """Safely loads, modifies, and saves the Claude config."""
        config_file = CLAUDE_DIR / 'claude_desktop_config.json'
        if not config_file.exists():
            raise FileNotFoundError("claude_desktop_config.json not found.")

        with open(config_file, 'r') as f:
            config: JsonDict = json.load(f)
        
        # Make a backup
        backup_file = CLAUDE_DIR / f'config_backup_{int(time.time())}.json'
        with open(backup_file, 'w') as f:
            json.dump(config, f, indent=2)
        
        # Apply the modification function
        modified_config, message = func(config, params)

        with open(config_file, 'w') as f:
            json.dump(modified_config, f, indent=2)

        logger.info(f"Config updated: {message}. Backup created at {backup_file.name}")
        return message

    def _add_mcp_server(self, config: JsonDict, params: JsonDict) -> Tuple[JsonDict, str]:
        server_name = params.get('name')
        server_config = params.get('config')
        if not isinstance(server_name, str) or not isinstance(server_config, dict):
            raise ValueError("Missing or invalid 'name' or 'config' for add_mcp_server.")
        
        config.setdefault('mcpServers', {})[server_name] = server_config
        return config, f"Server '{server_name}' added/updated."

    def _remove_mcp_server(self, config: JsonDict, params: JsonDict) -> Tuple[JsonDict, str]:
        server_name = params.get('name')
        if not isinstance(server_name, str):
            raise ValueError("Missing or invalid 'name' for remove_mcp_server.")
        
        if config.get('mcpServers', {}).pop(server_name, None):
            return config, f"Server '{server_name}' removed."
        else:
            return config, f"Server '{server_name}' not found."

    async def _restart_claude(self) -> str:
        """Finds and restarts the Claude.exe process."""
        logger.info("Attempting to restart Claude Desktop...")
        found_procs: list[psutil.Process] = []
        for proc in psutil.process_iter(['pid', 'name', 'exe']):  # type: ignore[misc]
            try:
                # Use psutil.Process methods for type safety
                p = psutil.Process(proc.pid)
                if p.name() == 'Claude.exe' and p.exe() and self.claude_exe_path.samefile(p.exe()):
                    found_procs.append(p)
            except (psutil.NoSuchProcess, psutil.AccessDenied, FileNotFoundError):
                continue
        
        if not found_procs:
            logger.warning("Claude.exe process not found. Starting a new instance.")
        else:
            for proc in found_procs:
                logger.info(f"Terminating existing Claude.exe process (PID: {proc.pid})...")
                proc.terminate()
            
            _, alive = psutil.wait_procs(found_procs, timeout=5)
            for p in alive:
                logger.warning(f"Process {p.pid} did not terminate gracefully. Killing.")
                p.kill()

        await asyncio.sleep(2) # Give OS time to release resources
        logger.info("Starting new Claude.exe instance...")
        psutil.Popen([str(self.claude_exe_path)])
        return "Claude Desktop restart sequence initiated."
    
    async def start(self) -> None:
        """Starts the bridge service and its file watcher."""
        # Initial check for any leftover pending files
        for f in PENDING_DIR.glob('*.json'):
            await self.process_action_file(f)

        self.observer.schedule(self.event_handler, str(PENDING_DIR), recursive=False)  # type: ignore[misc]
        self.observer.start()
        self.update_bridge_status('running')
        logger.info("Python Bridge started. Watching for actions.")
        
        try:
            while self.loop.is_running():
                self.update_bridge_status('running')
                await asyncio.sleep(5) # Main heartbeat loop
        finally:
            self.observer.stop()
            self.observer.join()
            self.update_bridge_status('stopped')
            logger.info("Python Bridge stopped.")

def main_service() -> None:
    """Configures and runs the main asyncio event loop for the bridge."""
    loop = asyncio.get_event_loop()
    bridge = ClaudeDesktopBridge(loop)
    
    def shutdown(sig: signal.Signals) -> None:
        logger.info(f"Received shutdown signal: {sig.name}. Shutting down.")
        # Gracefully stop all running async tasks
        for task in asyncio.all_tasks(loop=loop):
            task.cancel()
        
        # The finally block in bridge.start() will handle watchdog cleanup
        if loop.is_running():
            loop.stop()

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, shutdown, sig)
        
    try:
        loop.run_until_complete(bridge.start())
    except asyncio.CancelledError:
        pass # Expected on shutdown
    finally:
        if not loop.is_closed():
            loop.close()
            logger.info("Event loop closed.")

if __name__ == "__main__":
    logger.info("--- Starting Claude Desktop Python Bridge ---")
    main_service()