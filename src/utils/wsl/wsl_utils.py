"""
WSL utilities for interacting with WSL from Windows Python applications.
Provides functions for running commands, checking process existence, 
and handling file paths between Windows and WSL environments.
"""

import sys
import subprocess
import logging
import re
from typing import Dict, List, Optional, TypedDict, Protocol, Generic, TypeVar

# Define type for CompletedProcess
T = TypeVar('T', bound=str)

class CompletedProcessProtocol(Protocol, Generic[T]):
    returncode: int
    stdout: T
    stderr: T

# Use our properly typed CompletedProcess alias
CompletedProcessText = subprocess.CompletedProcess[str]

# --- Module Setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

if sys.platform != 'win32':
    raise ImportError("wsl_utils can only be imported and used on Windows.")

# --- Custom Exception and Type Definitions ---
class WSLException(Exception):
    """Custom exception for WSL-related operational errors."""
    pass

class DistributionInfo(TypedDict):
    """Type definition for WSL distribution information."""
    name: str
    state: str
    version: str
    is_default: bool

# --- Core Command Execution ---
def _run_wsl_command(command_args: List[str]) -> CompletedProcessText:
    """Internal helper to run a wsl.exe command and handle common errors."""
    try:
        full_command = ['wsl.exe'] + command_args
        logger.debug(f"Executing command: {' '.join(full_command)}")
        result = subprocess.run(full_command, capture_output=True, text=True, check=False, encoding='utf-8')
        if result.returncode != 0:
            logger.warning(f"WSL command failed with code {result.returncode}. Stderr: {result.stderr.strip()}")
        return result
    except FileNotFoundError:
        msg = "`wsl.exe` not found. Is WSL installed and in your system's PATH?"
        logger.error(msg)
        raise WSLException(msg) from None

def run_command(command: List[str], distribution: Optional[str] = None) -> CompletedProcessText:
    """Runs a command safely in WSL by accepting a list of arguments."""
    wsl_args: List[str] = []
    if distribution:
        wsl_args.extend(['--distribution', distribution])
    wsl_args.extend(['--'] + command)
    return _run_wsl_command(wsl_args)

# --- Distribution Management ---
def list_distributions() -> List[DistributionInfo]:
    """Lists all installed WSL distributions with robust parsing."""
    result = _run_wsl_command(['--list', '--verbose'])
    if result.returncode != 0: return []
    lines = result.stdout.strip().splitlines()
    if len(lines) <= 1: return []
    distributions: List[DistributionInfo] = []
    for line in lines[1:]:
        is_default = line.strip().startswith('*')
        match = re.match(r'\*?\s*(\S+)\s+(\S+)\s+(\S+)', line.strip())
        if match:
            name, state, version = match.groups()
            distributions.append({'name': name, 'state': state, 'version': version, 'is_default': is_default})
    return distributions

def get_default_distribution() -> Optional[DistributionInfo]:
    """Gets the default WSL distribution."""
    for dist in list_distributions():
        if dist['is_default']:
            return dist
    return None

def get_ubuntu_distribution() -> Optional[DistributionInfo]:
    """Finds the most relevant Ubuntu distribution, essential for tool calls."""
    all_distros = list_distributions()
    if not all_distros: return None
    
    # First check if default is Ubuntu
    default = get_default_distribution()
    if default and 'ubuntu' in default['name'].lower():
        return default
    
    # Try specific Ubuntu versions in order of preference
    for version in ['Ubuntu-24.04', 'Ubuntu-22.04', 'Ubuntu']:
        for dist in all_distros:
            if dist['name'].lower() == version.lower():
                return dist
    
    # Try any Ubuntu distribution
    for dist in all_distros:
        if 'ubuntu' in dist['name'].lower():
            return dist
    
    return None

