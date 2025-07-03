// git-automation-plugin.js
// Plugin that provides Git automation tools through Claude Code and Claude Desktop

import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Claude directories for cross-boundary communication
const claudeDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Claude');
const sessionStatePath = path.join(claudeDir, 'session_state.json');
const gitTriggerDir = path.join(claudeDir, 'git_triggers');

// Ensure git trigger directory exists
if (!fs.existsSync(gitTriggerDir)) {
  fs.mkdirSync(gitTriggerDir, { recursive: true });
}

// Git automation tools
const gitTools = [
  {
    name: "git_status_analysis",
    description: "Analyze Git repository status and suggest actions",
    parameters: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to the Git repository"
        },
        include_diff: {
          type: "boolean",
          description: "Include diff analysis in the response",
          default: false
        }
      },
      required: ["project_path"]
    },
    handler: async (params) => {
      const { project_path, include_diff = false } = params;
      
      try {
        // Check if it's a Git repository
        const { stdout: gitRoot } = await execAsync('git rev-parse --show-toplevel', { 
          cwd: project_path 
        });
        
        const repoPath = gitRoot.trim();
        
        // Get Git status
        const { stdout: statusOutput } = await execAsync('git status --porcelain -b', { 
          cwd: repoPath 
        });
        
        // Parse status
        const lines = statusOutput.split('\n').filter(line => line.trim());
        const branchLine = lines[0];
        const fileChanges = lines.slice(1);
        
        const analysis = {
          repository_path: repoPath,
          branch_info: branchLine,
          changes: {
            modified: fileChanges.filter(line => line.startsWith(' M')).map(line => line.substring(3)),
            added: fileChanges.filter(line => line.startsWith('A ')).map(line => line.substring(2)),
            deleted: fileChanges.filter(line => line.startsWith(' D')).map(line => line.substring(3)),
            untracked: fileChanges.filter(line => line.startsWith('??')).map(line => line.substring(3)),
            staged: fileChanges.filter(line => line.startsWith('M ') || line.startsWith('A ') || line.startsWith('D ')).map(line => line.substring(2))
          },
          total_changes: fileChanges.length,
          suggestions: []
        };
        
        // Add suggestions based on status
        if (analysis.changes.untracked.length > 0) {
          analysis.suggestions.push("Consider adding untracked files with 'git add .' or review individually");
        }
        
        if (analysis.changes.staged.length > 0) {
          analysis.suggestions.push("Staged changes ready for commit. Consider using 'claude commit' for AI-generated message");
        }
        
        if (analysis.changes.modified.length > 0) {
          analysis.suggestions.push("Modified files detected. Use 'claude review' to analyze changes before committing");
        }
        
        // Include diff if requested
        if (include_diff && analysis.total_changes > 0) {
          try {
            const { stdout: diffOutput } = await execAsync('git diff HEAD', { 
              cwd: repoPath 
            });
            analysis.diff_summary = diffOutput.substring(0, 2000) + (diffOutput.length > 2000 ? '\n...(truncated)' : '');
          } catch (diffErr) {
            analysis.diff_error = diffErr.message;
          }
        }
        
        // Store in session state for other tools to use
        let sessionState = {};
        try {
          if (fs.existsSync(sessionStatePath)) {
            sessionState = JSON.parse(fs.readFileSync(sessionStatePath, 'utf8'));
          }
        } catch (err) {
          // Handle session state read error
        }
        
        sessionState.last_git_analysis = {
          timestamp: Date.now(),
          repository: repoPath,
          analysis: analysis
        };
        
        fs.writeFileSync(sessionStatePath, JSON.stringify(sessionState, null, 2));
        
        return analysis;
        
      } catch (err) {
        throw new Error(`Git analysis failed: ${err.message}`);
      }
    }
  },
  
  {
    name: "git_smart_commit",
    description: "Generate intelligent commit messages based on staged changes",
    parameters: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to the Git repository"
        },
        commit_type: {
          type: "string",
          enum: ["conventional", "descriptive", "concise"],
          description: "Style of commit message to generate",
          default: "conventional"
        },
        auto_commit: {
          type: "boolean",
          description: "Whether to automatically execute the commit",
          default: false
        }
      },
      required: ["project_path"]
    },
    handler: async (params) => {
      const { project_path, commit_type = "conventional", auto_commit = false } = params;
      
      try {
        // Get staged changes diff
        const { stdout: stagedDiff } = await execAsync('git diff --cached', { 
          cwd: project_path 
        });
        
        if (!stagedDiff.trim()) {
          throw new Error("No staged changes found. Use 'git add' to stage files first.");
        }
        
        // Get list of staged files
        const { stdout: stagedFiles } = await execAsync('git diff --cached --name-only', { 
          cwd: project_path 
        });
        
        const files = stagedFiles.trim().split('\n').filter(f => f);
        
        // Analyze the changes to generate appropriate commit message
        const changeAnalysis = analyzeChanges(stagedDiff, files);
        const commitMessage = generateCommitMessage(changeAnalysis, commit_type);
        
        const result = {
          staged_files: files,
          change_analysis: changeAnalysis,
          suggested_commit_message: commitMessage,
          commit_executed: false
        };
        
        // Auto-commit if requested
        if (auto_commit) {
          try {
            await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { 
              cwd: project_path 
            });
            result.commit_executed = true;
            result.commit_hash = await execAsync('git rev-parse HEAD', { cwd: project_path }).then(r => r.stdout.trim().substring(0, 8));
          } catch (commitErr) {
            result.commit_error = commitErr.message;
          }
        }
        
        return result;
        
      } catch (err) {
        throw new Error(`Smart commit failed: ${err.message}`);
      }
    }
  },
  
  {
    name: "git_branch_workflow",
    description: "Manage Git branch workflows with intelligent suggestions",
    parameters: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to the Git repository"
        },
        action: {
          type: "string",
          enum: ["create_feature", "merge_ready_check", "cleanup_branches", "sync_main"],
          description: "Type of branch workflow action"
        },
        branch_name: {
          type: "string",
          description: "Branch name (required for create_feature action)"
        }
      },
      required: ["project_path", "action"]
    },
    handler: async (params) => {
      const { project_path, action, branch_name } = params;
      
      try {
        const result = { action, executed_commands: [] };
        
        switch (action) {
          case "create_feature":
            if (!branch_name) {
              throw new Error("branch_name is required for create_feature action");
            }
            
            // Ensure we're on main/master and up to date
            const { stdout: currentBranch } = await execAsync('git branch --show-current', { cwd: project_path });
            const mainBranch = currentBranch.trim() === 'main' ? 'main' : 'master';
            
            if (currentBranch.trim() !== mainBranch) {
              await execAsync(`git checkout ${mainBranch}`, { cwd: project_path });
              result.executed_commands.push(`git checkout ${mainBranch}`);
            }
            
            await execAsync('git pull origin HEAD', { cwd: project_path });
            result.executed_commands.push('git pull origin HEAD');
            
            await execAsync(`git checkout -b ${branch_name}`, { cwd: project_path });
            result.executed_commands.push(`git checkout -b ${branch_name}`);
            
            result.new_branch = branch_name;
            result.message = `Created and switched to feature branch: ${branch_name}`;
            break;
            
          case "merge_ready_check":
            // Check if branch is ready for merge
            const { stdout: branchStatus } = await execAsync('git status --porcelain', { cwd: project_path });
            const { stdout: unpushedCommits } = await execAsync('git log @{u}..HEAD --oneline', { cwd: project_path });
            
            result.clean_working_directory = branchStatus.trim() === '';
            result.unpushed_commits = unpushedCommits.trim().split('\n').filter(line => line.trim());
            result.ready_for_merge = result.clean_working_directory && result.unpushed_commits.length === 0;
            
            if (!result.ready_for_merge) {
              result.blocking_issues = [];
              if (!result.clean_working_directory) {
                result.blocking_issues.push("Working directory has uncommitted changes");
              }
              if (result.unpushed_commits.length > 0) {
                result.blocking_issues.push("Branch has unpushed commits");
              }
            }
            break;
            
          default:
            throw new Error(`Unknown branch workflow action: ${action}`);
        }
        
        return result;
        
      } catch (err) {
        throw new Error(`Branch workflow failed: ${err.message}`);
      }
    }
  }
];

