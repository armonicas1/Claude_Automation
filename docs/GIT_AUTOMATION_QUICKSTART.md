# Quick Start: Git Automation with Claude Code

## 🚀 Immediate Setup (5 minutes)

### Step 1: Verify Prerequisites
```powershell
# Check if Claude Desktop is running
Get-Process -Name "claude" -ErrorAction SilentlyContinue

# Test MCP server connectivity
curl http://localhost:4323/.identity

# Verify Git availability
git --version

# Check if you're in a Git repository
git status
```

### Step 2: Run Your First Automation
```powershell
# Navigate to your Git repository
cd C:\_GPT\Claude_Automation

# Analyze your repository status
.\scripts\git-claude-automation.ps1 -Action status

# If you have staged changes, generate a smart commit
git add .
.\scripts\git-claude-automation.ps1 -Action commit -CommitType conventional
```

### Step 3: Create a Feature Branch
```powershell
# Create a new feature branch following best practices
.\scripts\git-claude-automation.ps1 -Action branch -BranchName "feature/git-automation-demo"
```

## 🎯 Common Use Cases

### Daily Development Workflow

#### Morning Sync
```powershell
# Start your day with a comprehensive repository analysis
.\scripts\git-claude-automation.ps1 -Action workflow -IncludeDiff
```

#### Smart Commits During Development
```powershell
# Stage your changes
git add src/my-feature.js

# Generate intelligent commit message
.\scripts\git-claude-automation.ps1 -Action commit -CommitType conventional

# Example output: "feat(git): add intelligent commit message generation"
```

#### Pre-Push Quality Check
```powershell
# Complete analysis before pushing
.\scripts\git-claude-automation.ps1 -Action workflow -CheckMerge -IncludeDiff
```

### Advanced Automation Examples

#### Automated Feature Development Cycle
```powershell
# 1. Create feature branch
.\scripts\git-claude-automation.ps1 -Action branch -BranchName "feature/user-authentication"

# 2. Work on your code...
# 3. Stage changes incrementally
git add auth/login.js
.\scripts\git-claude-automation.ps1 -Action commit -CommitType conventional -AutoCommit

# 4. Before merging back
.\scripts\git-claude-automation.ps1 -Action workflow -CheckMerge
```

#### Batch Commit Processing
```powershell
# For multiple small changes
$files = @("config.js", "readme.md", "package.json")
foreach ($file in $files) {
    git add $file
    .\scripts\git-claude-automation.ps1 -Action commit -CommitType descriptive -AutoCommit
}
```

## 🔧 Configuration Examples

### Setting Up Custom Commit Types
Create a `.clauderc` file in your repository:
```json
{
  "git": {
    "commitTypes": {
      "conventional": {
        "format": "type(scope): description",
        "types": ["feat", "fix", "docs", "style", "refactor", "test", "chore"]
      },
      "descriptive": {
        "format": "Descriptive explanation of what changed",
        "includeFileContext": true
      }
    },
    "branchNaming": {
      "feature": "feature/{issue-number}-{description}",
      "bugfix": "bugfix/{issue-number}-{description}",
      "hotfix": "hotfix/{description}"
    }
  }
}
```

### Team Workflow Integration
```powershell
# Set up team conventions
git config --local claude.commitStyle "conventional"
git config --local claude.branchPrefix "feature/"
git config --local claude.requireMergeChecks true
```

## 🌟 Advanced Features

### Cross-Environment Git Operations
```powershell
# Working with WSL repositories from Windows
$wslPath = "/mnt/c/Projects/my-project"
.\scripts\git-claude-automation.ps1 -Action status -ProjectPath $wslPath

# Sync Git config between Windows and WSL
.\scripts\sync-git-config.ps1
```

### Integration with Claude Code
```javascript
// From within Claude Code (WSL environment)
import { GitAutomation } from '@claude/git-automation';

const git = new GitAutomation({
  projectPath: process.cwd(),
  bridgeMode: 'file-based' // For WSL-Windows communication
});

// Analyze repository
const analysis = await git.analyzeStatus(true);
console.log(analysis.recommendations);

// Generate commit message
const commitMsg = await git.generateCommitMessage('conventional');
```

### API Integration Example
```javascript
// Using the JavaScript client directly
import GitClaudeClient from './src/git-claude-client.js';

const client = new GitClaudeClient({
  host: 'localhost',
  port: 4323,
  projectPath: 'C:\\_GPT\\Claude_Automation'
});

// Set session from Claude Desktop
client.setSession(sessionId, sessionToken);

// Run automated workflow
const result = await client.automatedWorkflow({
  analyzeDiff: true,
  commitType: 'conventional',
  autoCommit: false,
  checkMergeReady: true
});
```

## 🔍 Troubleshooting Common Issues

### MCP Server Not Responding
```powershell
# Check server status
netstat -ano | findstr :4323

# Restart MCP server
.\start-claude-admin-with-monitoring.ps1 -Stop
.\start-claude-admin-with-monitoring.ps1
```

### Git Plugin Not Loaded
```powershell
# Check plugin status
Get-Content logs/mcp-server-stdio.log | Select-String "git-automation"

# Reload plugins
node src/custom-claude-mcp-stdio.js
```

### WSL Integration Issues
```powershell
# Check WSL connectivity
wsl --list --verbose

# Sync authentication
.\scripts\sync-wsl-auth.ps1

# Test cross-boundary operations
.\scripts\test-wsl-git.ps1
```

## 📊 Performance Tips

### For Large Repositories
```powershell
# Use selective analysis
.\scripts\git-claude-automation.ps1 -Action status -MaxFiles 100

# Skip diff for large changes
.\scripts\git-claude-automation.ps1 -Action commit -SkipDiff
```

### Optimizing for Speed
```json
// In .clauderc
{
  "git": {
    "performance": {
      "cacheDuration": 300,
      "maxDiffSize": "1MB",
      "skipBinaryFiles": true,
      "incrementalAnalysis": true
    }
  }
}
```

## 🎨 Customization Examples

### Custom Commit Templates
```javascript
// In plugins/git-automation-plugin.js
const customTemplates = {
  feature: "✨ feat({scope}): {description}",
  bugfix: "🐛 fix({scope}): {description}",
  docs: "📚 docs: {description}",
  style: "💄 style: {description}",
  refactor: "♻️ refactor({scope}): {description}",
  test: "🧪 test: {description}",
  chore: "🔧 chore: {description}"
};
```

### Project-Specific Rules
```powershell
# Set up different rules per project
if ((Get-Location).Path -like "*frontend*") {
    $commitStyle = "angular"
} elseif ((Get-Location).Path -like "*api*") {
    $commitStyle = "conventional"
} else {
    $commitStyle = "descriptive"
}

.\scripts\git-claude-automation.ps1 -Action commit -CommitType $commitStyle
```

## 🚀 Next Steps

1. **Explore Advanced Features**: Try the complete workflow automation
2. **Customize for Your Team**: Set up team-specific conventions
3. **Integrate with CI/CD**: Connect to your deployment pipeline
4. **Monitor and Optimize**: Use the reporting features to improve workflows

## 📚 Additional Resources

- **Full Documentation**: `docs/GIT_AUTOMATION_GUIDE.md`
- **API Reference**: `docs/CLIENT_API_DOCUMENTATION.md`
- **Plugin Development**: `docs/PLUGINS_ARCHITECTURE.md`
- **Troubleshooting**: `docs/IMPLEMENTATION_ISSUES_AND_FIXES.md`

Happy automating! 🎉
