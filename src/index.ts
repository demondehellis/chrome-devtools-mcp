#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ChromeAPI } from './chrome-api.js';
import { z } from 'zod';

// Get Chrome debug URL from environment variable or use default
const chromeDebugUrl = process.env.CHROME_DEBUG_URL || 'http://localhost:9222';
console.error(`Using Chrome debug URL: ${chromeDebugUrl}`);

const chromeApi = new ChromeAPI({ baseUrl: chromeDebugUrl });

// Create the MCP server
const server = new McpServer({
    name: 'chrome-tools',
    version: '1.0.0'
});

// Add the list_tabs tool
server.tool(
    'list_tabs',
    {}, // No input parameters needed
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
        } catch (error) {
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
    }
);

// Add the capture_screenshot tool
server.tool(
    'capture_screenshot',
    {
        tabId: z.string().describe('ID of the Chrome tab to capture'),
        format: z.enum(['jpeg', 'png']).optional().describe('Image format (jpeg or png)'),
        quality: z.number().min(1).max(100).optional().describe('JPEG quality (1-100)'),
        fullPage: z.boolean().optional().describe('Capture full scrollable page')
    },
    async (params) => {
        try {
            console.error(`Attempting to capture screenshot of tab ${params.tabId}...`);
            const base64Data = await chromeApi.captureScreenshot(params.tabId, {
                format: params.format,
                quality: params.quality,
                fullPage: params.fullPage
            });
            console.error('Screenshot capture successful');
            return {
                content: [{
                    type: 'text',
                    text: base64Data
                }]
            };
        } catch (error) {
            console.error('Error in capture_screenshot tool:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return {
                content: [{
                    type: 'text',
                    text: `Error: ${errorMessage}`
                }],
                isError: true
            };
        }
    }
);

// Add the execute_script tool
server.tool(
    'execute_script',
    {
        tabId: z.string().describe('ID of the Chrome tab to execute the script in'),
        script: z.string().describe('JavaScript code to execute in the tab')
    },
    async (params) => {
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
        } catch (error) {
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
    }
);

// Log when server starts
console.error('Chrome Tools MCP Server starting...');

// Start the server
const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);

// Add the capture_network_events tool
server.tool(
    'capture_network_events',
    {
        tabId: z.string().describe('ID of the Chrome tab to monitor'),
        duration: z.number().min(1).max(60).optional()
            .describe('Duration in seconds to capture events (default: 10)'),
        filters: z.object({
            types: z.array(z.enum(['fetch', 'xhr'])).optional()
                .describe('Types of requests to capture'),
            urlPattern: z.string().optional()
                .describe('Only capture URLs matching this pattern')
        }).optional()
    },
    async (params) => {
        try {
            console.error(`Attempting to capture network events from tab ${params.tabId}...`);
            const events = await chromeApi.captureNetworkEvents(params.tabId, {
                duration: params.duration,
                filters: params.filters
            });
            console.error(`Network event capture successful, captured ${events.length} events`);
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(events, null, 2)
                }]
            };
        } catch (error) {
            console.error('Error in capture_network_events tool:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return {
                content: [{
                    type: 'text',
                    text: `Error: ${errorMessage}`
                }],
                isError: true
            };
        }
    }
);

// Handle process termination
process.on('SIGINT', () => {
    server.close().catch(console.error);
    process.exit(0);
});
