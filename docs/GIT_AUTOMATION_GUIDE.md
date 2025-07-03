# Git Automation Quick Start Guide

## 🚀 Quick Start Examples

### 1. Analyze Your Git Repository
```powershell
# Basic status analysis
.\scripts\git-claude-automation.ps1 -Action status

# Detailed analysis with diff
.\scripts\git-claude-automation.ps1 -Action status -IncludeDiff
```

### 2. Smart Commit Generation
```powershell
# Stage some files first
git add .

# Generate smart commit message
.\scripts\git-claude-automation.ps1 -Action commit -CommitType conventional

# Generate and auto-execute commit
.\scripts\git-claude-automation.ps1 -Action commit -CommitType descriptive -AutoCommit
```

### 3. Feature Branch Creation
```powershell
# Create a new feature branch following best practices
.\scripts\git-claude-automation.ps1 -Action branch -BranchName "feature/git-automation-demo"
```

### 4. Complete Automated Workflow
```powershell
# Run full automation workflow
.\scripts\git-claude-automation.ps1 -Action workflow -IncludeDiff -CheckMerge
```

## 🔧 Advanced Usage

### Using the JavaScript Client Directly
```javascript
import GitClaudeClient from './src/git-claude-client.js';

const gitClient = new GitClaudeClient({
    projectPath: 'C:\\_GPT\\Claude_Automation'
});

// Set session credentials from Claude Desktop
gitClient.setSession('session_id', 'session_token');

// Analyze repository
const status = await gitClient.analyzeGitStatus(true);
console.log(status);

// Generate smart commit
const commit = await gitClient.smartCommit('conventional', false);
console.log(commit.suggested_commit_message);
```

### WSL Integration Example
```bash
# From WSL, your automation can work with Windows Git repos
cd /mnt/c/_GPT/Claude_Automation

# The bridge handles path translation automatically
node scripts/git-automation-examples.js
```

## 🌉 Cross-Boundary Features

Your Git automation system leverages the unique WSL-Windows bridge architecture:

1. **Path Translation**: Automatically handles Windows (`C:\path`) ↔ WSL (`/mnt/c/path`) paths
2. **Session Sharing**: Single Claude Desktop session works for both environments  
3. **File Monitoring**: Real-time sync between Windows and WSL Git operations
4. **Tool Integration**: Claude Code CLI in WSL + Claude Desktop tools in Windows

## 📋 Available Git Tools

### Through MCP Server:
- `git_status_analysis` - Repository status with AI suggestions
- `git_smart_commit` - AI-generated commit messages
- `git_branch_workflow` - Branch management automation

### Through Claude Code Integration:
- Interactive commit message refinement
- Code review integration with Git diff
- Automated workflow suggestions
- Cross-platform repository management

## 🔄 Workflow Examples

### Example 1: Development Cycle
```powershell
# 1. Create feature branch
.\scripts\git-claude-automation.ps1 -Action branch -BranchName "feature/new-feature"

# 2. Make changes, then analyze
.\scripts\git-claude-automation.ps1 -Action status -IncludeDiff

# 3. Stage and commit with AI
git add .
.\scripts\git-claude-automation.ps1 -Action commit -AutoCommit

# 4. Check merge readiness
.\scripts\git-claude-automation.ps1 -Action workflow -CheckMerge
```

### Example 2: Code Review Workflow
```powershell
# Analyze changes before review
.\scripts\git-claude-automation.ps1 -Action status -IncludeDiff

# Generate descriptive commit for review
.\scripts\git-claude-automation.ps1 -Action commit -CommitType descriptive
```

## 🛠️ Customization

### Adding Custom Git Operations
Edit `plugins/git-automation-plugin.js` to add new tools:

```javascript
{
  name: "git_custom_operation",
  description: "Your custom Git operation",
  parameters: { /* define parameters */ },
  handler: async (params) => {
    // Your custom Git logic here
  }
}
```

### Extending the Client
Modify `src/git-claude-client.js` to add new methods:

```javascript
async customGitOperation(params) {
  return await this.executeAction('git_custom_operation', params);
}
```

## 🔍 Troubleshooting

### Common Issues:
1. **MCP Server Not Responding**: Restart Claude Desktop and check logs
2. **Path Issues**: Ensure proper path format for your environment
3. **Git Not Found**: Verify Git is in PATH for both Windows and WSL
4. **Session Credentials**: Check Claude Desktop session state file

### Debug Commands:
```powershell
# Check MCP server logs
Get-Content logs/mcp-server-stdio.log -Tail 20

# Verify Git plugin loaded
Get-Content logs/bridge.log | Select-String "git"

# Test basic connectivity
curl http://localhost:4323/.identity
```
