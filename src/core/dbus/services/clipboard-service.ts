import type Gio from "gi://Gio";
import GLib from "gi://GLib";
import type { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import type { VicinaeClipboardManager } from "../../../core/clipboard/clipboard-manager.js";
import { calculateClipboardMetadata } from "../../../utils/clipboard-utils.js";
import { logger } from "../../../utils/logger.js";
import type { ClipboardEvent } from "../../clipboard/types.js";

export class ClipboardService {
    private clipboardManager: VicinaeClipboardManager;
    private dbusObject: Gio.DBusExportedObject | null = null;
    private clipboardListener: ((event: ClipboardEvent) => void) | null = null;
    private isListening = false;

    constructor(
        clipboardManager: VicinaeClipboardManager,
        _extension?: Extension,
    ) {
        // Use the provided clipboard manager instead of creating a new one
        this.clipboardManager = clipboardManager;

        logger("ClipboardService initialized with shared clipboard manager");

        // Start listening to clipboard changes immediately
        // Note: We'll need to set the DBus object first, so we'll do this in setDBusObject
    }

    // Method to set the D-Bus exported object (called by DBusManager)
    setDBusObject(dbusObject: Gio.DBusExportedObject): void {
        this.dbusObject = dbusObject;

        // Set up the clipboard event listener and register it with the manager
        this.clipboardListener = (event: ClipboardEvent) => {
            try {
                const metadata = calculateClipboardMetadata(event);
                // The clipboard manager already handles blocking logic and logging
                // We just need to emit the D-Bus signal for non-blocked events

                // Emit D-Bus signal with comprehensive clipboard information
                // Format: (sussssts) = string, uint32, string, string, string, string, uint64, string
                logger(
                    `Debug: Emitting D-Bus signal for ${metadata.sourceApp} with data:`,
                    {
                        content: `${event.content.substring(0, 50)}...`,
                        timestamp: event.timestamp,
                        source: event.source,
                        mimeType: metadata.mimeType,
                        contentType: metadata.contentType,
                        contentHash: metadata.contentHash,
                        size: metadata.size,
                        sourceApp: metadata.sourceApp,
                    },
                );

                this.dbusObject?.emit_signal(
                    "ClipboardChanged",
                    GLib.Variant.new("(sussssts)", [
                        String(event.content), // Ensure string
                        Number(event.timestamp), // Ensure uint32
                        String(event.source), // Ensure string
                        String(metadata.mimeType), // Ensure string
                        String(metadata.contentType), // Ensure string
                        String(metadata.contentHash), // Ensure string
                        Number(metadata.size), // Ensure uint64
                        String(metadata.sourceApp), // Ensure string
                    ]),
                );

                logger(`D-Bus signal emitted for ${metadata.sourceApp}`);
            } catch (signalError) {
                logger("Error emitting D-Bus clipboard signal", {
                    error: signalError,
                    errorType: typeof signalError,
                    errorMessage:
                        signalError instanceof Error
                            ? signalError.message
                            : String(signalError),
                    stack:
                        signalError instanceof Error
                            ? signalError.stack
                            : undefined,
                    data: {
                        content: event.content.substring(0, 50),
                        timestamp: event.timestamp,
                        source: event.source,
                        mimeType: "unknown",
                        contentType: "unknown",
                        contentHash: "unknown",
                        size: 0,
                        sourceApp: "unknown",
                    },
                });
            }
        };

        // Register the listener with the clipboard manager
        this.clipboardManager.onClipboardChange(this.clipboardListener);
        this.isListening = true;

        logger("📡 D-Bus clipboard listener activated");
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
