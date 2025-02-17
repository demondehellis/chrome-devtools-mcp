#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ChromeAPI } from './chrome-api.js';
import { z } from 'zod';
const chromeApi = new ChromeAPI(); // Will use default port 9222
// Create the MCP server
const server = new McpServer({
    name: 'chrome-tools',
    version: '1.0.0'
});
// Add the list_tabs tool
server.tool('list_tabs', {}, // No input parameters needed
async () => {
    try {
        console.error('Attempting to list Chrome tabs...');
        const tabs = await chromeApi.listTabs();
        console.error(`Successfully found ${tabs.length} tabs`);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(tabs, null, 2)
                }]
        };
    }
    catch (error) {
        console.error('Error in list_tabs tool:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
            content: [{
                    type: 'text',
                    text: `Error: ${errorMessage}`
                }],
            isError: true
        };
    }
});
// Add the execute_script tool
server.tool('execute_script', {
    tabId: z.string().describe('ID of the Chrome tab to execute the script in'),
    script: z.string().describe('JavaScript code to execute in the tab')
}, async (params) => {
    try {
        console.error(`Attempting to execute script in tab ${params.tabId}...`);
        const result = await chromeApi.executeScript(params.tabId, params.script);
        console.error('Script execution successful');
        return {
            content: [{
                    type: 'text',
                    text: result || 'undefined'
                }]
        };
    }
    catch (error) {
        console.error('Error in execute_script tool:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
            content: [{
                    type: 'text',
                    text: `Error: ${errorMessage}`
                }],
            isError: true
        };
    }
});
// Log when server starts
console.error('Chrome Tools MCP Server starting...');
// Start the server
const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
// Handle process termination
process.on('SIGINT', () => {
    server.close().catch(console.error);
    process.exit(0);
});
