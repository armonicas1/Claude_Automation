#!/usr/bin/env python
"""
wsl_integration_example.py - Example of WSL integration with the secure wsl_utils module

This script demonstrates how to use the consolidated wsl_utils module to interact 
with WSL from Windows Python code, providing secure and robust functionality for
WSL distribution management, command execution, and file operations.
"""

import sys
import logging
from pathlib import Path
from typing import List

# --- Setup Project Path and Logging ---
script_dir = Path(__file__).resolve().parent
project_root = script_dir.parent
sys.path.insert(0, str(project_root))

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Import from our custom consolidated module ---
try:
    from src.utils.wsl import (
        list_distributions, 
        get_default_distribution,
        get_ubuntu_distribution,
        run_command,
        is_wsl_installed,
        file_exists,
        directory_exists
    )
    from src.utils.wsl.wsl_utils import WSLException
except ImportError as e:
    logger.error(f"Critical error during import: {e}")
    sys.exit(1)

def main() -> None:
    """Demonstrates the use of the secure WSL utility functions."""
    logger.info("--- WSL Integration Example ---")

    if not is_wsl_installed():
        logger.error("WSL does not appear to be installed or `wsl.exe` is not in the system PATH.")
        return

    # 1. List Distributions
    logger.info("[1] Listing installed WSL distributions...")
    try:
        distributions = list_distributions()
        if not distributions:
            logger.error("No WSL distributions found. Please install one from the Microsoft Store (e.g., Ubuntu).")
            return
            
        # Show distributions with proper formatting
        for dist in distributions:
            default_marker = "(default)" if dist['is_default'] else ""
            logger.info(f"  - Found: {dist['name']} (State: {dist['state']}) {default_marker}")
                
        if not distributions:
            logger.error("No WSL distributions found with proper names.")
            return
            
    except WSLException as e:
        logger.error(f"An error occurred while listing distributions: {e}")
        return

    # 2. Find a suitable distribution for testing
    logger.info("\n[2] Looking for suitable distributions...")
    
    # Try to get an Ubuntu distribution first
    ubuntu_dist = get_ubuntu_distribution()
    if ubuntu_dist:
        logger.info(f"  Found Ubuntu distribution: {ubuntu_dist['name']}")
        target_dist = ubuntu_dist
    else:
        # Fall back to default or first available
        default_dist = get_default_distribution()
        if default_dist:
            logger.info(f"  Using default distribution: {default_dist['name']}")
            target_dist = default_dist
        elif distributions:
            logger.info(f"  Using first available distribution: {distributions[0]['name']}")
            target_dist = distributions[0]
        else:
            logger.error("  No suitable distribution found")
            return

    logger.info(f"\n[3] Using '{target_dist['name']}' for tests.")

    # 4. Run a safe command (list of arguments)
    logger.info(f"[4] Running 'ls -la /' command in '{target_dist['name']}'...")
    command_to_run: List[str] = ['ls', '-la', '/']
    result = run_command(command_to_run, distribution=target_dist['name'])
    
    # Result is already properly typed from the function

    if result.returncode == 0:
        logger.info("  Command successful! First few lines of output:")
        output_lines = result.stdout.strip().splitlines()
        for line in output_lines[:5]:
            logger.info(f"    {line}")
    else:
        logger.error(f"  Command failed. Stderr: {result.stderr.strip()}")

    # 5. Run another command with bash
    logger.info("\n[5] Testing bash command execution...")
    bash_command: List[str] = ['bash', '-c', 'echo "Current user: $(whoami), WSL Version: $(uname -a)"']
    result = run_command(bash_command, distribution=target_dist['name'])
    
    if result.returncode == 0:
        logger.info(f"  Result: {result.stdout.strip()}")
    else:
        logger.error(f"  Command failed. Stderr: {result.stderr.strip()}")
        
    # 6. Test file operations
    logger.info("\n[6] Testing file and directory operations...")
    test_dir = f"/tmp/wsl-integration-test-{Path(__file__).stem}"
    
    # Create a directory
    logger.info(f"  Creating directory: {test_dir}")
    mkdir_command: List[str] = ['mkdir', '-p', test_dir]
    result = run_command(mkdir_command, distribution=target_dist['name'])
    
    if result.returncode == 0:
        logger.info(f"  Successfully created directory")
    else:
        logger.error(f"  Failed to create directory. Stderr: {result.stderr.strip()}")
        
    # Check if directory exists
    if directory_exists(test_dir, distribution=target_dist['name']):
        logger.info(f"  Verified directory exists: {test_dir}")
    else:
        logger.error(f"  Directory does not exist: {test_dir}")
        
    # Create a test file
    test_file = f"{test_dir}/test.txt"
    logger.info(f"  Creating file: {test_file}")
    echo_command: List[str] = ['bash', '-c', f"echo 'This is a test file created by {Path(__file__).name}' > {test_file}"]
    result = run_command(echo_command, distribution=target_dist['name'])
    
    if result.returncode == 0:
        logger.info(f"  Successfully created file")
    else:
        logger.error(f"  Failed to create file. Stderr: {result.stderr.strip()}")
        
    # Check if file exists
    if file_exists(test_file, distribution=target_dist['name']):
        logger.info(f"  Verified file exists: {test_file}")
    else:
        logger.error(f"  File does not exist: {test_file}")
        
    # Read the file
    cat_command: List[str] = ['cat', test_file]
    result = run_command(cat_command, distribution=target_dist['name'])
    
    if result.returncode == 0:
        logger.info(f"  File contents: {result.stdout.strip()}")
    else:
        logger.error(f"  Failed to read file. Stderr: {result.stderr.strip()}")
        
    # Clean up
    logger.info(f"  Cleaning up test directory")
    rm_command: List[str] = ['rm', '-rf', test_dir]
    result = run_command(rm_command, distribution=target_dist['name'])
    
    if result.returncode == 0:
        logger.info(f"  Successfully cleaned up test directory")
    else:
        logger.error(f"  Failed to clean up. Stderr: {result.stderr.strip()}")

    logger.info("\n--- Example script finished ---")

if __name__ == "__main__":
    main()
