# Install Python Dependencies Script
# This script installs the appropriate Python dependencies based on environment

param(
    [ValidateSet("base", "windows", "wsl", "dev", "api", "all")]
    [string]$Environment = "all",
    [switch]$Upgrade = $false
)

$ReqDir = Join-Path $PSScriptRoot "requirements"
$MainReq = Join-Path $PSScriptRoot "requirements.txt"

Write-Host "====== Claude Automation Python Dependencies Installer ======" -ForegroundColor Cyan
Write-Host ""

# Check if Python is installed
try {
    $pythonVersion = python --version
    Write-Host "Using $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Python not found. Please install Python 3.9+ and try again." -ForegroundColor Red
    exit 1
}

# Check if pip is installed
try {
    $pipVersion = python -m pip --version
    Write-Host "Using $pipVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: pip not found. Please ensure pip is installed with your Python installation." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Installing dependencies for environment: $Environment" -ForegroundColor Cyan

$pipArgs = @()
if ($Upgrade) {
    $pipArgs += "--upgrade"
    Write-Host "Upgrade mode enabled: will upgrade existing packages" -ForegroundColor Yellow
}

# Install dependencies based on environment
switch ($Environment) {
    "base" {
        $reqFile = Join-Path $ReqDir "base.txt"
        Write-Host "Installing base dependencies from: $reqFile" -ForegroundColor Blue
        python -m pip install -r $reqFile @pipArgs
    }
    "windows" {
        $reqFile = Join-Path $ReqDir "windows.txt"
        Write-Host "Installing Windows-specific dependencies from: $reqFile" -ForegroundColor Blue
        python -m pip install -r $reqFile @pipArgs
    }
    "wsl" {
        $reqFile = Join-Path $ReqDir "wsl.txt"
        Write-Host "Installing WSL-specific dependencies from: $reqFile" -ForegroundColor Blue
        python -m pip install -r $reqFile @pipArgs
    }
    "dev" {
        $reqFile = Join-Path $ReqDir "dev.txt"
        Write-Host "Installing development dependencies from: $reqFile" -ForegroundColor Blue
        python -m pip install -r $reqFile @pipArgs
    }
    "api" {
        $reqFile = Join-Path $ReqDir "api.txt"
        Write-Host "Installing API integration dependencies from: $reqFile" -ForegroundColor Blue
        python -m pip install -r $reqFile @pipArgs
    }
    "all" {
        Write-Host "Installing all dependencies from: $MainReq" -ForegroundColor Blue
        python -m pip install -r $MainReq @pipArgs
    }
}

Write-Host ""
Write-Host "Dependencies installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To test the WSL integration, run: python scripts/wsl_integration_example.py" -ForegroundColor Cyan
