@echo off
echo Starting Claude Desktop Model Gateway
echo ===================================
echo.
echo This will start:
echo 1. Dev Hub MCP Server - Provides tools for Claude Code
echo 2. Claude Desktop Gateway - Routes requests to Claude Desktop
echo.
echo Press Ctrl+C to stop all services
echo.

cd /d "%~dp0"
node scripts\start-model-gateway.js

pause
