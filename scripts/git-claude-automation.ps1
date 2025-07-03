# git-claude-automation.ps1
# PowerShell script for Git automation using Claude Code and Claude Desktop integration

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("status", "commit", "branch", "workflow", "help")]
    [string]$Action = "help",
    
    [Parameter(Mandatory=$false)]
    [string]$ProjectPath = $PWD.Path,
    
    [Parameter(Mandatory=$false)]
    [string]$BranchName = "",
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("conventional", "descriptive", "concise")]
    [string]$CommitType = "conventional",
    
    [Parameter(Mandatory=$false)]
    [switch]$AutoCommit,
    
    [Parameter(Mandatory=$false)]
    [switch]$IncludeDiff,
    
    [Parameter(Mandatory=$false)]
    [switch]$CheckMerge
)

# Configuration
$ClaudeDir = "$env:APPDATA\Claude"
$ScriptDir = "$PSScriptRoot"
$ProjectRoot = Split-Path $ScriptDir -Parent
$GitClientPath = "$ProjectRoot\src\git-claude-client.js"

# Colors for output
$Green = "Green"
$Red = "Red"
$Yellow = "Yellow"
$Cyan = "Cyan"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Test-Prerequisites {
    Write-ColorOutput "🔍 Checking prerequisites..." $Cyan
    
    # Check if Claude Desktop is running
    $claudeProcess = Get-Process -Name "claude" -ErrorAction SilentlyContinue
    if (-not $claudeProcess) {
        Write-ColorOutput "❌ Claude Desktop is not running. Please start Claude Desktop first." $Red
        return $false
    }
    Write-ColorOutput "✅ Claude Desktop is running" $Green
    
    # Check if MCP server is responding
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:4323/.identity" -Method Get -TimeoutSec 5
        Write-ColorOutput "✅ MCP server is responding" $Green
    } catch {
        Write-ColorOutput "❌ MCP server is not responding. Check your extension setup." $Red
        return $false
    }
    
    # Check if Git is available
    try {
        git --version | Out-Null
        Write-ColorOutput "✅ Git is available" $Green
    } catch {
        Write-ColorOutput "❌ Git is not installed or not in PATH" $Red
        return $false
    }
    
    # Check if we're in a Git repository
    try {
        git rev-parse --git-dir | Out-Null
        Write-ColorOutput "✅ Current directory is a Git repository" $Green
    } catch {
        Write-ColorOutput "❌ Current directory is not a Git repository" $Red
        return $false
    }
    
    return $true
}

function Invoke-GitStatusAnalysis {
    Write-ColorOutput "`n📊 Analyzing Git repository status..." $Cyan
    
    $nodeCommand = @"
import GitClaudeClient from '$($GitClientPath.Replace('\', '/'))';

const client = new GitClaudeClient({
    projectPath: '$($ProjectPath.Replace('\', '/'))'
});

// Note: In a real implementation, you'd get session credentials from Claude Desktop
// For now, we'll use the direct Git analysis functionality
try {
    const result = await client.analyzeGitStatus($($IncludeDiff.IsPresent.ToString().ToLower()));
    console.log(JSON.stringify(result, null, 2));
} catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
}
"@
    
    try {
        $result = node -e $nodeCommand
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ Git status analysis completed" $Green
            $result | ConvertFrom-Json | Format-Table -AutoSize
        } else {
            Write-ColorOutput "❌ Git status analysis failed" $Red
            Write-Host $result
        }
    } catch {
        Write-ColorOutput "❌ Failed to execute Git analysis: $($_.Exception.Message)" $Red
    }
}

