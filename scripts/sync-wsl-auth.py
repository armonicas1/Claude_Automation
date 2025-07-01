#!/usr/bin/env python
"""
sync-wsl-auth.py - Synchronize Claude authentication between WSL distributions

This script ensures that your Claude authentication credentials are synchronized
between all WSL distributions (especially between Ubuntu versions and Docker Desktop).
It is compatible with Python 3.8.10 and uses the secure wsl_utils module.
"""

import os
import sys
import json
import logging
import argparse
from pathlib import Path
from typing import Optional, Dict, Any

# Configure logging
logs_dir = Path(__file__).resolve().parent.parent / 'logs'
logs_dir.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(logs_dir / 'wsl-auth-sync.log')
    ]
)
logger = logging.getLogger(__name__)

# Add the project root to sys.path
script_dir = Path(__file__).resolve().parent
project_root = script_dir.parent
sys.path.insert(0, str(project_root))

try:
    from src.utils.wsl import (
        list_distributions,
        run_command,
        get_ubuntu_distribution,
        file_exists
    )
except ImportError as e:
    logger.error(f"Failed to import WSL utilities: {e}")
    sys.exit(1)

def read_credentials(distribution: str, username: str) -> Optional[Dict[str, Any]]:
    """Securely reads credentials from a WSL distribution.
    
    Args:
        distribution: The name of the WSL distribution
        username: The username in the WSL distribution
        
    Returns:
        The parsed credentials JSON or None if not found
    """
    credential_path = f"/home/{username}/.claude/.credentials.json"
    
    # First check if the file exists
    check_result = run_command(['test', '-f', credential_path], distribution=distribution)
    if check_result.returncode != 0:
        logger.warning(f"Credentials file does not exist in {distribution}")
        return None
    
    # Read the file content
    result = run_command(['cat', credential_path], distribution=distribution)
    
    if result.returncode != 0:
        logger.error(f"Failed to read credentials from {distribution}")
        return None
    
    try:
        credentials_json = result.stdout.strip()
        return json.loads(credentials_json)
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON in credentials file from {distribution}")
        return None

def write_credentials(distribution: str, username: str, credentials_data: Dict[str, Any]) -> bool:
    """Safely writes credentials to a WSL distribution.
    
    Args:
        distribution: The name of the WSL distribution
        username: The username in the WSL distribution
        credentials_data: The credentials data to write
        
    Returns:
        True if successful, False otherwise
    """
    credential_dir = f"/home/{username}/.claude"
    credential_path = f"{credential_dir}/.credentials.json"
    
    # First ensure the directory exists
    create_dir_result = run_command(['mkdir', '-p', credential_dir], distribution=distribution)
    if create_dir_result.returncode != 0:
        logger.error(f"Failed to create directory in {distribution}")
        return False
    
    # Convert credentials to JSON string
    try:
        credentials_json = json.dumps(credentials_data)
    except (TypeError, ValueError) as e:
        logger.error(f"Failed to convert credentials to JSON: {e}")
        return False
    
    # Write credentials using a secure command approach with proper shell escaping
    # The credentials are written using echo with shell escaping handled by bash
    safe_credentials = credentials_json.replace("'", "'\\''")  # Escape single quotes for shell
    write_command = ['bash', '-c', f"echo '{safe_credentials}' > '{credential_path}'"]
    
    result = run_command(write_command, distribution=distribution)
    
    if result.returncode == 0:
        logger.info(f"Successfully wrote credentials to {distribution}")
        return True
    else:
        logger.error(f"Failed to write credentials to {distribution}: {result.stderr}")
        return False

