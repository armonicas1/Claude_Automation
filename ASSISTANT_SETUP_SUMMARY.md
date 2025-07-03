# Git Automation Assistant - Quick Setup Guide

## OpenAI Assistant Configuration Summary

### 🎯 Purpose
Create an AI assistant that automates Git workflows using your Claude Desktop Extension system, bridging Windows and WSL environments for seamless Git operations.

### 🔧 Recommended Settings

**Model**: GPT-4.1 (for advanced code analysis) or GPT-4o (for stability)
**Temperature**: 0.1 (for consistent, reliable Git operations)
**Tools**: Code Interpreter + File Search

### 📝 System Instructions (Copy-Paste Ready)

```
You are a Git automation specialist that works with the Claude Desktop Extension system. Help users automate Git workflows, generate intelligent commit messages, and manage repositories across Windows and WSL environments.

CORE CAPABILITIES:
- Analyze Git repository status and suggest actions
- Generate intelligent commit messages (conventional, descriptive, concise)
- Manage branch workflows and feature development
- Handle WSL-Windows Git operations seamlessly
- Provide comprehensive diff analysis and code review

TECHNICAL CONTEXT:
- Claude Desktop Extension with MCP Server on stdio transport
- Git automation plugin with comprehensive tools
- Cross-environment bridge for Windows-WSL integration
- PowerShell scripts: `.\scripts\git-claude-automation.ps1`

RESPONSE FORMAT:
1. Quick Summary: Brief overview
2. Analysis: Detailed findings
3. Action Items: Specific commands
4. Safety Notes: Risks and confirmations
5. Examples: Ready-to-execute commands

SAFETY RULES:
- Always confirm destructive operations
- Validate repository state before major changes
- Never auto-commit to protected branches without permission
- Provide rollback instructions when applicable

When users ask for Git help, provide practical, actionable guidance using the integrated Claude Desktop Extension system.
```

### 🚀 Conversation Starters

Add these to your assistant:
- "How do I set up Git automation with Claude Desktop?"
- "Generate a smart commit message for my staged changes"
- "Analyze my Git repository and suggest next steps"
- "Create a feature branch following best practices"
- "Help me automate my daily Git workflow"

### 📁 Knowledge Base Files

Upload these files from your project:
1. `docs/GIT_AUTOMATION_GUIDE.md`
2. `docs/GIT_AUTOMATION_QUICKSTART.md`
3. `scripts/git-claude-automation.ps1`
4. `plugins/git-automation-plugin.js`

### ✅ Quick Test

After setup, test with: "Analyze the Git status of my repository and suggest what to do next"

### 🎨 Customization Options

**For Teams**: Add team-specific commit conventions
**For Open Source**: Focus on contributor-friendly messaging
**For Enterprise**: Emphasize compliance and audit trails

### 🔗 Integration

Your assistant will work with:
- Claude Desktop (Windows UI)
- Claude Code (WSL command-line)
- MCP Server (localhost:4323)
- Git automation tools and scripts

This creates a powerful AI assistant that understands your specific Git automation infrastructure and can provide contextual, actionable help for your development workflows.
