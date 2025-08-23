export interface ClipboardEvent {
    type: "clipboard-changed";
    content: string;
    timestamp: number;
    source: "user" | "system" | "image";
    contentType: "text" | "image" | "files" | "mixed";
}

export interface ClipboardManager {
    onClipboardChange(listener: (event: ClipboardEvent) => void): void;
    removeClipboardListener(listener: (event: ClipboardEvent) => void): void;
    triggerClipboardChange(
        content: string,
        source?: "user" | "system" | "image",
    ): void;
    destroy(): void;
}

// New interfaces for clipboard content objects
export interface ImageContent {
    data: BufferLike;
    mimeType?: string;
}

export interface BufferLike {
    length: number;
    [index: number]: number;
    slice(start?: number, end?: number): BufferLike;
}

export type ClipboardContent = string | ImageContent;