function Invoke-SmartCommit {
    Write-ColorOutput "`n🎯 Generating smart commit message..." $Cyan
    
    # First check if there are staged changes
    $stagedFiles = git diff --cached --name-only
    if (-not $stagedFiles) {
        Write-ColorOutput "❌ No staged changes found. Use 'git add' to stage files first." $Red
        return
    }
    
    Write-ColorOutput "📁 Staged files:" $Yellow
    $stagedFiles | ForEach-Object { Write-Host "  • $_" }
    
    # Generate commit message using Claude
    $nodeCommand = @"
import GitClaudeClient from '$($GitClientPath.Replace('\', '/'))';

const client = new GitClaudeClient({
    projectPath: '$($ProjectPath.Replace('\', '/'))'
});

try {
    const result = await client.smartCommit('$CommitType', $($AutoCommit.IsPresent.ToString().ToLower()));
    console.log(JSON.stringify(result, null, 2));
} catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
}
"@
    
    try {
        $result = node -e $nodeCommand | ConvertFrom-Json
        
        Write-ColorOutput "`n📝 Suggested commit message:" $Cyan
        Write-Host "  `"$($result.suggested_commit_message)`"" -ForegroundColor White
        
        if ($result.commit_executed) {
            Write-ColorOutput "`n✅ Commit executed successfully! Hash: $($result.commit_hash)" $Green
        } elseif (-not $AutoCommit) {
            Write-ColorOutput "`n💡 To execute this commit, run:" $Yellow
            Write-Host "  git commit -m `"$($result.suggested_commit_message)`""
        }
        
    } catch {
        Write-ColorOutput "❌ Smart commit generation failed: $($_.Exception.Message)" $Red
    }
}

function Invoke-BranchWorkflow {
    if (-not $BranchName) {
        Write-ColorOutput "❌ Branch name is required for branch operations. Use -BranchName parameter." $Red
        return
    }
    
    Write-ColorOutput "`n🌿 Creating feature branch: $BranchName..." $Cyan
    
    $nodeCommand = @"
import GitClaudeClient from '$($GitClientPath.Replace('\', '/'))';

const client = new GitClaudeClient({
    projectPath: '$($ProjectPath.Replace('\', '/'))'
});

try {
    const result = await client.createFeatureBranch('$BranchName');
    console.log(JSON.stringify(result, null, 2));
} catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
}
"@
    
    try {
        $result = node -e $nodeCommand | ConvertFrom-Json
        
        Write-ColorOutput "✅ Feature branch created successfully!" $Green
        Write-ColorOutput "📋 Commands executed:" $Cyan
        $result.executed_commands | ForEach-Object { Write-Host "  • $_" }
        
    } catch {
        Write-ColorOutput "❌ Branch creation failed: $($_.Exception.Message)" $Red
    }
}

function Invoke-AutomatedWorkflow {
    Write-ColorOutput "`n🤖 Starting automated Git workflow..." $Cyan
    
    $nodeCommand = @"
import GitClaudeClient from '$($GitClientPath.Replace('\', '/'))';

const client = new GitClaudeClient({
    projectPath: '$($ProjectPath.Replace('\', '/'))'
});

try {
    const result = await client.automatedWorkflow({
        analyzeDiff: $($IncludeDiff.IsPresent.ToString().ToLower()),
        commitType: '$CommitType',
        autoCommit: $($AutoCommit.IsPresent.ToString().ToLower()),
        checkMergeReady: $($CheckMerge.IsPresent.ToString().ToLower())
    });
    console.log(JSON.stringify(result, null, 2));
} catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
}
"@
    
    try {
        $result = node -e $nodeCommand
        Write-ColorOutput "✅ Automated workflow completed successfully!" $Green
        
    } catch {
        Write-ColorOutput "❌ Automated workflow failed: $($_.Exception.Message)" $Red
    }
}

function Show-Help {
    Write-ColorOutput "`n🔧 Git Automation with Claude Code - Help" $Cyan
    Write-Host @"

USAGE:
    git-claude-automation.ps1 -Action <action> [parameters]

ACTIONS:
    status      - Analyze Git repository status
    commit      - Generate and optionally execute smart commits
    branch      - Create feature branches with best practices
    workflow    - Run complete automated Git workflow
    help        - Show this help message

PARAMETERS:
    -ProjectPath <path>     - Path to Git repository (default: current directory)
    -BranchName <name>      - Name for new branch (required for 'branch' action)
    -CommitType <type>      - Commit message style: conventional, descriptive, concise
    -AutoCommit             - Automatically execute generated commits
    -IncludeDiff            - Include diff analysis in status reports
    -CheckMerge             - Check if branch is ready for merge

EXAMPLES:
    # Analyze current repository status
    .\git-claude-automation.ps1 -Action status -IncludeDiff

    # Generate a smart commit message
    .\git-claude-automation.ps1 -Action commit -CommitType conventional

    # Create a feature branch
    .\git-claude-automation.ps1 -Action branch -BranchName "feature/new-functionality"

    # Run complete automated workflow
    .\git-claude-automation.ps1 -Action workflow -IncludeDiff -CheckMerge

PREREQUISITES:
    - Claude Desktop running with your extension
    - MCP server responding on localhost:4323
    - Git installed and repository initialized
    - Node.js for executing automation scripts

"@ -ForegroundColor White
}

# Main execution
function Main {
    Write-ColorOutput "🚀 Git Automation with Claude Code" $Cyan
    Write-ColorOutput "Project: $ProjectPath`n" $Yellow
    
    if ($Action -eq "help") {
        Show-Help
        return
    }
    
    if (-not (Test-Prerequisites)) {
        Write-ColorOutput "`n❌ Prerequisites check failed. Please resolve the issues above." $Red
        return
    }
    
    switch ($Action) {
        "status" { Invoke-GitStatusAnalysis }
        "commit" { Invoke-SmartCommit }
        "branch" { Invoke-BranchWorkflow }
        "workflow" { Invoke-AutomatedWorkflow }
        default { 
            Write-ColorOutput "❌ Unknown action: $Action" $Red
            Show-Help
        }
    }
}

# Execute main function
Main
