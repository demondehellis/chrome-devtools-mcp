// Re-export the ChromeTab type from chrome-remote-interface for compatibility
export type { Target as ChromeTab } from 'chrome-remote-interface';

// Interface for DOM element information
export interface DOMElement {
    nodeId: number;
    tagName: string;
    textContent: string | null;
    attributes: Record<string, string>;
    boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    } | null;
    isVisible: boolean;
    ariaAttributes: Record<string, string>;
}
