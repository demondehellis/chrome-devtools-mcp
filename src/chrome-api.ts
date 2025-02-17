import CDP from 'chrome-remote-interface';
import { ChromeTab } from './types.js';

export class ChromeAPI {
    private baseUrl: string;

    constructor(options: { port?: number } = {}) {
        const { port = 9222 } = options;
        this.baseUrl = `http://localhost:${port}`;
        console.error(`ChromeAPI: Connecting to ${this.baseUrl} through SSH tunnel`);
    }

    /**
     * List all available Chrome tabs
     * @returns Promise<ChromeTab[]>
     * @throws Error if Chrome is not accessible or returns an error
     */
    async listTabs(): Promise<ChromeTab[]> {
        try {
            console.error(`ChromeAPI: Attempting to list tabs on port ${this.port}`);
            const targets = await CDP.List({ port: this.port });
            console.error(`ChromeAPI: Successfully found ${targets.length} tabs`);
            return targets;
        } catch (error) {
            console.error(`ChromeAPI: Failed to list tabs:`, error instanceof Error ? error.message : error);
            throw new Error(`Failed to connect to Chrome DevTools. Make sure the SSH tunnel is running: ssh -N -L 9222:localhost:9222 sshuser@192.168.224.1`);
        }
    }

    /**
     * Execute JavaScript in a specific Chrome tab
     * @param tabId The ID of the tab to execute the script in
     * @param script The JavaScript code to execute
     * @returns Promise with the result of the script execution
     * @throws Error if the tab is not found or script execution fails
     */
    async executeScript(tabId: string, script: string): Promise<string> {
        console.error(`ChromeAPI: Attempting to execute script in tab ${tabId}`);
        let client;
        try {
            // Connect to the specific tab
            client = await CDP({ target: tabId, port: this.port });
            
            // Enable Runtime and set up console listener
            await client.Runtime.enable();
            
            let consoleMessages: string[] = [];
            client.Runtime.consoleAPICalled(({ type, args }) => {
                const message = args.map(arg => arg.value || arg.description).join(' ');
                consoleMessages.push(`[${type}] ${message}`);
                console.error(`Chrome Console: ${type}:`, message);
            });

            // Execute the script using Runtime.evaluate
            const result = await client.Runtime.evaluate({
                expression: script,
                returnByValue: true,
                includeCommandLineAPI: true
            });

            console.error('ChromeAPI: Script execution successful');
            return JSON.stringify({
                result: result.result,
                consoleOutput: consoleMessages
            }, null, 2);
        } catch (error) {
            console.error('ChromeAPI: Script execution failed:', error instanceof Error ? error.message : error);
            throw error;
        } finally {
            if (client) {
                await client.close();
            }
        }
    }

    /**
     * Check if Chrome debugging port is accessible
     * @returns Promise<boolean>
     */
    async isAvailable(): Promise<boolean> {
        try {
            await this.listTabs();
            return true;
        } catch {
            return false;
        }
    }

    private get port(): number {
        const portMatch = this.baseUrl.match(/:(\d+)$/);
        return portMatch ? parseInt(portMatch[1]) : 9222;
    }
}
