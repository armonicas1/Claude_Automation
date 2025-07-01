# validate-scripts.ps1
# Securely and accurately validates the syntax of all project PowerShell scripts.

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "========================================" -ForegroundColor Magenta
Write-Host " PowerShell Script Syntax Validator" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

$scriptsToValidate = @(
    "$projectRoot\claude-master-control.ps1",
    "$projectRoot\scripts\claude-system-monitor.ps1",
    "$projectRoot\scripts\tool-call-debugger.ps1",
    "$projectRoot\scripts\bridge-monitor.ps1"
)

$allScriptsValid = $true

foreach ($scriptPath in $scriptsToValidate) {
    $scriptName = Split-Path $scriptPath -Leaf
    Write-Host "Checking: $scriptName" -NoNewline
    $padding = 35 - $scriptName.Length
    Write-Host ("." * $padding) -NoNewline -ForegroundColor Gray
    
    try {
        # Use the official PowerShell parser to find syntax errors
        [System.Management.Automation.Language.Parser]::ParseFile($scriptPath, [ref]$null, [ref]$null)
        Write-Host "[ OK ]" -ForegroundColor Green
    } catch {
        Write-Host "[ FAILED ]" -ForegroundColor Red
        Write-Host "  └─ ERROR: $($_.Exception.Message.Split([System.Environment]::NewLine)[0])" -ForegroundColor Red
        $allScriptsValid = $false
    }
}

Write-Host ""
Write-Host "----------------------------------------" -ForegroundColor Magenta

if ($allScriptsValid) {
    Write-Host "Validation Result: All scripts are syntactically correct." -ForegroundColor Green
} else {
    Write-Host "Validation Result: One or more scripts contain syntax errors." -ForegroundColor Red
}
Write-Host "----------------------------------------" -ForegroundColor Magenta
Write-Host ""