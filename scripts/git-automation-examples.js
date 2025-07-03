// git-automation-examples.js
// Practical examples of Git automation using Claude Code and Claude Desktop

import GitClaudeClient from './git-claude-client.js';

// Example 1: Basic Git Status Analysis
async function example1_BasicAnalysis() {
  console.log('🔍 Example 1: Basic Git Status Analysis');
  
  const gitClient = new GitClaudeClient({
    host: 'localhost',
    port: 4323,
    projectPath: 'C:\\_GPT\\Claude_Automation' // Your project path
  });

  // Set session credentials (you'll need to get these from Claude Desktop)
  gitClient.setSession('your_session_id', 'your_session_token');

  try {
    await gitClient.analyzeGitStatus(true); // Include diff analysis
  } catch (err) {
    console.error('Example 1 failed:', err.message);
  }
}

// Example 2: Smart Commit Generation
async function example2_SmartCommit() {
  console.log('\n🎯 Example 2: Smart Commit Generation');
  
  const gitClient = new GitClaudeClient({
    projectPath: process.cwd()
  });

  gitClient.setSession('your_session_id', 'your_session_token');

  try {
    // Generate commit message but don't auto-commit
    const result = await gitClient.smartCommit('conventional', false);
    
    console.log('\nGenerated commit message:', result.suggested_commit_message);
    console.log('To commit manually, run:');
    console.log(`git commit -m "${result.suggested_commit_message}"`);
    
  } catch (err) {
    console.error('Example 2 failed:', err.message);
  }
}

// Example 3: Feature Branch Workflow
async function example3_FeatureBranch() {
  console.log('\n🌿 Example 3: Feature Branch Creation');
  
  const gitClient = new GitClaudeClient({
    projectPath: 'C:\\_GPT\\Claude_Automation'
  });

  gitClient.setSession('your_session_id', 'your_session_token');

  try {
    const branchName = `feature/git-automation-${Date.now()}`;
    await gitClient.createFeatureBranch(branchName);
    
  } catch (err) {
    console.error('Example 3 failed:', err.message);
  }
}

// Example 4: Complete Automated Workflow
async function example4_AutomatedWorkflow() {
  console.log('\n🤖 Example 4: Complete Automated Workflow');
  
  const gitClient = new GitClaudeClient({
    projectPath: process.cwd()
  });

  gitClient.setSession('your_session_id', 'your_session_token');

  try {
    const workflowResults = await gitClient.automatedWorkflow({
      analyzeDiff: true,
      commitType: 'conventional',
      autoCommit: false, // Set to true for automatic commits
      checkMergeReady: true
    });
    
    console.log('\n📊 Workflow Summary:');
    console.log('- Status analysis:', workflowResults.status ? '✅' : '❌');
    console.log('- Commit generation:', workflowResults.commit ? '✅' : '❌');
    console.log('- Merge check:', workflowResults.mergeCheck ? '✅' : '❌');
    
  } catch (err) {
    console.error('Example 4 failed:', err.message);
  }
}

// Example 5: WSL-Windows Cross-Boundary Git Operations
async function example5_CrossBoundaryGit() {
  console.log('\n🌉 Example 5: WSL-Windows Cross-Boundary Git Operations');
  
  // This example shows how to work with Git repos that span WSL and Windows
  const windowsPath = 'C:\\_GPT\\Claude_Automation';
  const wslPath = '/mnt/c/_GPT/Claude_Automation';
  
  const gitClient = new GitClaudeClient();
  gitClient.setSession('your_session_id', 'your_session_token');

  try {
    // Analyze from Windows perspective
    console.log('\n📋 Windows perspective:');
    gitClient.setProjectPath(windowsPath);
    const windowsAnalysis = await gitClient.analyzeGitStatus();
    
    // The bridge will handle path translation for WSL operations
    console.log('\n🐧 WSL perspective (via bridge):');
    gitClient.setProjectPath(wslPath);
    const wslAnalysis = await gitClient.analyzeGitStatus();
    
    console.log('\n🔄 Cross-boundary analysis complete');
    
  } catch (err) {
    console.error('Example 5 failed:', err.message);
  }
}

// Main execution function
async function main() {
  console.log('🚀 Git Automation with Claude Code Examples\n');
  console.log('Make sure your Claude Desktop Extension is running with the Git plugin loaded.\n');
  
  try {
    await example1_BasicAnalysis();
    await example2_SmartCommit();
    await example3_FeatureBranch();
    await example4_AutomatedWorkflow();
    await example5_CrossBoundaryGit();
    
    console.log('\n✅ All examples completed!');
    
  } catch (err) {
    console.error('\n❌ Example execution failed:', err.message);
  }
}

// Export for use in other scripts
export {
  example1_BasicAnalysis,
  example2_SmartCommit,
  example3_FeatureBranch,
  example4_AutomatedWorkflow,
  example5_CrossBoundaryGit
};

// Run examples if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
