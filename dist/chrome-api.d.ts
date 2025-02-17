import { ChromeTab, DOMElement } from './types.js';
export declare class ChromeAPI {
    private baseUrl;
    constructor(options?: {
        port?: number;
        baseUrl?: string;
    });
    /**
     * List all available Chrome tabs
     * @returns Promise<ChromeTab[]>
     * @throws Error if Chrome is not accessible or returns an error
     */
    listTabs(): Promise<ChromeTab[]>;
    /**
     * Execute JavaScript in a specific Chrome tab
     * @param tabId The ID of the tab to execute the script in
     * @param script The JavaScript code to execute
     * @returns Promise with the result of the script execution
     * @throws Error if the tab is not found or script execution fails
     */
    executeScript(tabId: string, script: string): Promise<string>;
    /**
     * Check if Chrome debugging port is accessible
     * @returns Promise<boolean>
     */
    isAvailable(): Promise<boolean>;
    /**
     * Capture a screenshot of a specific Chrome tab
     * @param tabId The ID of the tab to capture
     * @param options Screenshot options (format, quality, fullPage)
     * @returns Promise with the base64-encoded screenshot data
     * @throws Error if the tab is not found or screenshot capture fails
     */
    captureScreenshot(tabId: string, options?: {
        format?: 'jpeg' | 'png';
        quality?: number;
        fullPage?: boolean;
    }): Promise<string>;
    /**
     * Capture network events (XHR/Fetch) from a specific Chrome tab
     * @param tabId The ID of the tab to capture events from
     * @param options Capture options (duration, filters)
     * @returns Promise with the captured network events
     * @throws Error if the tab is not found or capture fails
     */
    captureNetworkEvents(tabId: string, options?: {
        duration?: number;
        filters?: {
            types?: Array<'fetch' | 'xhr'>;
            urlPattern?: string;
        };
    }): Promise<Array<{
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
    }>>;
    /**
     * Navigate a Chrome tab to a specific URL
     * @param tabId The ID of the tab to load the URL in
     * @param url The URL to load
     * @returns Promise<void>
     * @throws Error if the tab is not found or navigation fails
     */
    loadUrl(tabId: string, url: string): Promise<void>;
    /**
     * Query DOM elements using a CSS selector
     * @param tabId The ID of the tab to query
     * @param selector CSS selector to find elements
     * @returns Promise<DOMElement[]> Array of matching DOM elements with their properties
     * @throws Error if the tab is not found or query fails
     */
    queryDOMElements(tabId: string, selector: string): Promise<DOMElement[]>;
    /**
     * Click on a DOM element matching a CSS selector
     * @param tabId The ID of the tab containing the element
     * @param selector CSS selector to find the element to click
     * @returns Promise<void>
     * @throws Error if the tab is not found, element is not found, or click fails
     */
    clickElement(tabId: string, selector: string): Promise<{
        consoleOutput: string[];
    }>;
    private get port();
}
