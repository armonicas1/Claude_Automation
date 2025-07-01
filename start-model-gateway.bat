@echo off
echo Starting Claude Desktop Model Gateway
echo ===================================
echo.
echo This will start:
echo 1. Dev Hub MCP Server - Provides tools for Claude Code
echo 2. Claude Desktop Gateway - Routes requests to Claude Desktop
echo.
echo Checking Node.js module compatibility...

cd /d "%~dp0"

REM Check if the project uses ES modules
if exist "package.json" (
    findstr /C:"\"type\": \"module\"" package.json >nul
    if not errorlevel 1 (
        echo Project is using ES modules (type: module in package.json)
        echo Starting gateway with module compatibility wrapper...
        node scripts\module-compatibility-wrapper.js
    ) else (
        echo Project is using CommonJS modules
        node scripts\start-model-gateway.js
    )
) else (
    echo No package.json found, defaulting to CommonJS
    node scripts\start-model-gateway.js
)

echo.
echo Press any key to exit...
pause
