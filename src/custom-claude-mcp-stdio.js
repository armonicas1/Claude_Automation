#!/usr/bin/env node

// custom-claude-mcp-stdio.js
// Stdio-based MCP server for Claude Desktop integration

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';

// WSL Authentication Auto-Detection
function detectAndSetWslAuth() {
  // Only auto-detect if ANTHROPIC_API_KEY is not already set
  if (process.env.ANTHROPIC_API_KEY) {
    return;
  }

  // Try multiple paths based on platform
  const wslCredentialsPaths = [
    '/home/dimas/.claude/.credentials.json',  // Direct WSL path (if running in WSL)
    'C:\\Users\\dimas\\AppData\\Local\\Packages\\CanonicalGroupLimited.Ubuntu24.04LTS_79rhkp1fndgsc\\LocalState\\rootfs\\home\\dimas\\.claude\\.credentials.json',  // Windows to WSL path
    '\\\\wsl$\\Ubuntu-24.04\\home\\dimas\\.claude\\.credentials.json',  // WSL network path
    '\\\\wsl.localhost\\Ubuntu-24.04\\home\\dimas\\.claude\\.credentials.json'  // Alternative WSL network path
  ];
  
  try {
    for (const credentialsPath of wslCredentialsPaths) {
      if (fs.existsSync(credentialsPath)) {
        const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        
        if (credentials.claudeAiOauth && credentials.claudeAiOauth.accessToken) {
          process.env.ANTHROPIC_API_KEY = credentials.claudeAiOauth.accessToken;
          process.env.CLAUDE_API_KEY = credentials.claudeAiOauth.accessToken;
          
          // Log to file only (stderr would interfere with stdio MCP)
          const logMessage = `[${new Date().toISOString()}] INFO: Auto-detected WSL Claude Code credentials from ${credentialsPath}\n`;
          const logPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'logs', 'mcp-server-stdio.log');
          fs.appendFileSync(logPath, logMessage);
          return; // Success, exit early
        }
      }
    }
  } catch (error) {
    // Silently fail - this is auto-detection, not critical
  }
}

// Run WSL auth detection immediately
detectAndSetWslAuth();

// Calculate absolute paths regardless of working directory
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const CONFIG_PATH = path.join(PROJECT_ROOT, 'config', 'claude-config.json');
const PLUGINS_DIR = path.join(PROJECT_ROOT, 'plugins');
const LOG_DIR = path.join(PROJECT_ROOT, 'logs');

// Ensure directories exist
if (!fs.existsSync(path.join(PROJECT_ROOT, 'config'))) {
  fs.mkdirSync(path.join(PROJECT_ROOT, 'config'), { recursive: true });
}
if (!fs.existsSync(PLUGINS_DIR)) {
  fs.mkdirSync(PLUGINS_DIR, { recursive: true });
}
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Default config if not exists
const defaultConfig = {
  mcpPort: 4323,
  toolsPort: 4322,
  logLevel: 'info'
};

