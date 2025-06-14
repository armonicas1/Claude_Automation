@echo off
echo Starting Claude Desktop Extension Services

cd /d "%~dp0.."
echo Working directory: %CD%

echo Starting services...
node scripts\start-services.js

echo Services started.