def is_wsl_installed() -> bool:
    """Checks if WSL is installed and accessible on the system."""
    try:
        return _run_wsl_command(['--status']).returncode == 0
    except WSLException:
        return False

    lines = result.stdout.strip().splitlines()
    if len(lines) <= 1:
        return []

    distributions: List[DistributionInfo] = []
    for line in lines[1:]:  # Skip header
        line = line.strip()
        if not line:
            continue

        is_default = line.startswith('*')
        # Regex is more robust against variable whitespace than splitting.
        match = re.match(r'\*?\s*(\S+)\s+(\S+)\s+(\S+)', line)
        if match:
            name, state, version = match.groups()
            distributions.append({
                'name': name,
                'state': state,
                'version': version,
                'is_default': is_default,
            })
    return distributions

# --- Path and File System Utilities ---
def convert_path_to_wsl(windows_path: str) -> str:
    """Converts a Windows path to its WSL equivalent using wslpath."""
    result = _run_wsl_command(['-e', 'wslpath', '-a', windows_path])
    if result.returncode == 0 and result.stdout.strip():
        return result.stdout.strip()
    raise WSLException(f"Failed to convert Windows path '{windows_path}' to WSL path.")

def convert_path_to_windows(wsl_path: Optional[str]) -> Optional[str]:
    """Convert a WSL path to a Windows path.
    
    Args:
        wsl_path: WSL-style path (e.g., /mnt/c/Users/username)
        
    Returns:
        Windows-style path (e.g., C:\\Users\\username)
    """
    if not wsl_path:
        return None
        
    # Check if this is a /mnt/ path
    match = re.match(r'^/mnt/([a-z])(/.*)?$', wsl_path)
    if not match:
        logger.warning(f"Path doesn't appear to be a WSL mount path: {wsl_path}")
        return wsl_path
    
    drive_letter = match.group(1).upper()
    path_without_mount = match.group(2) or ''
    
    # Avoid f-string with backslash by using a regular string and formatting
    path_with_backslashes = path_without_mount.replace("/", "\\")
    return f'{drive_letter}:{path_with_backslashes}'

def check_process_running(process_name: str, distribution: Optional[str] = None) -> bool:
    """Check if a process is running in WSL.
    
    Args:
        process_name: Name of the process to check
        distribution: Optional distribution name
        
    Returns:
        Boolean indicating if the process is running
    """
    # Escape the process name for safer execution
    escaped_name = process_name.replace("'", "'\\''")
    
    # Use pgrep to find the process
    result = run_command(['sh', '-c', f"pgrep -f '{escaped_name}' || echo ''"], distribution=distribution)
    return result.returncode == 0 and result.stdout.strip() != ""

def kill_process(process_name: str, distribution: Optional[str] = None) -> bool:
    """Kill a process in WSL.
    
    Args:
        process_name: Name of the process to kill
        distribution: Optional distribution name
        
    Returns:
        Boolean indicating success
    """
    # Escape the process name for safer execution
    escaped_name = process_name.replace("'", "'\\''")
    
    # Use pkill to kill the process
    result = run_command(['sh', '-c', f"pkill -f '{escaped_name}' || true"], distribution=distribution)
    return result.returncode == 0

def file_exists(path: str, distribution: Optional[str] = None) -> bool:
    """Check if a file exists in WSL.
    
    Args:
        path: Path to check (can be Windows or WSL path)
        distribution: Optional distribution name
        
    Returns:
        Boolean indicating if the file exists
    """
    # Convert to WSL path if it's a Windows path
    wsl_path = path
    if re.match(r'^[a-zA-Z]:', path):
        try:
            wsl_path = convert_path_to_wsl(path)
        except WSLException:
            logger.warning(f"Failed to convert Windows path to WSL path: {path}")
            return False
    
    # Escape the path for safer execution
    escaped_path = wsl_path.replace("'", "'\\''")
    
    # Use single quotes to prevent shell interpretation of special characters
    result = run_command(['sh', '-c', f"test -f '{escaped_path}' && echo 'exists' || echo 'not exists'"], 
                        distribution=distribution)
    return "exists" in result.stdout