// Load or create configuration
let config = defaultConfig;
try {
  if (fs.existsSync(CONFIG_PATH)) {
    config = { ...defaultConfig, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
  } else {
    // Create default config if doesn't exist
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
  }
} catch (err) {
  // Log to stderr since stdout is used for MCP communication
  console.error('Error loading configuration:', err);
}

// Setup logging to file only (not console to avoid interfering with stdio)
const logFile = fs.createWriteStream(path.join(LOG_DIR, 'mcp-server-stdio.log'), { flags: 'a' });

const logger = {
  info: (message) => {
    const timestamp = new Date().toISOString();
    logFile.write(`[${timestamp}] INFO: ${message}\n`);
  },
  error: (message) => {
    const timestamp = new Date().toISOString();
    logFile.write(`[${timestamp}] ERROR: ${message}\n`);
    // Also log to stderr for debugging
    console.error(`[${timestamp}] ERROR: ${message}`);
  }
};

logger.info('Starting stdio MCP server');

// Claude Code CLI Analysis Functions
async function analyzeClaudeCodeCLI(analysisType, projectPath = null) {
  const results = {
    analysis_type: analysisType,
    timestamp: new Date().toISOString(),
    project_path: projectPath,
    results: {}
  };

  try {
    switch (analysisType) {
      case 'installation':
        results.results = await analyzeInstallation();
        break;
      case 'configuration':
        results.results = await analyzeConfiguration(projectPath);
        break;
      case 'usage':
        results.results = await analyzeUsage(projectPath);
        break;
      case 'troubleshooting':
        results.results = await analyzeTroubleshooting(projectPath);
        break;
      case 'full':
        results.results = {
          installation: await analyzeInstallation(),
          configuration: await analyzeConfiguration(projectPath),
          usage: await analyzeUsage(projectPath),
          troubleshooting: await analyzeTroubleshooting(projectPath)
        };
        break;
      default:
        throw new Error(`Unknown analysis type: ${analysisType}`);
    }

    return results;
  } catch (error) {
    logger.error(`Error in analyzeClaudeCodeCLI: ${error.message}`);
    throw error;
  }
}

async function analyzeInstallation() {
  const results = {
    status: 'unknown',
    installations_found: [],
    npm_global_packages: [],
    recommendations: []
  };

  try {
    // Check for Claude Code in common installation paths
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

    // Check WSL installations
    try {
      // Check if WSL has Claude Code CLI binary
      const wslCheck = await runCommand('wsl -- which claude');
      if (wslCheck && wslCheck.trim() && !wslCheck.includes('not found')) {
        results.installations_found.push({
          path: wslCheck.trim(),
          type: 'wsl'
        });
      }
    } catch (err) {
      // WSL binary check failed, try npm approach
    }

    try {
      // Check WSL npm global packages
      const wslNpmCheck = await runCommand('wsl -- npm list -g @anthropic-ai/claude-code');
      if (wslNpmCheck && wslNpmCheck.includes('@anthropic-ai/claude-code')) {
        results.installations_found.push({
          path: 'WSL npm global: @anthropic-ai/claude-code',
          type: 'wsl-npm'
        });
      }
    } catch (err) {
      // WSL npm check failed
    }
    
    try {
      // Try multiple distribution naming conventions
      const distributions = [
        'Ubuntu-24.04',
        'Ubuntu 24.04',
        'Ubuntu',
        'Ubuntu-24',
        'Ubuntu-22.04'  // Even try previous version as last resort
      ];
      
      for (const dist of distributions) {
        try {
          const wslUbuntuCheck = await runCommand(`wsl -d "${dist}" -- which claude`);
          if (wslUbuntuCheck && wslUbuntuCheck.trim() && !wslUbuntuCheck.includes('not found')) {
            results.installations_found.push({
              path: `${dist}: ${wslUbuntuCheck.trim()}`,
              type: 'wsl-ubuntu'
            });
            logger.info(`Found Claude CLI in WSL distribution: ${dist}`);
            break; // Found it, stop trying
          }
        } catch (err) {
          // Continue to next distribution
        }
      }
    } catch (err) {
      // All WSL distribution checks failed
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
      
      // Add specific recommendations based on installation type
      const wslInstallations = results.installations_found.filter(inst => inst.type === 'wsl' || inst.type === 'wsl-npm');
      if (wslInstallations.length > 0) {
        results.recommendations.push('Found WSL installation - use from WSL environment or Windows with wsl.exe');
      }
      
      const wslToolkitInstallations = results.installations_found.filter(inst => inst.type === 'wsl-toolkit');
      if (wslToolkitInstallations.length > 0) {
        const toolkit = wslToolkitInstallations[0];
        results.recommendations.push('Found WSL Toolkit installation - use the run-claude-code.bat script to execute Claude Code');
        results.recommendations.push(`WSL Toolkit path: ${toolkit.path}`);
        
        if (toolkit.launchCommand) {
          results.recommendations.push(`Launch command: ${toolkit.launchCommand}`);
        }
        
        if (toolkit.version) {
          results.recommendations.push(`Toolkit version: ${toolkit.version}`);
        }
        
        if (results.wsl_details) {
          if (!results.wsl_details.wslInstalled) {
            results.recommendations.push('Warning: WSL is not installed or not properly configured. Please install WSL for the toolkit to work.');
          } else if (!results.wsl_details.ubuntu24Installed) {
            results.recommendations.push('Warning: Ubuntu 24.04 distribution not found in WSL. The toolkit may not work properly.');
          } else {
            results.recommendations.push('WSL environment appears correctly configured for the toolkit.');
          }
        }
      }
    } else {
      results.status = 'not_installed';
      results.recommendations.push('Claude Code CLI not found. Install with: npm install -g @anthropic-ai/claude-code');
      results.recommendations.push('For WSL: Install inside WSL with npm install -g @anthropic-ai/claude-code');
      results.recommendations.push('Or follow installation guide at: https://docs.anthropic.com/en/docs/claude-code');
      results.recommendations.push('If using WSL Toolkit, ensure it\'s located in your Desktop folder');
    }

    return results;
  } catch (error) {
    results.status = 'error';
    results.error = error.message;
    return results;
  }
}

async function analyzeConfiguration(projectPath) {
  const results = {
    claude_config_files: [],
    project_context: null,
    environment_variables: {},
    recommendations: []
  };

  try {
    const searchPaths = projectPath ? [projectPath] : [process.cwd(), os.homedir()];

    for (const basePath of searchPaths) {
      // Look for .claude files
      const claudeFiles = ['.claude', '.claude.json', 'claude.config.js', 'claude.config.json'];
      
      for (const fileName of claudeFiles) {
        const filePath = path.join(basePath, fileName);
        if (fs.existsSync(filePath)) {
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            results.claude_config_files.push({
              path: filePath,
              exists: true,
              size: content.length,
              is_json: fileName.includes('.json'),
              preview: content.length > 200 ? content.substring(0, 200) + '...' : content
            });
          } catch (err) {
            results.claude_config_files.push({
              path: filePath,
              exists: true,
              error: err.message
            });
          }
        }
      }
    }

    // Check environment variables
    const envVars = ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY', 'CLAUDE_MODEL'];
    for (const envVar of envVars) {
      const value = process.env[envVar];
      results.environment_variables[envVar] = value ? 'set' : 'not_set';
    }

    // Project context analysis
    if (projectPath && fs.existsSync(projectPath)) {
      const stats = fs.statSync(projectPath);
      if (stats.isDirectory()) {
        const files = fs.readdirSync(projectPath);
        results.project_context = {
          is_directory: true,
          file_count: files.length,
          has_package_json: files.includes('package.json'),
          has_gitignore: files.includes('.gitignore'),
          has_readme: files.some(f => f.toLowerCase().startsWith('readme')),
          programming_languages: detectLanguages(files)
        };
      }
    }

    // Generate recommendations
    if (results.claude_config_files.length === 0) {
      results.recommendations.push('No Claude configuration files found. Consider creating a .claude file for project-specific settings');
    }

    if (results.environment_variables.ANTHROPIC_API_KEY === 'not_set') {
      results.recommendations.push('ANTHROPIC_API_KEY environment variable not set. This is required for Claude Code CLI');
    }

    return results;
  } catch (error) {
    results.error = error.message;
    return results;
  }
}

