export type { Target as ChromeTab } from 'chrome-remote-interface';
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
