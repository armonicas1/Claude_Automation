@echo off
echo Updating Claude Desktop Configuration

cd /d "%~dp0.."
echo Working directory: %CD%

echo Running update script...
node scripts\update-claude-config.js

echo Configuration update complete.
pause