async function analyzeUsage(projectPath) {
  const results = {
    available_commands: [],
    common_workflows: [],
    integration_opportunities: [],
    recommendations: []
  };

  try {
    // Simulate Claude Code CLI help output analysis
    results.available_commands = [
      { command: 'claude chat', description: 'Start an interactive chat session' },
      { command: 'claude edit', description: 'Edit files with Claude assistance' },
      { command: 'claude review', description: 'Review code and get suggestions' },
      { command: 'claude commit', description: 'Generate commit messages' },
      { command: 'claude explain', description: 'Explain code or concepts' },
      { command: 'claude test', description: 'Generate or improve tests' }
    ];

    // Analyze project for integration opportunities
    if (projectPath && fs.existsSync(projectPath)) {
      const files = fs.readdirSync(projectPath).slice(0, 50); // Limit for performance
      
      // Check for code files that could benefit from Claude analysis
      const codeFiles = files.filter(f => /\.(js|ts|py|java|cpp|c|go|rs|php|rb|swift|kt)$/.test(f));
      if (codeFiles.length > 0) {
        results.integration_opportunities.push({
          type: 'code_review',
          description: `Found ${codeFiles.length} code files that could benefit from Claude review`,
          suggested_command: 'claude review'
        });
      }

      // Check for test files
      const testFiles = files.filter(f => /test|spec/.test(f.toLowerCase()));
      if (testFiles.length > 0) {
        results.integration_opportunities.push({
          type: 'test_enhancement',
          description: `Found ${testFiles.length} test files that could be improved`,
          suggested_command: 'claude test'
        });
      }

      // Check for documentation opportunities
      const hasReadme = files.some(f => f.toLowerCase().startsWith('readme'));
      if (!hasReadme) {
        results.integration_opportunities.push({
          type: 'documentation',
          description: 'No README found - Claude can help generate project documentation',
          suggested_command: 'claude chat "Generate a README for this project"'
        });
      }
    }

    // Common workflows
    results.common_workflows = [
      {
        name: 'Code Review Workflow',
        steps: [
          'claude review src/',
          'Review suggested improvements',
          'Apply changes with claude edit',
          'Generate commit message with claude commit'
        ]
      },
      {
        name: 'Feature Development',
        steps: [
          'claude chat "Plan implementation for [feature]"',
          'claude edit [file] - implement with assistance',
          'claude test - generate comprehensive tests',
          'claude review - final review before commit'
        ]
      },
      {
        name: 'Debugging Workflow',
        steps: [
          'claude explain [error_message]',
          'claude review [problematic_file]',
          'claude edit - apply suggested fixes',
          'claude test - ensure fixes work'
        ]
      }
    ];

    // Generate usage recommendations
    results.recommendations.push('Use "claude chat" for interactive assistance and planning');
    results.recommendations.push('Integrate "claude review" into your code review process');
    results.recommendations.push('Use "claude commit" to generate meaningful commit messages');
    
    if (results.integration_opportunities.length > 0) {
      results.recommendations.push(`Found ${results.integration_opportunities.length} integration opportunities in your project`);
    }

    return results;
  } catch (error) {
    results.error = error.message;
    return results;
  }
}

