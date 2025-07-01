# Python Dependencies Management

This directory contains specialized requirements files for different environments and purposes of the Claude Desktop Extension Python components.

## Files Structure

- `base.txt`: Common dependencies used across all environments
- `windows.txt`: Windows-specific dependencies (includes base)
- `wsl.txt`: WSL-specific dependencies (includes base)
- `dev.txt`: Additional dependencies for development and testing
- `api.txt`: Optional API integration dependencies

## Usage

### Basic Installation

For most users, simply install from the main requirements file:

```bash
pip install -r requirements.txt
```

This will automatically install the base dependencies and platform-specific packages.

### Development Environment

For development work, use:

```bash
pip install -r requirements/dev.txt
```

### API Integration

For API integration features:

```bash
pip install -r requirements/api.txt
```

### Specific Environments

#### Windows-only Installation

```bash
pip install -r requirements/windows.txt
```

#### WSL Installation

```bash
pip install -r requirements/wsl.txt
```

## Dependency Management

When adding new dependencies:

1. Add common dependencies to `base.txt`
2. Add OS-specific dependencies to the appropriate file
3. Add development tools to `dev.txt`
4. Update the main `requirements.txt` if needed

## Notes

- The Python bridge components are primarily used for cross-environment integration between Windows and WSL
- Platform-specific conditional dependencies use the `; sys_platform == 'win32'` syntax for automatic platform detection