def directory_exists(path: str, distribution: Optional[str] = None) -> bool:
    """Check if a directory exists in WSL.
    
    Args:
        path: Path to check (can be Windows or WSL path)
        distribution: Optional distribution name
        
    Returns:
        Boolean indicating if the directory exists
    """
    # Convert to WSL path if it's a Windows path
    wsl_path = path
    if re.match(r'^[a-zA-Z]:', path):
        try:
            wsl_path = convert_path_to_wsl(path)
        except WSLException:
            logger.warning(f"Failed to convert Windows path to WSL path: {path}")
            return False
    
    # Escape the path for safer execution
    escaped_path = wsl_path.replace("'", "'\\''")
    
    # Use single quotes to prevent shell interpretation of special characters
    result = run_command(['sh', '-c', f"test -d '{escaped_path}' && echo 'exists' || echo 'not exists'"],
                         distribution=distribution)
    return "exists" in result.stdout

def create_directory(path: str, distribution: Optional[str] = None) -> bool:
    """Create a directory in WSL.
    
    Args:
        path: Path to create (can be Windows or WSL path)
        distribution: Optional distribution name
        
    Returns:
        Boolean indicating success
    """
    # Convert to WSL path if it's a Windows path
    wsl_path = path
    if re.match(r'^[a-zA-Z]:', path):
        try:
            wsl_path = convert_path_to_wsl(path)
        except WSLException:
            logger.warning(f"Failed to convert Windows path to WSL path: {path}")
            return False
    
    # Escape the path for safer execution
    escaped_path = wsl_path.replace("'", "'\\''")
    
    # Use single quotes to prevent shell interpretation of special characters
    result = run_command(['sh', '-c', f"mkdir -p '{escaped_path}'"], distribution=distribution)
    return result.returncode == 0

def copy_file_to_wsl(windows_path: str, wsl_path: str, distribution: Optional[str] = None) -> bool:
    """Copy a file from Windows to WSL.
    
    This is done by using the WSL mount of the Windows filesystem.
    
    Args:
        windows_path: Source path on Windows
        wsl_path: Destination path in WSL
        distribution: Optional distribution name
        
    Returns:
        Boolean indicating success
    """
    # Convert Windows path to WSL path
    try:
        wsl_source_path = convert_path_to_wsl(windows_path)
    except WSLException:
        logger.warning(f"Failed to convert Windows path to WSL path: {windows_path}")
        return False
    
    # Escape paths for safer execution
    escaped_src = wsl_source_path.replace("'", "'\\''")
    escaped_dest = wsl_path.replace("'", "'\\''")
    
    # Use single quotes to prevent shell interpretation of special characters
    result = run_command(['sh', '-c', f"cp '{escaped_src}' '{escaped_dest}'"], 
                       distribution=distribution)
    return result.returncode == 0

def copy_file_from_wsl(wsl_path: str, windows_path: str, distribution: Optional[str] = None) -> bool:
    """Copy a file from WSL to Windows.
    
    This is done by using the WSL mount of the Windows filesystem.
    
    Args:
        wsl_path: Source path in WSL
        windows_path: Destination path on Windows
        distribution: Optional distribution name
        
    Returns:
        Boolean indicating success
    """
    # Convert Windows path to WSL path for the destination
    try:
        wsl_dest_path = convert_path_to_wsl(windows_path)
    except WSLException:
        logger.warning(f"Failed to convert Windows path to WSL path: {windows_path}")
        return False
    
    # Escape paths for safer execution
    escaped_src = wsl_path.replace("'", "'\\''")
    escaped_dest = wsl_dest_path.replace("'", "'\\''")
    
    # Use single quotes to prevent shell interpretation of special characters
    result = run_command(['sh', '-c', f"cp '{escaped_src}' '{escaped_dest}'"], 
                       distribution=distribution)
    return result.returncode == 0

