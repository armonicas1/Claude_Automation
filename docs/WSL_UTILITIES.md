# WSL Utilities

This module provides a pure Python alternative to the `wslapi` library for interacting with Windows Subsystem for Linux (WSL) from Python code running on Windows.

## Overview

Instead of relying on the external `wslapi` library, this module uses direct subprocess calls to `wsl.exe` to achieve the same functionality. This approach is more complex but eliminates the external dependency.

## Key Features

- **Distribution Management**: List, query, and interact with WSL distributions
- **Command Execution**: Run commands in WSL from Windows Python
- **Path Conversion**: Convert between Windows and WSL paths
- **Process Management**: Check, start, and stop processes in WSL
- **File Operations**: Copy files between Windows and WSL
- **Environment Variables**: Get and set environment variables in WSL

## Usage Examples

### Basic WSL Commands

```python
from src.utils.wsl import is_wsl_installed, list_distributions, get_default_distribution

# Check if WSL is installed
if is_wsl_installed():
    print("WSL is installed")
    
    # List all distributions
    distributions = list_distributions()
    for dist in distributions:
        print(f"Distribution: {dist['name']} (State: {dist['state']})")
    
    # Get default distribution
    default_dist = get_default_distribution()
    print(f"Default distribution: {default_dist}")
```

### Path Conversion

```python
from src.utils.wsl import convert_path_to_wsl, convert_path_to_windows

# Convert Windows path to WSL path
windows_path = "C:\\Users\\username\\document.txt"
wsl_path = convert_path_to_wsl(windows_path)
print(f"WSL path: {wsl_path}")  # Output: /mnt/c/Users/username/document.txt

# Convert WSL path to Windows path
wsl_path = "/mnt/c/Users/username/document.txt"
windows_path = convert_path_to_windows(wsl_path)
print(f"Windows path: {windows_path}")  # Output: C:\Users\username\document.txt
```

### Running Commands in WSL

```python
from src.utils.wsl import run_command

# Run a simple command
result = run_command("ls -la", distribution="Ubuntu-24.04")
if result.returncode == 0:
    print(f"Output: {result.stdout}")
else:
    print(f"Error: {result.stderr}")

# Run a command with environment variables
result = run_command("echo $CUSTOM_VAR", 
                   distribution="Ubuntu-24.04",
                   env={"CUSTOM_VAR": "Hello from Windows!"})
```

### Working with Files and Directories

```python
from src.utils.wsl import file_exists, directory_exists, create_directory

# Check if a file exists in WSL
if file_exists("/home/username/file.txt", distribution="Ubuntu-24.04"):
    print("File exists in WSL")

# Create a directory in WSL
if create_directory("/home/username/new_directory", distribution="Ubuntu-24.04"):
    print("Directory created successfully")
```

### Environment Variable Management

```python
from src.utils.wsl import set_environment_variable, get_environment_variable

# Set an environment variable in WSL
set_environment_variable("CLAUDE_BRIDGE_ACTIVE", "1", 
                        distribution="Ubuntu-24.04",
                        persist=True)  # Add to .bashrc to persist

# Get an environment variable from WSL
value = get_environment_variable("CLAUDE_BRIDGE_ACTIVE", distribution="Ubuntu-24.04")
print(f"CLAUDE_BRIDGE_ACTIVE = {value}")
```

## Full Example

See `scripts/wsl_integration_example.py` for a complete example of using these utilities.

## Comparison with wslapi

| Feature | Custom WSL Utils | wslapi |
|---------|-----------------|--------|
| Dependencies | None (uses standard library) | External library |
| Installation | None (included in project) | pip install wslapi |
| Maintenance | Self-maintained | Depends on external updates |
| Robustness | Subject to wsl.exe output format changes | Subject to API changes |
| Error Handling | Custom exceptions | Library exceptions |
| Path Conversion | Included | Included |
| Command Execution | Included | Included |
| Authentication | Manual implementation | Provided by library |

## Implementation Notes

- All commands are executed using subprocess calls to `wsl.exe`
- Error handling is provided through try/except blocks and custom exceptions
- Path conversion uses regular expressions to detect and convert path formats
- The module detects if it's running on Windows and provides appropriate warnings

## Limitations

- Only works on Windows with WSL installed
- Depends on `wsl.exe` being in the PATH
- Commands are executed in a separate process, so state is not maintained between calls
- Environment variables set with `persist=False` only affect the current command
- More complex than using a dedicated library