async function analyzeTroubleshooting(projectPath) {
  const results = {
    common_issues: [],
    system_diagnostics: {},
    solutions: [],
    recommendations: []
  };

  try {
    // System diagnostics
    results.system_diagnostics = {
      node_version: process.version,
      platform: process.platform,
      architecture: process.arch,
      working_directory: process.cwd(),
      home_directory: os.homedir()
    };

    // Common issues and solutions
    results.common_issues = [
      {
        issue: 'Claude Code CLI not found',
        symptoms: ['Command not found error', 'claude command not recognized'],
        solutions: [
          'Install Claude Code CLI: npm install -g @anthropic-ai/claude-cli',
          'Check PATH environment variable',
          'Restart terminal after installation'
        ]
      },
      {
        issue: 'Authentication errors',
        symptoms: ['API key not found', 'Authentication failed', '401 Unauthorized'],
        solutions: [
          'Set ANTHROPIC_API_KEY environment variable',
          'Check API key validity at https://console.anthropic.com',
          'Ensure API key has correct permissions'
        ]
      },
      {
        issue: 'File access issues',
        symptoms: ['Permission denied', 'File not found', 'Cannot read file'],
        solutions: [
          'Check file permissions',
          'Run Claude Code from correct directory',
          'Verify file paths are correct',
          'Use absolute paths when possible'
        ]
      },
      {
        issue: 'WSL integration problems',
        symptoms: ['WSL commands not working', 'Path resolution issues'],
        solutions: [
          'Use Windows paths when calling from Windows',
          'Use WSL paths when calling from WSL',
          'Install Claude Code in both environments if needed'
        ]
      }
    ];

    // Check for specific issues in current environment
    const detectedIssues = [];
    
    // Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
      detectedIssues.push('ANTHROPIC_API_KEY not set');
      results.solutions.push('Set your API key: export ANTHROPIC_API_KEY=your_key_here');
    }

    // Check current directory accessibility
    try {
      fs.accessSync(process.cwd(), fs.constants.R_OK);
    } catch (err) {
      detectedIssues.push('Current directory not readable');
      results.solutions.push('Change to a readable directory or check permissions');
    }

    results.detected_issues = detectedIssues;

    // Recommendations
    if (detectedIssues.length === 0) {
      results.recommendations.push('No obvious issues detected - environment appears configured correctly');
    } else {
      results.recommendations.push(`Detected ${detectedIssues.length} potential issues`);
      results.recommendations.push('Review solutions above to resolve detected problems');
    }

    results.recommendations.push('For additional help, visit: https://docs.anthropic.com/en/docs/claude-code');

    return results;
  } catch (error) {
    results.error = error.message;
    return results;
  }
}

