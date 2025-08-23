import type Gio from "gi://Gio";
import GLib from "gi://GLib";
import { VicinaeClipboardManager } from "../../../core/clipboard/clipboard-manager.js";
import { calculateClipboardMetadata } from "../../../utils/clipboard-utils.js";
import { logger } from "../../../utils/logger.js";
import type { ClipboardEvent } from "../../clipboard/types.js";

export class ClipboardService {
    private clipboardManager: VicinaeClipboardManager;
    private dbusObject: Gio.DBusExportedObject | null = null;
    private clipboardListener: ((event: ClipboardEvent) => void) | null = null;
    private isListening = false;

    constructor() {
        this.clipboardManager = new VicinaeClipboardManager();
    }

    // Method to set the D-Bus exported object (called by DBusManager)
    setDBusObject(dbusObject: Gio.DBusExportedObject): void {
        this.dbusObject = dbusObject;
    }

    // Method to listen to clipboard changes
    ListenToClipboardChanges(): void {
        try {
            if (this.isListening) {
                return; // Already listening
            }

            if (!this.dbusObject) {
                throw new Error("D-Bus object not set - cannot emit signals");
            }

            // Set up the clipboard event listener
            this.clipboardListener = (event: ClipboardEvent) => {
                try {
                    // Calculate additional metadata for the launcher
                    const metadata = calculateClipboardMetadata(event);

                    // Emit D-Bus signal with comprehensive clipboard information
                    // Format: (susssstss) = string, uint32, string, string, string, string, uint64, string
                    this.dbusObject?.emit_signal(
                        "ClipboardChanged",
                        GLib.Variant.new("(sussssts)", [
                            event.content,
                            event.timestamp,
                            event.source as string,
                            metadata.mimeType,
                            metadata.contentType,
                            metadata.contentHash,
                            metadata.size,
                            metadata.sourceApp,
                        ]),
                    );
                } catch (signalError) {
                    logger(
                        "Error emitting D-Bus clipboard signal",
                        signalError,
                    );
                }
            };

            // Register the listener with the clipboard manager
            this.clipboardManager.onClipboardChange(this.clipboardListener);
            this.isListening = true;

            logger("📡 D-Bus clipboard listener activated");
        } catch (error) {
            logger("D-Bus: Error setting up clipboard change listener", error);
            throw error;
        }
    }

    // Method to manually trigger a clipboard change (for testing)
    TriggerClipboardChange(content: string, source: string = "user"): void {
        try {
            this.clipboardManager.triggerClipboardChange(
                content,
                source as "user" | "system",
            );
        } catch (error) {
            logger("D-Bus: Error triggering clipboard change", error);
            throw error;
        }
    }

    // Method to get current clipboard content (if needed)
    GetCurrentContent(): string {
        try {
            const content = this.clipboardManager.getCurrentContent();
            return content;
        } catch (error) {
            logger("D-Bus: Error getting current clipboard content", error);
            throw error;
        }
    }

    // Method to set clipboard content
    SetContent(content: string): void {
        try {
            // This actually sets the system clipboard content
            this.clipboardManager.setContent(content);
        } catch (error) {
            logger("D-Bus: Error setting clipboard content", error);
            throw error;
        }
    }

    // Method to get available MIME types from current clipboard
    GetClipboardMimeTypes(): string[] {
        try {
            // This would query the actual clipboard for available MIME types
            // For now, return common types that we support
            return [
                "text/plain",
                "text/html",
                "image/png",
                "image/jpeg",
                "image/gif",
                "image/webp",
                "application/x-vicinae-concealed",
            ];
        } catch (error) {
            logger("D-Bus: Error getting clipboard MIME types", error);
            return [];
        }
    }

    // Method to stop listening to clipboard changes
    StopListening(): void {
        try {
            if (this.clipboardListener && this.isListening) {
                this.clipboardManager.removeClipboardListener(
                    this.clipboardListener,
                );
                this.clipboardListener = null;
                this.isListening = false;
                logger("🔕 D-Bus clipboard listener deactivated");
            }
        } catch (error) {
            logger("Error stopping clipboard listener", error);
        }
    }

    // Cleanup method
    destroy(): void {
        this.StopListening();
        this.dbusObject = null;
    }
}
