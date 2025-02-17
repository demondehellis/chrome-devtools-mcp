import CDP from 'chrome-remote-interface';
export class ChromeAPI {
    constructor(options = {}) {
        const { port = 9222 } = options;
        this.baseUrl = `http://localhost:${port}`;
        console.error(`ChromeAPI: Connecting to ${this.baseUrl} through SSH tunnel`);
    }
    /**
     * List all available Chrome tabs
     * @returns Promise<ChromeTab[]>
     * @throws Error if Chrome is not accessible or returns an error
     */
    async listTabs() {
        try {
            console.error(`ChromeAPI: Attempting to list tabs on port ${this.port}`);
            const targets = await CDP.List({ port: this.port });
            console.error(`ChromeAPI: Successfully found ${targets.length} tabs`);
            return targets;
        }
        catch (error) {
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
    async executeScript(tabId, script) {
        console.error(`ChromeAPI: Attempting to execute script in tab ${tabId}`);
        let client;
        try {
            // Connect to the specific tab
            client = await CDP({ target: tabId, port: this.port });
            // Enable Runtime and set up console listener
            await client.Runtime.enable();
            let consoleMessages = [];
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
        }
        catch (error) {
            console.error('ChromeAPI: Script execution failed:', error instanceof Error ? error.message : error);
            throw error;
        }
        finally {
            if (client) {
                await client.close();
            }
        }
    }
    /**
     * Check if Chrome debugging port is accessible
     * @returns Promise<boolean>
     */
    async isAvailable() {
        try {
            await this.listTabs();
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Capture a screenshot of a specific Chrome tab
     * @param tabId The ID of the tab to capture
     * @param options Screenshot options (format, quality, fullPage)
     * @returns Promise with the base64-encoded screenshot data
     * @throws Error if the tab is not found or screenshot capture fails
     */
    async captureScreenshot(tabId, options = {}) {
        console.error(`ChromeAPI: Attempting to capture screenshot of tab ${tabId}`);
        let client;
        try {
            // Connect to the specific tab
            client = await CDP({ target: tabId, port: this.port });
            // Enable Page domain for screenshot capabilities
            await client.Page.enable();
            // If fullPage is requested, we need to get the full page dimensions
            if (options.fullPage) {
                // Get the full page dimensions
                const { root } = await client.DOM.getDocument();
                const { model } = await client.DOM.getBoxModel({ nodeId: root.nodeId });
                const height = model.height;
                // Set viewport to full page height
                await client.Emulation.setDeviceMetricsOverride({
                    width: 1920, // Standard width
                    height: Math.ceil(height),
                    deviceScaleFactor: 1,
                    mobile: false
                });
            }
            // Capture the screenshot
            const result = await client.Page.captureScreenshot({
                format: options.format || 'png',
                quality: options.format === 'jpeg' ? options.quality || 80 : undefined,
                fromSurface: true,
                captureBeyondViewport: options.fullPage || false
            });
            console.error('ChromeAPI: Screenshot capture successful');
            return result.data;
        }
        catch (error) {
            console.error('ChromeAPI: Screenshot capture failed:', error instanceof Error ? error.message : error);
            throw error;
        }
        finally {
            if (client) {
                // Reset device metrics if we modified them
                if (options.fullPage) {
                    await client.Emulation.clearDeviceMetricsOverride();
                }
                await client.close();
            }
        }
    }
    /**
     * Capture network events (XHR/Fetch) from a specific Chrome tab
     * @param tabId The ID of the tab to capture events from
     * @param options Capture options (duration, filters)
     * @returns Promise with the captured network events
     * @throws Error if the tab is not found or capture fails
     */
    async captureNetworkEvents(tabId, options = {}) {
        console.error(`ChromeAPI: Attempting to capture network events from tab ${tabId}`);
        let client;
        try {
            // Connect to the specific tab
            client = await CDP({ target: tabId, port: this.port });
            // Enable Network domain
            await client.Network.enable();
            const events = [];
            const requests = new Map();
            // Set up event listeners
            client.Network.requestWillBeSent((params) => {
                const request = {
                    type: (params.type?.toLowerCase() === 'xhr' ? 'xhr' : 'fetch'),
                    method: params.request.method,
                    url: params.request.url,
                    requestHeaders: params.request.headers,
                    timing: {
                        requestTime: params.timestamp
                    }
                };
                // Apply filters if specified
                if (options.filters) {
                    if (options.filters.types && !options.filters.types.includes(request.type)) {
                        return;
                    }
                    if (options.filters.urlPattern && !request.url.match(options.filters.urlPattern)) {
                        return;
                    }
                }
                requests.set(params.requestId, request);
            });
            client.Network.responseReceived((params) => {
                const request = requests.get(params.requestId);
                if (request) {
                    request.status = params.response.status;
                    request.statusText = params.response.statusText;
                    request.responseHeaders = params.response.headers;
                    request.timing.responseTime = params.timestamp;
                    events.push(request);
                }
            });
            // Wait for specified duration
            const duration = options.duration || 10;
            await new Promise(resolve => setTimeout(resolve, duration * 1000));
            console.error('ChromeAPI: Network event capture successful');
            return events;
        }
        catch (error) {
            console.error('ChromeAPI: Network event capture failed:', error instanceof Error ? error.message : error);
            throw error;
        }
        finally {
            if (client) {
                await client.close();
            }
        }
    }
    get port() {
        const portMatch = this.baseUrl.match(/:(\d+)$/);
        return portMatch ? parseInt(portMatch[1]) : 9222;
    }
}