def get_wsl_ip(distribution: Optional[str] = None) -> Optional[str]:
    """Get the IP address of a WSL distribution.
    
    Args:
        distribution: Optional distribution name
        
    Returns:
        IP address as string or None if not found
    """
    result = run_command(['sh', '-c', "ip addr show eth0 | grep 'inet ' | awk '{print $2}' | cut -d/ -f1"],
                         distribution=distribution)
    
    if result.returncode == 0 and result.stdout.strip():
        return result.stdout.strip()
    return None

def install_package(package_name: str, distribution: Optional[str] = None) -> bool:
    """Install a package in WSL using apt-get.
    
    Args:
        package_name: Name of the package to install
        distribution: Optional distribution name
        
    Returns:
        Boolean indicating success
    """
    update_cmd = "apt-get update"
    install_cmd = f"apt-get install -y {package_name}"
    
    # Run with sudo, non-interactive
    result = run_command(['sh', '-c', f"sudo DEBIAN_FRONTEND=noninteractive {update_cmd} && sudo DEBIAN_FRONTEND=noninteractive {install_cmd}"], 
                       distribution=distribution)
    
    return result.returncode == 0

def get_environment_variable(var_name: str, distribution: Optional[str] = None) -> Optional[str]:
    """Get an environment variable from WSL.
    
    Args:
        var_name: Name of the environment variable
        distribution: Optional distribution name
        
    Returns:
        Value of the environment variable or None if not found
    """
    result = run_command(['sh', '-c', f"echo ${var_name}"], distribution=distribution)
    
    if result.returncode == 0 and result.stdout.strip():
        return result.stdout.strip()
    return None

def set_environment_variable(var_name: str, var_value: str, 
                           distribution: Optional[str] = None, persist: bool = False) -> bool:
    """Set an environment variable in WSL.
    
    Args:
        var_name: Name of the environment variable
        var_value: Value to set
        distribution: Optional distribution name
        persist: Whether to persist the variable in .bashrc
        
    Returns:
        Boolean indicating success
    """
    if persist:
        # Add to .bashrc to persist across sessions
        # Escape quotes in var_value for better shell safety
        safe_value = var_value.replace('"', '\\"')
        command = ['sh', '-c', f"echo 'export {var_name}=\"{safe_value}\"' >> ~/.bashrc && source ~/.bashrc"]
        result = run_command(command, distribution=distribution)
    else:
        # For current session only, export the variable and verify it worked
        command = ['sh', '-c', f"export {var_name}=\"{var_value}\" && echo 'Environment variable set'"]
        result = run_command(command, distribution=distribution)
    
    return result.returncode == 0

def sync_windows_env_to_wsl(env_vars: Dict[str, str], 
                          distribution: Optional[str] = None, 
                          persist: bool = False) -> bool:
    """Sync environment variables from Windows to WSL.
    
    Args:
        env_vars: Dictionary of environment variables to sync
        distribution: Optional distribution name
        persist: Whether to persist the variables in .bashrc
        
    Returns:
        Boolean indicating success
    """
    if not env_vars:
        return True
        
    if persist:
        # For persistent variables, we need to add them to .bashrc
        commands_list: List[str] = []
        for name, value in env_vars.items():
            # Escape quotes in value for better shell safety
            safe_value = value.replace('"', '\\"')
            commands_list.append(f"echo 'export {name}=\"{safe_value}\"' >> ~/.bashrc")
        
        # Join commands and source .bashrc to apply changes to current session
        command = ['sh', '-c', " && ".join(commands_list) + " && source ~/.bashrc"]
        result = run_command(command, distribution=distribution)
    else:
        # For non-persistent variables, set them in the current shell session
        export_commands = [f"export {name}=\"{value}\"" for name, value in env_vars.items()]
        command = ['sh', '-c', " && ".join(export_commands) + " && echo 'Environment variables set'"]
        result = run_command(command, distribution=distribution)
    
    return result.returncode == 0

def is_running_as_admin() -> bool:
    """Check if the Python script is running with administrator privileges."""
    if sys.platform != 'win32':
        return False
        
    try:
        import ctypes
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except:
        return False
