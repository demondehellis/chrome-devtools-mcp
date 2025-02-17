export interface ChromeTab {
    description: string;
    devtoolsFrontendUrl: string;
    id: string;
    title: string;
    type: string;
    url: string;
    webSocketDebuggerUrl: string;
}

export interface ChromeError {
    error: string;
    message: string;
}

export type ChromeResponse = ChromeTab[] | ChromeError;

// Chrome Remote Debugging Protocol command types
export interface ChromeCommand {
    id: number;
    method: string;
    params?: Record<string, unknown>;
}

export interface ChromeCommandResponse {
    id: number;
    result?: unknown;
    error?: {
        code: number;
        message: string;
    };
}