// Helper functions
async function runCommand(command) {
  return new Promise((resolve, reject) => {
    // Set proper environment and shell for Windows commands
    const options = {
      shell: true,
      env: { ...process.env, PATH: process.env.PATH },
      cwd: process.cwd(),
      timeout: 10000 // 10 second timeout
    };
    
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Command failed: ${command} - Error: ${error.message}`);
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
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
    
    // Check if WSL is installed with multiple detection methods
    // WSL detection is complex when running from Claude Desktop context
    try {
      // Method 1: Check for WSL executable directly
      const systemRoot = process.env.SystemRoot || 'C:\\Windows';
      const wslPath = path.join(systemRoot, 'System32', 'wsl.exe');
      
      if (fs.existsSync(wslPath)) {
        results.wslInstalled = true;
        logger.info(`Found WSL executable at: ${wslPath}`);
      } else {
        // Method 2: Try running wsl commands with full path
        try {
          const wslCheck = await runCommand(`"${wslPath}" --version`);
          if (wslCheck && wslCheck.trim()) {
            results.wslInstalled = true;
            logger.info('WSL detected via command execution');
          }
        } catch (err) {
          // Method 3: Try environment-based detection
          try {
            const wslStatus = await runCommand('wsl --status');
            if (wslStatus && wslStatus.trim() && !wslStatus.toLowerCase().includes('not found')) {
              results.wslInstalled = true;
              logger.info('WSL detected via status command');
            }
          } catch (err2) {
            // Method 4: Check Windows features
            try {
              const dism = await runCommand('dism /online /get-features | findstr Microsoft-Windows-Subsystem-Linux');
              if (dism && dism.includes('Enabled')) {
                results.wslInstalled = true;
                logger.info('WSL detected via Windows features');
              }
            } catch (err3) {
              logger.error(`All WSL detection methods failed: ${err3.message}`);
              results.wslInstalled = false;
            }
          }
        }
      }
      
      // If WSL is detected, check for Ubuntu-24.04 distribution
      if (results.wslInstalled) {
        try {
          // Try with full path first
          const wslListCmd = fs.existsSync(wslPath) ? `"${wslPath}" -l -v` : 'wsl -l -v';
          const wslList = await runCommand(wslListCmd);
          
          // Log the actual output for debugging
          logger.info(`WSL distributions (verbose): ${wslList.replace(/\n/g, ' | ')}`);
          
          // More flexible Ubuntu 24.04 detection (handle different formats)
          const ubuntuPatterns = ['Ubuntu-24.04', 'Ubuntu 24.04', 'Ubuntu24.04', 'Ubuntu-24', 'Ubuntu24', 'Ubuntu 24'];
          const hasUbuntu = ubuntuPatterns.some(pattern => wslList.includes(pattern));
          
          if (wslList && hasUbuntu) {
            results.ubuntu24Installed = true;
            logger.info('Ubuntu 24.04 distribution found');
          }
        } catch (err) {
          // Try without verbose flag
          try {
            const wslListCmd = fs.existsSync(wslPath) ? `"${wslPath}" -l` : 'wsl -l';
            const wslListSimple = await runCommand(wslListCmd);
            
            // Log the actual output for debugging
            logger.info(`WSL distributions (simple): ${wslListSimple.replace(/\n/g, ' | ')}`);
            
            // More flexible Ubuntu 24.04 detection (handle different formats)
            const ubuntuPatterns = ['Ubuntu-24.04', 'Ubuntu 24.04', 'Ubuntu24.04', 'Ubuntu-24', 'Ubuntu24', 'Ubuntu 24'];
            const hasUbuntu = ubuntuPatterns.some(pattern => wslListSimple.includes(pattern));
            
            if (wslListSimple && hasUbuntu) {
              results.ubuntu24Installed = true;
              logger.info('Ubuntu 24.04 distribution found (simple list)');
            }
          } catch (err2) {
            logger.error(`Ubuntu distribution check failed: ${err2.message}`);
            
            // Final fallback: directly check if we can run a command in the distribution
            try {
              const testResult = await runCommand('wsl -d Ubuntu-24.04 -- echo "Distribution exists"');
              if (testResult && testResult.includes("Distribution exists")) {
                results.ubuntu24Installed = true;
                logger.info('Ubuntu 24.04 distribution exists (direct command test)');
              }
            } catch (err3) {
              try {
                const altTestResult = await runCommand('wsl -d "Ubuntu 24.04" -- echo "Distribution exists"');
                if (altTestResult && altTestResult.includes("Distribution exists")) {
                  results.ubuntu24Installed = true;
                  logger.info('Ubuntu 24.04 distribution exists (direct command test with spaces)');
                }
              } catch (err4) {
                results.ubuntu24Installed = false;
              }
            }
          }
        }
      }
    } catch (err) {
      logger.error(`WSL detection failed: ${err.message}`);
      results.wslInstalled = false;
    }
    
    // If we found Claude CLI in WSL, mark Ubuntu 24.04 as installed regardless of the exact distribution name
    if (results.installations_found.some(install => install.type === 'wsl-ubuntu')) {
      results.ubuntu24Installed = true;
      logger.info('WSL Claude CLI found - considering Ubuntu 24.04 requirement satisfied');
    }
    
    return results;
  } catch (error) {
    results.error = error.message;
    return results;
  }
}

function detectLanguages(files) {
  const extensions = {
    '.js': 'JavaScript',
    '.ts': 'TypeScript',
    '.py': 'Python',
    '.java': 'Java',
    '.cpp': 'C++',
    '.c': 'C',
    '.go': 'Go',
    '.rs': 'Rust',
    '.php': 'PHP',
    '.rb': 'Ruby',
    '.swift': 'Swift',
    '.kt': 'Kotlin'
  };

  const detected = new Set();
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (extensions[ext]) {
      detected.add(extensions[ext]);
    }
  }

  return Array.from(detected);
}

// Session state path
const claudeDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Claude');
const sessionStatePath = path.join(claudeDir, 'session_state.json');

// Ensure Claude directory exists
if (!fs.existsSync(claudeDir)) {
  fs.mkdirSync(claudeDir, { recursive: true });
}

// Built-in tools
const builtInTools = [
  {
    name: "open_conversation",
    description: "Open a specific conversation by ID in Claude Desktop",
    inputSchema: {
      type: "object",
      properties: {
        conversation_id: {
          type: "string",
          description: "The ID of the conversation to open"
        }
      },
      required: ["conversation_id"]
    },
    handler: async (params) => {
      const { conversation_id } = params;
      
      try {
        let sessionState = {};
        try {
          if (fs.existsSync(sessionStatePath)) {
            sessionState = JSON.parse(fs.readFileSync(sessionStatePath, 'utf8'));
          }
        } catch (err) {
          logger.error('Error reading session state:', err);
        }
        
        // Update the state
        sessionState.pending_actions = sessionState.pending_actions || [];
        sessionState.pending_actions.push({
          id: `action_${Date.now()}`,
          type: "open_conversation",
          params: { conversation_id },
          timestamp: Date.now(),
          status: "pending"
        });
        
        // Write back the updated state
        fs.writeFileSync(sessionStatePath, JSON.stringify(sessionState, null, 2));
        
        logger.info(`Requested to open conversation: ${conversation_id}`);
        return { success: true, message: `Requested to open conversation: ${conversation_id}` };
      } catch (err) {
        logger.error(`Error opening conversation: ${err.message}`);
        throw new Error(`Failed to open conversation: ${err.message}`);
      }
    }
  },
  {
    name: "analyze_claude_code_cli",
    description: "Analyze Claude Code CLI installation, configuration, and provide usage insights",
    inputSchema: {
      type: "object",
      properties: {
        analysis_type: {
          type: "string",
          enum: ["installation", "configuration", "usage", "troubleshooting", "full"],
          description: "Type of analysis to perform"
        },
        project_path: {
          type: "string",
          description: "Optional path to a specific project directory to analyze"
        }
      },
      required: ["analysis_type"]
    },
    handler: async (params) => {
      const { analysis_type, project_path } = params;
      
      try {
        const analysis = await analyzeClaudeCodeCLI(analysis_type, project_path);
        
        // Store the analysis in session state for reference
        let sessionState = {};
        try {
          if (fs.existsSync(sessionStatePath)) {
            sessionState = JSON.parse(fs.readFileSync(sessionStatePath, 'utf8'));
          }
        } catch (err) {
          logger.error('Error reading session state:', err);
        }
        
        sessionState.last_claude_code_analysis = {
          type: analysis_type,
          timestamp: Date.now(),
          project_path: project_path || null,
          results: analysis
        };
        
        fs.writeFileSync(sessionStatePath, JSON.stringify(sessionState, null, 2));
        
        logger.info(`Completed Claude Code CLI analysis: ${analysis_type}`);
        return analysis;
      } catch (err) {
        logger.error(`Error analyzing Claude Code CLI: ${err.message}`);
        throw new Error(`Failed to analyze Claude Code CLI: ${err.message}`);
      }
    }
  },
  {
    name: "switch_model",
    description: "Switch the current Claude Desktop model",
    inputSchema: {
      type: "object",
      properties: {
        model: {
          type: "string",
          description: "The model name to switch to"
        }
      },
      required: ["model"]
    },
    handler: async (params) => {
      const { model } = params;
      
      try {
        let sessionState = {};
        try {
          if (fs.existsSync(sessionStatePath)) {
            sessionState = JSON.parse(fs.readFileSync(sessionStatePath, 'utf8'));
          }
        } catch (err) {
          logger.error('Error reading session state:', err);
        }
        
        // Update the state
        sessionState.pending_actions = sessionState.pending_actions || [];
        sessionState.pending_actions.push({
          id: `action_${Date.now()}`,
          type: "switch_model",
          params: { model },
          timestamp: Date.now(),
          status: "pending"
        });
        
        // Write back the updated state
        fs.writeFileSync(sessionStatePath, JSON.stringify(sessionState, null, 2));
        
        logger.info(`Requested to switch model to ${model}`);
        return { success: true, message: `Requested to switch model to ${model}` };
      } catch (err) {
        logger.error(`Error switching model: ${err.message}`);
        throw new Error(`Failed to switch model: ${err.message}`);
      }
    }
  }
];

// Load plugins from plugins directory
const tools = [...builtInTools];

try {
  if (fs.existsSync(PLUGINS_DIR)) {
    const pluginFiles = fs.readdirSync(PLUGINS_DIR).filter(file => file.endsWith('.js'));
    
    for (const pluginFile of pluginFiles) {
      try {
        logger.info(`Loading plugin: ${pluginFile}`);
        const pluginPath = path.join(PLUGINS_DIR, pluginFile);
        
        // Convert to file URL for ESM imports (Windows compatibility fix)
        const pluginUrl = new URL(`file://${pluginPath.replace(/\\/g, '/')}`);
        logger.info(`Loading plugin from URL: ${pluginUrl.href}`);
        
        const { default: plugin } = await import(pluginUrl);
        
        if (plugin && Array.isArray(plugin.tools)) {
          // Validate JSON structures in tools before adding
          const sanitizedTools = plugin.tools.map(tool => {
            try {
              // Deep clone tool definition to avoid reference issues
              const sanitizedTool = { ...tool };
              
              // Validate parameters JSON structure
              if (sanitizedTool.parameters) {
                // Convert parameters to inputSchema format for MCP
                sanitizedTool.inputSchema = sanitizedTool.parameters;
                delete sanitizedTool.parameters;
                
                const serialized = JSON.stringify(sanitizedTool.inputSchema);
                sanitizedTool.inputSchema = JSON.parse(serialized);
              }
              
              return sanitizedTool;
            } catch (error) {
              logger.error(`Tool validation failed for ${tool.name}: ${error.message}`);
              return null;
            }
          }).filter(Boolean); // Remove any null tools (failed validation)
          
          tools.push(...sanitizedTools);
          logger.info(`Added ${sanitizedTools.length} tools from plugin ${pluginFile}`);
        }
      } catch (err) {
        logger.error(`Error loading plugin ${pluginFile}: ${err.message}`);
      }
    }
  }
} catch (err) {
  logger.error(`Error loading plugins: ${err.message}`);
}

