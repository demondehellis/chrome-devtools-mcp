import { ChromeTab } from './types.js';
export declare class ChromeAPI {
    private baseUrl;
    constructor(options?: {
        port?: number;
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
    private get port();
}
