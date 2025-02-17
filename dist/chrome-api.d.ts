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
     * Check if Chrome debugging port is accessible
     * @returns Promise<boolean>
     */
    isAvailable(): Promise<boolean>;
}
