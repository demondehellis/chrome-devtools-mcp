# Chrome Tools MCP Server

A Model Context Protocol (MCP) server that provides tools for interacting with Chrome through the Chrome DevTools Protocol. This server is particularly useful for testing web applications in a browser with specific conditions or configurations.

## Why use an MCP server like this?
This type of MCP Server is usful When you need to manually configure your browser to be a certain state before you let an AI tool like Cline poke at it. In my workflows I use it for testing sites that have chrome extensions enabled. 

## Features

The server provides the following tools:

- **list_tabs**: Lists all open Chrome tabs with their IDs and URLs
- **execute_script**: Execute JavaScript in a specific Chrome tab
- **capture_screenshot**: Capture a screenshot of a specific tab (supports JPEG/PNG, quality settings, and full-page captures)
- **load_url**: Navigate a specific tab to a URL
- **capture_network_events**: Monitor and capture network requests (XHR/Fetch) from a specific tab

## Installation

1. Clone the repository:
```bash
git clone [your-repo-url]
cd chrome-tools-MCP
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Setting Up Chrome for Remote Debugging

1. Close all instances of Chrome

2. Launch Chrome with remote debugging enabled:

### Windows
```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

### macOS
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

### Linux
```bash
google-chrome --remote-debugging-port=9222
```

You can verify the debugging interface is working by visiting `http://localhost:9222/json` in your browser. You should see a JSON response listing all open tabs.

## MCP Server Configuration

Add the following configuration to your MCP settings file (typically located at `~/.vscode-server/data/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` for VSCode):

```json
{
  "mcpServers": {
    "chrome-tools": {
      "command": "node",
      "args": [
        "/path/to/chrome-tools-MCP/dist/index.js"
      ],
      "env": {
        "CHROME_DEBUG_URL": "http://localhost:9222"  
      },
      "disabled": false,
      "alwaysAllow": [],
      "autoApprove": [
        "list_tabs",
        "execute_script"
      ]
    }
  }
}
```

Configuration options:
- `command` & `args`: Specifies how to run the server
- `env.CHROME_DEBUG_URL`: URL where Chrome's debugging interface is available
- `disabled`: Set to false to enable the server
- `autoApprove`: List of tools that don't require explicit approval for each use
  - In this example, `list_tabs` and `execute_script` are auto-approved
  - Other tools like `capture_screenshot` will require approval

## Usage Examples

### List All Tabs
```javascript
{
  "tabId": "list_tabs"
}
```

### Execute JavaScript in a Tab
```javascript
{
  "tabId": "YOUR_TAB_ID",
  "script": "document.title"
}
```

### Capture Screenshot
```javascript
{
  "tabId": "YOUR_TAB_ID",
  "format": "jpeg",
  "quality": 80,
  "fullPage": true
}
```

### Load URL in Tab
```javascript
{
  "tabId": "YOUR_TAB_ID",
  "url": "https://www.example.com"
}
```

### Capture Network Events
```javascript
{
  "tabId": "YOUR_TAB_ID",
  "duration": 10,
  "filters": {
    "types": ["xhr", "fetch"],
    "urlPattern": "api"
  }
}
```

## Common Use Cases

1. **Automated Testing**: Execute scripts and capture results in a controlled browser environment
2. **UI Testing**: Take screenshots of pages in different states
3. **Network Monitoring**: Track API calls and network requests
4. **Browser Automation**: Navigate between pages and interact with web content
5. **Debug Environment Setup**: Quickly set up specific browser conditions for testing

## Troubleshooting

1. If you can't connect to Chrome:
   - Ensure Chrome is running with the `--remote-debugging-port=9222` flag
   - Verify you can access `http://localhost:9222/json`
   - Check if another process is using port 9222

2. If tools aren't appearing:
   - Verify the server is properly configured in your MCP settings
   - Check the server's console output for errors
   - Ensure the server was built (`npm run build`)

3. If a tool requires approval:
   - Add it to the `autoApprove` list in your MCP configuration
   - Or approve it manually when prompted

## Security Considerations

- The Chrome debugging protocol provides powerful capabilities to interact with the browser
- Be cautious when auto-approving tools that can execute JavaScript or capture sensitive information
- Consider running Chrome with a separate profile for debugging
- Avoid exposing the debugging port to untrusted networks
