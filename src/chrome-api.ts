import CDP from 'chrome-remote-interface';
import type { Client } from 'chrome-remote-interface';
import { ChromeTab, DOMElement } from './types.js';

type MouseButton = 'none' | 'left' | 'middle' | 'right' | 'back' | 'forward';
type MouseEventType = 'mousePressed' | 'mouseReleased';

export class ChromeAPI {
    private baseUrl: string;

    constructor(options: { port?: number; baseUrl?: string } = {}) {
        const { port = 9222, baseUrl } = options;
        this.baseUrl = baseUrl || `http://localhost:${port}`;
        const connectionType = process.env.CHROME_CONNECTION_TYPE || 'direct';
        console.error(`ChromeAPI: Connecting to ${this.baseUrl} (${connectionType} connection)`);
    }

    private consoleLogs: Record<string, Array<{
        type: string;
        message: string;
        timestamp: number;
    }>> = {};

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
            const errorHelp = process.env.CHROME_ERROR_HELP || 'Make sure Chrome is running with remote debugging enabled (--remote-debugging-port=9222)';
            throw new Error(`Failed to connect to Chrome DevTools. ${errorHelp}`);
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
        let client: Client | undefined;
        try {
            // Connect to the specific tab
            client = await CDP({ target: tabId, port: this.port });
            
            if (!client) {
                throw new Error('Failed to connect to Chrome DevTools');
            }

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

    /**
     * Capture a screenshot of a specific Chrome tab
     * @param tabId The ID of the tab to capture
     * @param options Screenshot options (format, quality, fullPage)
     * @returns Promise with the base64-encoded screenshot data
     * @throws Error if the tab is not found or screenshot capture fails
     */
    async captureScreenshot(
        tabId: string,
        options: {
            format?: 'jpeg' | 'png';
            quality?: number;
            fullPage?: boolean;
        } = {}
    ): Promise<string> {
        console.error(`ChromeAPI: Attempting to capture screenshot of tab ${tabId}`);
        let client: Client | undefined;
        try {
            // Connect to the specific tab
            client = await CDP({ target: tabId, port: this.port });
            
            if (!client) {
                throw new Error('Failed to connect to Chrome DevTools');
            }

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
        } catch (error) {
            console.error('ChromeAPI: Screenshot capture failed:', error instanceof Error ? error.message : error);
            throw error;
        } finally {
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
    async captureNetworkEvents(
        tabId: string,
        options: {
            duration?: number;
            filters?: {
                types?: Array<'fetch' | 'xhr'>;
                urlPattern?: string;
            };
        } = {}
    ): Promise<Array<{
        type: 'fetch' | 'xhr';
        method: string;
        url: string;
        status: number;
        statusText: string;
        requestHeaders: Record<string, string>;
        responseHeaders: Record<string, string>;
        timing: {
            requestTime: number;
            responseTime: number;
        };
    }>> {
        console.error(`ChromeAPI: Attempting to capture network events from tab ${tabId}`);
        let client: Client | undefined;
        try {
            // Connect to the specific tab
            client = await CDP({ target: tabId, port: this.port });
            
            if (!client) {
                throw new Error('Failed to connect to Chrome DevTools');
            }

            // Enable Network domain
            await client.Network.enable();

            const events: Array<any> = [];
            const requests = new Map();

            // Set up event handlers
            const requestHandler = (params: any) => {
                    const request = {
                        type: (params.type?.toLowerCase() === 'xhr' ? 'xhr' : 'fetch') as 'xhr' | 'fetch',
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
                };

                const responseHandler = (params: any) => {
                    const request = requests.get(params.requestId);
                    if (request) {
                        request.status = params.response.status;
                        request.statusText = params.response.statusText;
                        request.responseHeaders = params.response.headers;
                        request.timing.responseTime = params.timestamp;
                        events.push(request);
                    }
                };

            // Register event handlers
            client.Network.requestWillBeSent(requestHandler);
            client.Network.responseReceived(responseHandler);

            // Wait for specified duration
            const duration = options.duration || 10;
            await new Promise(resolve => setTimeout(resolve, duration * 1000));

            console.error('ChromeAPI: Network event capture successful');
            return events;
        } catch (error) {
            console.error('ChromeAPI: Network event capture failed:', error instanceof Error ? error.message : error);
            throw error;
        } finally {
            if (client) {
                await client.close();
            }
        }
    }

    /**
     * Navigate a Chrome tab to a specific URL
     * @param tabId The ID of the tab to load the URL in
     * @param url The URL to load
     * @returns Promise<void>
     * @throws Error if the tab is not found or navigation fails
     */
    async loadUrl(tabId: string, url: string): Promise<void> {
        console.error(`ChromeAPI: Attempting to load URL ${url} in tab ${tabId}`);
        let client: Client | undefined;
        try {
            // Connect to the specific tab
            client = await CDP({ target: tabId, port: this.port });
            
            if (!client) {
                throw new Error('Failed to connect to Chrome DevTools');
            }

            // Enable Runtime domain to capture console logs
            await client.Runtime.enable();

            // Initialize or clear logs for the tab
            this.consoleLogs[tabId] = [];

            // Start listening to console logs for the tab
            client.Runtime.consoleAPICalled(({ type, args, timestamp }) => {
                const message = args.map(arg => arg.value || arg.description).join(' ');
                this.consoleLogs[tabId].push({
                    type,
                    message,
                    timestamp: timestamp || Date.now()
                });
                console.error(`Chrome Console [${type}] (Tab ${tabId}):`, message);
            });

            // Enable Page domain for navigation
            await client.Page.enable();
            
            // Navigate to the URL and wait for load
            await client.Page.navigate({ url });
            await client.Page.loadEventFired();

            console.error('ChromeAPI: URL loading successful');
        } catch (error) {
            console.error('ChromeAPI: URL loading failed:', error instanceof Error ? error.message : error);
            throw error;
        } finally {
            if (client) {
                await client.close();
            }
        }
    }

    /**
     * Query DOM elements using a CSS selector
     * @param tabId The ID of the tab to query
     * @param selector CSS selector to find elements
     * @returns Promise<DOMElement[]> Array of matching DOM elements with their properties
     * @throws Error if the tab is not found or query fails
     */
    async queryDOMElements(tabId: string, selector: string): Promise<DOMElement[]> {
        console.error(`ChromeAPI: Attempting to query DOM elements in tab ${tabId} with selector "${selector}"`);
        let client: Client | undefined;
        try {
            // Connect to the specific tab
            client = await CDP({ target: tabId, port: this.port });
            
            if (!client) {
                throw new Error('Failed to connect to Chrome DevTools');
            }

            // Enable necessary domains
            await client.DOM.enable();
            await client.Runtime.enable();
            
            // Get the document root
            const { root } = await client.DOM.getDocument();
            
            // Find elements matching the selector
            const { nodeIds } = await client.DOM.querySelectorAll({
                nodeId: root.nodeId,
                selector: selector
            });

            // Get detailed information for each element
            const elements: DOMElement[] = await Promise.all(
                nodeIds.map(async (nodeId) => {
                    if (!client) {
                        throw new Error('Client disconnected');
                    }

                    // Get node details
                    const { node } = await client.DOM.describeNode({ nodeId });
                    
                    // Get node box model for position and dimensions
                    const boxModel = await client.DOM.getBoxModel({ nodeId })
                        .catch(() => null); // Some elements might not have a box model
                    
                    // Check visibility using Runtime.evaluate
                    const result = await client.Runtime.evaluate({
                        expression: `
                            (function(selector) {
                                const element = document.querySelector(selector);
                                if (!element) return false;
                                const style = window.getComputedStyle(element);
                                return style.display !== 'none' && 
                                       style.visibility !== 'hidden' && 
                                       style.opacity !== '0';
                            })('${selector}')
                        `,
                        returnByValue: true
                    });

                    // Extract ARIA attributes
                    const ariaAttributes: Record<string, string> = {};
                    if (node.attributes) {
                        for (let i = 0; i < node.attributes.length; i += 2) {
                            const name = node.attributes[i];
                            if (name.startsWith('aria-')) {
                                ariaAttributes[name] = node.attributes[i + 1];
                            }
                        }
                    }

                    // Convert attributes array to object
                    const attributes: Record<string, string> = {};
                    if (node.attributes) {
                        for (let i = 0; i < node.attributes.length; i += 2) {
                            attributes[node.attributes[i]] = node.attributes[i + 1];
                        }
                    }

                    return {
                        nodeId,
                        tagName: node.nodeName.toLowerCase(),
                        textContent: node.nodeValue || null,
                        attributes,
                        boundingBox: boxModel ? {
                            x: boxModel.model.content[0],
                            y: boxModel.model.content[1],
                            width: boxModel.model.width,
                            height: boxModel.model.height
                        } : null,
                        isVisible: result.result.value as boolean,
                        ariaAttributes
                    };
                })
            );

            console.error(`ChromeAPI: Successfully found ${elements.length} elements matching selector`);
            return elements;
        } catch (error) {
            console.error('ChromeAPI: DOM query failed:', error instanceof Error ? error.message : error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new Error(`Failed to query DOM elements with selector "${selector}": ${errorMessage}. Note: :contains() is not a valid CSS selector. Use a valid CSS selector like tag names, classes, or IDs.`);
        } finally {
            if (client) {
                await client.close();
            }
        }
    }

    /**
     * Click on a DOM element matching a CSS selector
     * @param tabId The ID of the tab containing the element
     * @param selector CSS selector to find the element to click
     * @returns Promise<void>
     * @throws Error if the tab is not found, element is not found, or click fails
     */
    async clickElement(tabId: string, selector: string): Promise<{consoleOutput: string[]}> {
        console.error(`ChromeAPI: Attempting to click element in tab ${tabId} with selector "${selector}"`);
        let client: Client | undefined;
        try {
            // Connect to the specific tab
            client = await CDP({ target: tabId, port: this.port });
            
            if (!client) {
                throw new Error('Failed to connect to Chrome DevTools');
            }

            // Enable necessary domains
            await client.DOM.enable();
            await client.Runtime.enable();
            
            // Get the document root
            const { root } = await client.DOM.getDocument();
            
            // Find the element
            const { nodeIds } = await client.DOM.querySelectorAll({
                nodeId: root.nodeId,
                selector: selector
            });

            if (nodeIds.length === 0) {
                throw new Error(`No element found matching selector: ${selector}`);
            }

            // Get element's box model for coordinates
            const { model } = await client.DOM.getBoxModel({ nodeId: nodeIds[0] });
            
            // Calculate center point
            const centerX = model.content[0] + (model.width / 2);
            const centerY = model.content[1] + (model.height / 2);

            // Dispatch click event using Runtime.evaluate
            await client.Runtime.evaluate({
                expression: `
                    (() => {
                        const element = document.querySelector('${selector}');
                        if (!element) throw new Error('Element not found');
                        
                        const clickEvent = new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                            clientX: ${Math.round(centerX)},
                            clientY: ${Math.round(centerY)}
                        });
                        
                        element.dispatchEvent(clickEvent);
                    })()
                `,
                awaitPromise: true
            });

            // Set up console listener before the click
            let consoleMessages: string[] = [];
            const consolePromise = new Promise<void>((resolve) => {
                if (!client) return;
                client.Runtime.consoleAPICalled(({ type, args }) => {
                    const message = args.map(arg => arg.value || arg.description).join(' ');
                    consoleMessages.push(`[${type}] ${message}`);
                    console.error(`Chrome Console: ${type}:`, message);
                    resolve(); // Resolve when we get a console message
                });
            });

            // Set up a timeout promise
            const timeoutPromise = new Promise<void>((resolve) => {
                setTimeout(resolve, 1000);
            });

            // Click the element
            await client.Runtime.evaluate({
                expression: `
                    (() => {
                        const element = document.querySelector('${selector}');
                        if (!element) throw new Error('Element not found');
                        
                        const clickEvent = new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                            clientX: ${Math.round(centerX)},
                            clientY: ${Math.round(centerY)}
                        });
                        
                        element.dispatchEvent(clickEvent);
                    })()
                `,
                awaitPromise: true
            });

            // Wait for either a console message or timeout
            await Promise.race([consolePromise, timeoutPromise]);

            console.error('ChromeAPI: Successfully clicked element');
            return { consoleOutput: consoleMessages };
        } catch (error) {
            console.error('ChromeAPI: Element click failed:', error instanceof Error ? error.message : error);
            throw error;
        } finally {
            if (client) {
                await client.close();
            }
        }
    }

    /**
     * Retrieve captured console logs for a specific tab with optional filtering
     * @param tabId The ID of the tab to retrieve logs for
     * @param options Filter options (status and since timestamp)
     * @returns Array of filtered console logs
     */
    getConsoleLogs(tabId: string, options: { status?: string; since?: number } = {}): Array<{
        type: string;
        message: string;
        timestamp: number;
    }> {
        console.error(`ChromeAPI: Retrieving console logs for tab ${tabId} with filters:`, options);
        const logs = this.consoleLogs[tabId] || [];
        return logs.filter(log => {
            const matchesStatus = options.status ? log.type === options.status : true;
            const matchesSince = options.since ? log.timestamp >= options.since : true;
            return matchesStatus && matchesSince;
        });
    }

    private get port(): number {
        const portMatch = this.baseUrl.match(/:(\d+)$/);
        return portMatch ? parseInt(portMatch[1]) : 9222;
    }
}