def update_windows_bridge(api_key: str, username: str) -> bool:
    """Create a Windows bridge batch file with credentials.
    
    Args:
        api_key: The API key to write to the bridge file
        username: The Windows username
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Create bridge directory
        bridge_dir = os.path.join('C:', os.sep, 'Users', username, 'claude-bridge')
        os.makedirs(bridge_dir, exist_ok=True)
        
        # Create batch file
        env_file = os.path.join(bridge_dir, 'claude-env.bat')
        with open(env_file, 'w') as f:
            f.write(f'''@echo off
REM Auto-generated WSL Authentication Bridge
REM Generated: {os.path.basename(__file__)}
set ANTHROPIC_API_KEY={api_key}
set CLAUDE_API_KEY={api_key}
echo ✅ WSL Auth Bridge: API key loaded from WSL Claude Code credentials
''')
        
        logger.info(f"Created Windows bridge file at {env_file}")
        return True
    except Exception as e:
        logger.error(f"Failed to create Windows bridge file: {e}")
        return False

def extract_api_key(credentials: Optional[Dict[str, Any]]) -> str:
    """Extract API key from credentials dictionary.
    
    Args:
        credentials: The credentials dictionary
        
    Returns:
        The API key or empty string if not found
    """
    if not credentials:
        return ""
        
    api_key = credentials.get('claudeAiOauth', {}).get('accessToken', '')
    if not api_key:
        logger.error("No valid API key found in credentials")
    return api_key

def sync_credentials_between_all_distributions(username: Optional[str] = None) -> bool:
    """Sync credentials between all WSL distributions.
    
    Args:
        username: The username in the WSL distribution, defaults to Windows username
        
    Returns:
        True if successful, False otherwise
    """
    # Get Windows username if not provided
    if not username:
        windows_username = os.getenv('USERNAME')
        if not windows_username:
            logger.error("Could not determine Windows username")
            return False
        username = windows_username
        logger.info(f"Using Windows username: {username}")
    
    # Get all distributions
    distributions = list_distributions()
    if not distributions:
        logger.error("No WSL distributions found")
        return False
    
    logger.info(f"Found {len(distributions)} WSL distributions")
    for dist in distributions:
        logger.info(f" - {dist['name']} (state: {dist['state']})")
        
    # First, find a source distribution with credentials
    source_dist = None
    source_credentials = None
    credential_path = f"/home/{username}/.claude/.credentials.json"
    
    # Try Ubuntu distributions first
    ubuntu_dist = get_ubuntu_distribution()
    if ubuntu_dist:
        logger.info(f"Found Ubuntu distribution: {ubuntu_dist['name']}")
        # Check if credentials exist
        if file_exists(credential_path, distribution=ubuntu_dist['name']):
            source_dist = ubuntu_dist['name']
            logger.info(f"Using Ubuntu distribution '{source_dist}' as credentials source")
            source_credentials = read_credentials(source_dist, username)
    
    # If no Ubuntu distribution has credentials, try other distributions
    if not source_credentials:
        for dist in distributions:
            if file_exists(credential_path, distribution=dist['name']):
                source_dist = dist['name']
                logger.info(f"Using distribution '{source_dist}' as credentials source")
                source_credentials = read_credentials(source_dist, username)
                if source_credentials:
                    break
    
    if not source_credentials:
        logger.error(f"No distribution has valid credentials at {credential_path}")
        logger.info("Please create credentials first in at least one WSL distribution")
        return False
    
    # Extract API key for Windows bridge
    api_key = extract_api_key(source_credentials)
    if not api_key:
        logger.error("Could not extract API key from credentials")
        return False
    
    # Create Windows bridge file
    if not update_windows_bridge(api_key, username):
        logger.warning("Failed to create Windows bridge file")
    
    # Sync to all other distributions
    success = True
    for dist in distributions:
        if dist['name'] != source_dist:
            logger.info(f"Syncing credentials to {dist['name']}...")
            if not write_credentials(dist['name'], username, source_credentials):
                logger.error(f"Failed to sync credentials to {dist['name']}")
                success = False
            else:
                logger.info(f"Successfully synced credentials to {dist['name']}")
    
    return success

def main() -> None:
    """Main function to sync credentials between WSL distributions."""
    parser = argparse.ArgumentParser(description="Sync Claude credentials between WSL distributions")
    parser.add_argument('--username', '-u', default=os.getenv('USERNAME'), 
                        help='WSL username (default: current Windows username)')
    args = parser.parse_args()
    
    logger.info("Starting Claude WSL credential synchronization")
    if sync_credentials_between_all_distributions(username=args.username):
        logger.info("✅ Completed credential synchronization successfully")
    else:
        logger.warning("⚠️ Completed credential synchronization with some issues")
        sys.exit(1)

if __name__ == "__main__":
    main()
