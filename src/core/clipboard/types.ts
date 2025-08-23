export interface ClipboardEvent {
    type: "clipboard-changed";
    content: string;
    timestamp: number;
    source: "user" | "system";
}

export interface ClipboardManager {
    onClipboardChange(listener: (event: ClipboardEvent) => void): void;
    removeClipboardListener(listener: (event: ClipboardEvent) => void): void;
    triggerClipboardChange(content: string, source?: "user" | "system"): void;
    destroy(): void;
}
