import axios from 'axios';
import { ChromeTab, ChromeError, ChromeResponse } from './types.js';

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
            console.error(`ChromeAPI: Attempting connection to ${this.baseUrl}/json`);
            const response = await axios.get<ChromeResponse>(`${this.baseUrl}/json`, {
                timeout: 5000,
                headers: {
                    'Origin': 'http://localhost:5173'
                }
            });

            if (Array.isArray(response.data)) {
                console.error(`ChromeAPI: Successfully connected, found ${response.data.length} tabs`);
                return response.data;
            }

            throw new Error('Unexpected response format from Chrome DevTools');
        } catch (error) {
            console.error(`ChromeAPI: Connection failed:`, error instanceof Error ? error.message : error);
            throw new Error(`Failed to connect to Chrome DevTools. Make sure the SSH tunnel is running: ssh -N -L 9222:localhost:9222 sshuser@192.168.224.1`);
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
}
