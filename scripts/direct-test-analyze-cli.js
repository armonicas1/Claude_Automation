// Test script to analyze Claude Code CLI
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runCommand(command) {
  try {
    const { stdout, stderr } = await execAsync(command, { timeout: 10000 });
    return stdout || stderr;
  } catch (error) {
    console.error(`Error running command "${command}": ${error.message}`);
    return null;
  }
}

async function analyzeInstallation() {
  const results = {
    status: 'unknown',
    installations_found: [],
    npm_global_packages: [],
    wsl_details: null,
    recommendations: [],
    error: null
  };

  try {
    // Common paths where Claude might be installed
    const commonPaths = [
      '/usr/local/bin/claude',
      '/usr/bin/claude',
      `${os.homedir()}/.local/bin/claude`,
      'C:\\Users\\dimas\\AppData\\Roaming\\npm\\claude.cmd',
      'C:\\Program Files\\nodejs\\claude.cmd'
    ];

    // Check standard paths
    for (const cmdPath of commonPaths) {
      if (fs.existsSync(cmdPath)) {
        results.installations_found.push({
          path: cmdPath,
          type: 'binary'
        });
      }
    }

    // Check npm global packages
    try {
      const npmList = await runCommand('npm list -g @anthropic-ai/claude-code --json 2>/dev/null');
      if (npmList) {
        const packages = JSON.parse(npmList);
        if (packages.dependencies && packages.dependencies['@anthropic-ai/claude-code']) {
          results.npm_global_packages.push(packages.dependencies['@anthropic-ai/claude-code']);
        }
      }
    } catch (err) {
      // npm not available or no global packages
    }
    
    // Check for WSL Toolkit installation specifically
    try {
      const wslToolkitDetails = await checkWslToolkit();
      if (wslToolkitDetails.found) {
        results.installations_found.push({
          path: wslToolkitDetails.paths[0],
          type: 'wsl-toolkit',
          version: wslToolkitDetails.version,
          launchCommand: wslToolkitDetails.launchCommand
        });
        
        // Add WSL details to the results
        results.wsl_details = {
          wslInstalled: wslToolkitDetails.wslInstalled,
          ubuntu24Installed: wslToolkitDetails.ubuntu24Installed,
          toolkitPath: wslToolkitDetails.paths[0]
        };
      }
    } catch (err) {
      // WSL toolkit check failed
    }

    // Determine status
    if (results.installations_found.length > 0) {
      results.status = 'installed';
      results.recommendations.push('Claude Code CLI is installed and available');
    } else {
      results.status = 'not_installed';
      results.recommendations.push('Claude Code CLI not found. Install with: npm install -g @anthropic-ai/claude-code');
    }

    return results;
  } catch (error) {
    results.status = 'error';
    results.error = error.message;
    return results;
  }
}

async function checkWslToolkit() {
  const results = {
    found: false,
    paths: [],
    version: null,
    launchCommand: null,
    error: null
  };
  
  try {
    // Check Desktop folder for WSL toolkit
    const desktopDir = path.join(os.homedir(), 'Desktop');
    const possibleDirs = ['CLAUDE CODE ToolKIT WSL Edition', 'Claude CODE ToolKIT WSL Edition', 'Claude_Code_WSL_Toolkit'];
    
    for (const dir of possibleDirs) {
      const toolkitPath = path.join(desktopDir, dir);
      const launchScript = path.join(toolkitPath, 'run-claude-code.bat');
      
      if (fs.existsSync(launchScript)) {
        results.found = true;
        results.paths.push(launchScript);
        results.launchCommand = `"${launchScript}"`;
        
        // Try to get version
        try {
          // First attempt with direct --version flag
          let versionOutput = await runCommand(`"${launchScript}" --version`);
          
          // If that fails, try wsl version detection
          if (!versionOutput || !versionOutput.includes('version')) {
            versionOutput = await runCommand('wsl -- claude --version');
          }
          
          if (versionOutput && versionOutput.includes('version')) {
            results.version = versionOutput.trim();
          } else {
            // If all else fails, mark as toolkit without version info
            results.version = "WSL Toolkit (version unknown)";
          }
        } catch (err) {
          // Version check failed, still mark as found but unknown version
          results.version = "WSL Toolkit (version unknown)";
        }
        
        // Once we find a toolkit, stop looking (avoids duplicates)
        break;
      }
    }
    
    // Check if WSL is installed
    try {
      const wslCheck = await runCommand('wsl --version');
      if (wslCheck && !wslCheck.includes('not installed')) {
        results.wslInstalled = true;
        
        // Check Ubuntu distribution
        const wslList = await runCommand('wsl -l -v');
        if (wslList && wslList.includes('Ubuntu-24.04')) {
          results.ubuntu24Installed = true;
        }
      }
    } catch (err) {
      results.wslInstalled = false;
    }
    
    return results;
  } catch (error) {
    results.error = error.message;
    return results;
  }
}

// Run the analysis
async function main() {
  console.log("Starting Claude Code CLI analysis...");
  const result = await analyzeInstallation();
  
  // Write the result to a file
  fs.writeFileSync(
    path.join(__dirname, 'direct-analysis-result.json'),
    JSON.stringify(result, null, 2)
  );
  
  console.log("\nAnalysis complete!");
  console.log(`Found ${result.installations_found.length} installations:`);
  result.installations_found.forEach((inst, i) => {
    console.log(`${i+1}. ${inst.type}: ${inst.path}`);
    if (inst.version) console.log(`   Version: ${inst.version}`);
    if (inst.launchCommand) console.log(`   Launch: ${inst.launchCommand}`);
  });
  
  console.log("\nRecommendations:");
  result.recommendations.forEach((rec, i) => {
    console.log(`- ${rec}`);
  });
  
  console.log("\nComplete result written to direct-analysis-result.json");
}

main().catch(err => {
  console.error("Error during analysis:", err);
  process.exit(1);
});
