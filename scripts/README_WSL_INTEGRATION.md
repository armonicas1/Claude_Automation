# Python Bridge WSL Integration Test

This script demonstrates how to use the custom WSL utilities to interact with 
WSL from Python, without relying on external libraries like wslapi.

## Requirements

- Windows with WSL installed
- Python 3.7+
- Project dependencies from requirements.txt

## Usage

```bash
python scripts/wsl_integration_test.py
```

## Overview

This script demonstrates:

1. Detecting WSL distributions
2. Path conversion between Windows and WSL
3. Running commands in WSL
4. Managing environment variables
5. File operations between Windows and WSL
6. Process monitoring in WSL

The custom WSL utilities in `src/utils/wsl` provide a pure Python implementation
that directly uses subprocess calls to wsl.exe, eliminating the need for external
libraries like wslapi.
