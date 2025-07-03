// git-claude-client.js
// Specialized client for Git automation using Claude Code and Claude Desktop integration

import ClaudeCodeClient from './claude-code-client.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class GitClaudeClient extends ClaudeCodeClient {
  constructor(options = {}) {
    super(options);
    this.projectPath = options.projectPath || process.cwd();
  }

  /**
   * Analyze the current Git repository status
   * @param {boolean} includeDiff - Whether to include diff analysis
   * @returns {Promise<object>} Git status analysis
   */
  async analyzeGitStatus(includeDiff = false) {
    try {
      const result = await this.executeAction('git_status_analysis', {
        project_path: this.projectPath,
        include_diff: includeDiff
      });
      
      console.log('\n📊 Git Repository Analysis:');
      console.log(`Repository: ${result.repository_path}`);
      console.log(`Branch: ${result.branch_info}`);
      console.log(`Total Changes: ${result.total_changes}`);
      
      if (result.changes.staged.length > 0) {
        console.log(`✅ Staged files (${result.changes.staged.length}):`, result.changes.staged);
      }
      
      if (result.changes.modified.length > 0) {
        console.log(`📝 Modified files (${result.changes.modified.length}):`, result.changes.modified);
      }
      
      if (result.changes.untracked.length > 0) {
        console.log(`❓ Untracked files (${result.changes.untracked.length}):`, result.changes.untracked);
      }
      
      if (result.suggestions.length > 0) {
        console.log('\n💡 Suggestions:');
        result.suggestions.forEach(suggestion => console.log(`  • ${suggestion}`));
      }
      
      return result;
    } catch (err) {
      console.error('❌ Git analysis failed:', err.message);
      throw err;
    }
  }

  /**
   * Generate and optionally execute a smart commit
   * @param {string} commitType - Type of commit message (conventional, descriptive, concise)
   * @param {boolean} autoCommit - Whether to automatically execute the commit
   * @returns {Promise<object>} Commit result
   */
  async smartCommit(commitType = 'conventional', autoCommit = false) {
    try {
      const result = await this.executeAction('git_smart_commit', {
        project_path: this.projectPath,
        commit_type: commitType,
        auto_commit: autoCommit
      });
      
      console.log('\n🎯 Smart Commit Analysis:');
      console.log(`Staged files (${result.staged_files.length}):`, result.staged_files);
      console.log(`\n📝 Suggested commit message:\n"${result.suggested_commit_message}"`);
      
      if (result.commit_executed) {
        console.log(`✅ Commit executed successfully! Hash: ${result.commit_hash}`);
      } else if (!autoCommit) {
        console.log('\n💡 To execute this commit, run:');
        console.log(`git commit -m "${result.suggested_commit_message}"`);
      }
      
      if (result.commit_error) {
        console.error('❌ Commit execution failed:', result.commit_error);
      }
      
      return result;
    } catch (err) {
      console.error('❌ Smart commit failed:', err.message);
      throw err;
    }
  }

  /**
   * Create a new feature branch with best practices
   * @param {string} branchName - Name of the new feature branch
   * @returns {Promise<object>} Branch creation result
   */
  async createFeatureBranch(branchName) {
    try {
      const result = await this.executeAction('git_branch_workflow', {
        project_path: this.projectPath,
        action: 'create_feature',
        branch_name: branchName
      });
      
      console.log('\n🌿 Feature Branch Created:');
      console.log(`Branch: ${result.new_branch}`);
      console.log(`Message: ${result.message}`);
      console.log('\n📋 Commands executed:');
      result.executed_commands.forEach(cmd => console.log(`  • ${cmd}`));
      
      return result;
    } catch (err) {
      console.error('❌ Feature branch creation failed:', err.message);
      throw err;
    }
  }

  /**
   * Check if the current branch is ready for merge
   * @returns {Promise<object>} Merge readiness check
   */
  async checkMergeReady() {
    try {
      const result = await this.executeAction('git_branch_workflow', {
        project_path: this.projectPath,
        action: 'merge_ready_check'
      });
      
      console.log('\n🔍 Merge Readiness Check:');
      console.log(`Clean working directory: ${result.clean_working_directory ? '✅' : '❌'}`);
      console.log(`Unpushed commits: ${result.unpushed_commits.length}`);
      console.log(`Ready for merge: ${result.ready_for_merge ? '✅' : '❌'}`);
      
      if (!result.ready_for_merge && result.blocking_issues) {
        console.log('\n🚫 Blocking issues:');
        result.blocking_issues.forEach(issue => console.log(`  • ${issue}`));
      }
      
      if (result.unpushed_commits.length > 0) {
        console.log('\n📤 Unpushed commits:');
        result.unpushed_commits.forEach(commit => console.log(`  • ${commit}`));
      }
      
      return result;
    } catch (err) {
      console.error('❌ Merge readiness check failed:', err.message);
      throw err;
    }
  }

  /**
   * Complete Git workflow automation
   * @param {object} options - Workflow options
   * @returns {Promise<object>} Workflow results
   */
  async automatedWorkflow(options = {}) {
    const {
      analyzeDiff = true,
      commitType = 'conventional',
      autoCommit = false,
      checkMergeReady = false
    } = options;

    console.log('\n🤖 Starting Automated Git Workflow...');
    const results = {};

    try {
      // Step 1: Analyze current status
      console.log('\n1️⃣ Analyzing Git status...');
      results.status = await this.analyzeGitStatus(analyzeDiff);

      // Step 2: Generate smart commit if there are staged changes
      if (results.status.changes.staged.length > 0) {
        console.log('\n2️⃣ Generating smart commit...');
        results.commit = await this.smartCommit(commitType, autoCommit);
      } else {
        console.log('\n2️⃣ No staged changes for commit');
      }

      // Step 3: Check merge readiness if requested
      if (checkMergeReady) {
        console.log('\n3️⃣ Checking merge readiness...');
        results.mergeCheck = await this.checkMergeReady();
      }

      console.log('\n✅ Automated Git workflow completed successfully!');
      return results;

    } catch (err) {
      console.error('\n❌ Automated workflow failed:', err.message);
      throw err;
    }
  }

  /**
   * Set the project path for Git operations
   * @param {string} projectPath - Path to the Git repository
   */
  setProjectPath(projectPath) {
    this.projectPath = projectPath;
  }
}

export default GitClaudeClient;