logger.info(`Loaded ${tools.length} total tools`);

// MCP stdio protocol implementation
class StdioMCPServer {
  constructor() {
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.setupStdio();
  }

  setupStdio() {
    // Set up stdin reading
    process.stdin.setEncoding('utf8');
    let buffer = '';
    
    process.stdin.on('data', (chunk) => {
      buffer += chunk;
      
      // Process complete JSON-RPC messages
      let lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line.trim());
            // Additional validation
            if (message && typeof message === 'object' && message.jsonrpc === "2.0") {
              this.handleMessage(message);
            } else {
              logger.error(`Invalid JSON-RPC message structure: ${line.trim()}`);
            }
          } catch (err) {
            logger.error(`Failed to parse JSON message: ${line.trim()} - Error: ${err.message}`);
            // Don't crash the server, just log and continue
          }
        }
      }
    });

    process.stdin.on('end', () => {
      logger.info('Stdin ended, shutting down');
      process.exit(0);
    });
  }

  send(message) {
    const jsonString = JSON.stringify(message);
    process.stdout.write(jsonString + '\n');
    logger.info(`Sent: ${jsonString}`);
  }

  async handleMessage(message) {
    logger.info(`Received: ${JSON.stringify(message)}`);
    
    try {
      // Validate basic JSON-RPC structure
      if (!message || typeof message !== 'object') {
        logger.error('Invalid message format - not an object');
        return;
      }

      if (!message.jsonrpc || message.jsonrpc !== "2.0") {
        logger.error('Invalid JSON-RPC version');
        return;
      }

      switch (message.method) {
        case 'initialize':
          await this.handleInitialize(message);
          break;
        case 'tools/list':
          await this.handleToolsList(message);
          break;
        case 'tools/call':
          await this.handleToolCall(message);
          break;
        case 'resources/list':
          await this.handleResourcesList(message);
          break;
        case 'prompts/list':
          await this.handlePromptsList(message);
          break;
        default:
          if (message.id) {
            this.send({
              jsonrpc: "2.0",
              id: message.id,
              error: {
                code: -32601,
                message: `Method '${message.method}' not found`
              }
            });
          }
      }
    } catch (error) {
      logger.error(`Error handling message: ${error.message}`);
      if (message.id) {
        this.send({
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: -32000,
            message: error.message
          }
        });
      }
    }
  }

  async handleInitialize(message) {
    const response = {
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        },
        serverInfo: {
          name: "Custom Claude Extension",
          version: "1.0.0"
        }
      }
    };
    
    this.send(response);
    logger.info('Sent initialization response');
  }

  async handleToolsList(message) {
    const toolsList = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema || {
        type: "object",
        properties: {},
        required: []
      }
    }));

    const response = {
      jsonrpc: "2.0",
      id: message.id,
      result: {
        tools: toolsList
      }
    };
    
    this.send(response);
    logger.info(`Sent ${toolsList.length} tools`);
  }

  async handleToolCall(message) {
    const { name, arguments: toolArgs } = message.params;
    
    logger.info(`Tool call: ${name} with arguments: ${JSON.stringify(toolArgs)}`);
    
    const tool = tools.find(t => t.name === name);
    if (!tool) {
      this.send({
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32602,
          message: `Tool '${name}' not found`
        }
      });
      return;
    }

    try {
      const result = await tool.handler(toolArgs);
      
      this.send({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        }
      });
    } catch (error) {
      logger.error(`Tool execution failed: ${error.message}`);
      this.send({
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32000,
          message: `Tool execution failed: ${error.message}`
        }
      });
    }
  }

  async handleResourcesList(message) {
    // This MCP server doesn't provide resources, but we need to handle the request
    const response = {
      jsonrpc: "2.0",
      id: message.id,
      result: {
        resources: []
      }
    };
    
    this.send(response);
    logger.info('Sent empty resources list');
  }

  async handlePromptsList(message) {
    // This MCP server doesn't provide prompts, but we need to handle the request
    const response = {
      jsonrpc: "2.0",
      id: message.id,
      result: {
        prompts: []
      }
    };
    
    this.send(response);
    logger.info('Sent empty prompts list');
  }
}

// Update session state to reflect server start
try {
  let sessionState = {};
  if (fs.existsSync(sessionStatePath)) {
    sessionState = JSON.parse(fs.readFileSync(sessionStatePath, 'utf8'));
  }
  
  sessionState.bridge_info = sessionState.bridge_info || {};
  sessionState.bridge_info.mcp_server = {
    status: 'running',
    port: null, // stdio doesn't use ports
    started_at: Date.now(),
    pid: process.pid,
    transport: 'stdio'
  };
  
  fs.writeFileSync(sessionStatePath, JSON.stringify(sessionState, null, 2));
} catch (err) {
  logger.error(`Error updating session state: ${err.message}`);
}

// Start the MCP server
const server = new StdioMCPServer();
logger.info('Stdio MCP server started');

// Handle process termination
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});