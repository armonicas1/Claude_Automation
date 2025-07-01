"""
Windows Subsystem for Linux (WSL) interaction utilities.

This package provides secure, robust, and Python 3.8-compatible functions for
interacting with WSL from Windows Python code by calling wsl.exe directly.
It includes intelligent helpers for finding specific distributions, executing
commands securely, and managing files and directories across Windows and WSL.
"""

from .wsl_utils import (
    # Core types and exceptions
    WSLException,
    DistributionInfo,
    
    # Distribution management
    is_wsl_installed,
    list_distributions,
    get_default_distribution,
    get_ubuntu_distribution,
    
    # Command execution
    run_command,
    
    # Path conversion
    convert_path_to_wsl,
    convert_path_to_windows,
    
    # File and directory operations
    file_exists,
    directory_exists,
    create_directory,
    copy_file_to_wsl,
    copy_file_from_wsl,
    
    # Process management
    check_process_running,
    kill_process,
    
    # System information
    get_wsl_ip,
    is_running_as_admin,
    
    # Environment variables
    get_environment_variable,
    set_environment_variable,
    sync_windows_env_to_wsl
)

__all__ = [
    # Core types and exceptions
    'WSLException',
    'DistributionInfo',
    
    # Distribution management
    'is_wsl_installed',
    'list_distributions',
    'get_default_distribution',
    'get_ubuntu_distribution',
    
    # Command execution
    'run_command',
    
    # Path conversion
    'convert_path_to_wsl',
    'convert_path_to_windows',
    
    # File and directory operations
    'file_exists',
    'directory_exists',
    'create_directory',
    'copy_file_to_wsl',
    'copy_file_from_wsl',
    
    # Process management
    'check_process_running',
    'kill_process',
    
    # System information
    'get_wsl_ip',
    'is_running_as_admin',
    
    # Environment variables
    'get_environment_variable',
    'set_environment_variable',
    'sync_windows_env_to_wsl'
]