// Helper functions
function analyzeChanges(diff, files) {
  const analysis = {
    files_modified: files.length,
    types: [],
    scope: 'multiple'
  };
  
  // Detect types of changes
  if (files.some(f => f.includes('test') || f.includes('spec'))) {
    analysis.types.push('test');
  }
  if (files.some(f => f.includes('doc') || f.includes('README'))) {
    analysis.types.push('docs');
  }
  if (files.some(f => f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.py'))) {
    analysis.types.push('feat');
  }
  if (diff.includes('fix') || diff.includes('bug')) {
    analysis.types.push('fix');
  }
  
  // Determine scope
  if (files.length === 1) {
    analysis.scope = path.basename(files[0], path.extname(files[0]));
  } else if (files.every(f => f.startsWith('src/'))) {
    analysis.scope = 'src';
  } else if (files.every(f => f.startsWith('docs/'))) {
    analysis.scope = 'docs';
  }
  
  return analysis;
}

function generateCommitMessage(analysis, type) {
  const primaryType = analysis.types[0] || 'chore';
  const scope = analysis.scope !== 'multiple' ? `(${analysis.scope})` : '';
  
  switch (type) {
    case 'conventional':
      return `${primaryType}${scope}: update ${analysis.files_modified} file${analysis.files_modified > 1 ? 's' : ''}`;
    case 'descriptive':
      return `Update ${analysis.files_modified} file${analysis.files_modified > 1 ? 's' : ''} with ${primaryType} changes`;
    case 'concise':
      return `${primaryType}: ${analysis.scope} updates`;
    default:
      return `Update ${analysis.files_modified} files`;
  }
}

// Plugin export
export default {
  name: 'git-automation',
  version: '1.0.0',
  description: 'Provides Git automation tools for Claude Desktop and Claude Code integration',
  tools: gitTools
};
