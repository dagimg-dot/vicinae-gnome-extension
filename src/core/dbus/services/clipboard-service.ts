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
    private settings: Gio.Settings | null = null;

    constructor(
        clipboardManager: VicinaeClipboardManager,
        extension?: Extension,
    ) {
        // Use the provided clipboard manager instead of creating a new one
        this.clipboardManager = clipboardManager;

        // Get settings from extension if provided
        if (extension) {
            try {
                this.settings = extension.getSettings();
            } catch (error) {
                logger("Could not access settings in clipboard service", error);
            }
        }

        logger("ClipboardService initialized with shared clipboard manager");
    }

    // Method to set the D-Bus exported object (called by DBusManager)
    setDBusObject(dbusObject: Gio.DBusExportedObject): void {
        this.dbusObject = dbusObject;
    }

    // Helper method to check if an application is blocked
    private isApplicationBlocked(sourceApp: string): boolean {
        if (!this.settings) {
            return false; // If no settings, don't block anything
        }

        try {
            const blockedApps = this.settings.get_strv("blocked-applications");
            return blockedApps.some(
                (blockedApp: string) =>
                    sourceApp
                        .toLowerCase()
                        .includes(blockedApp.toLowerCase()) ||
                    blockedApp.toLowerCase().includes(sourceApp.toLowerCase()),
            );
        } catch (error) {
            logger("Error checking blocked applications", error);
            return false;
        }
    }

    // Helper method to check if content type should be blocked
    private shouldBlockContentType(
        contentType: string,
        mimeType: string,
    ): boolean {
        // Only block text content, not images or other binary content
        // This prevents blocking screenshots when the last focused app was blocked
        return contentType === "text" || mimeType.startsWith("text/");
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

                    // Check if the source application is blocked
                    const isBlocked = this.isApplicationBlocked(
                        metadata.sourceApp,
                    );
                    const shouldBlock =
                        isBlocked &&
                        this.shouldBlockContentType(
                            metadata.contentType,
                            metadata.mimeType,
                        );

                    // Log the event with blocked status
                    logger(
                        `Clipboard event from ${metadata.sourceApp}: ` +
                            `type=${metadata.contentType}, ` +
                            `mime=${metadata.mimeType}, ` +
                            `isBlocked=${isBlocked}, ` +
                            `shouldBlock=${shouldBlock}, ` +
                            `contentLength=${metadata.size}`,
                    );

                    // Block the event if it should be blocked
                    if (shouldBlock) {
                        logger(
                            `Clipboard access blocked for application: ${metadata.sourceApp} (${metadata.contentType})`,
                        );
                        return; // Don't emit signal for blocked applications
                    }

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

                    logger(`D-Bus signal emitted for ${metadata.sourceApp}`);
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
        this.settings = null;
    }
}
