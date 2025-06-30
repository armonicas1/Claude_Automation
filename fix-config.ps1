$configPath = "$env:APPDATA\Claude\claude_desktop_config.json"
$config = Get-Content $configPath | ConvertFrom-Json
$config.mcpServers."custom-extension".args[0] = "C:\Users\dimas\Desktop\Claude_Automation-main\src\custom-claude-mcp.js"
$config | ConvertTo-Json -Depth 10 | Set-Content $configPath
Write-Host "Updated Claude Desktop config with correct path"