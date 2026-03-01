import type St from "gi://St";

/**
 * Context passed to handlers that need access to manager internals
 */
export interface ClipboardHandlerContext {
    storeBinaryData(marker: string, data: unknown, mimeType: string): void;
}

export interface SignalPayloadContext {
    getBinaryData(marker: string): { data: unknown; mimeType: string } | null;
}

export interface SignalPayload {
    content: Uint8Array;
    mimeType: string;
}

/**
 * Handler for a clipboard content type (text, file, image).
 * Encapsulates identification, capture from St.Clipboard, and MIME metadata.
 */
export interface ClipboardContentHandler {
    readonly mimeTypes: readonly string[];
    readonly priority: number;
    matchesMimeTypes(types: string[]): boolean;
    matchesContent(content: string): boolean;
    capture(
        clipboard: St.Clipboard,
        onResult: (content: string) => void,
        context?: ClipboardHandlerContext,
    ): void;
    set(clipboard: St.Clipboard, content: string): boolean;
    getMimeType(content: string, source?: string): string;
    toSignalPayload(
        event: { content: string; source: string },
        context: SignalPayloadContext,
    ): SignalPayload | null;
}
