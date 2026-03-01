import type Gio from "gi://Gio";
import GLib from "gi://GLib";
import type { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import {
    CLIPBOARD_CONFIG,
    calculateClipboardMetadata,
} from "../../../utils/clipboard-utils.js";
import { logger } from "../../../utils/logger.js";
import type { VicinaeClipboardManager } from "../../clipboard/clipboard-manager.js";
import { createHandlers } from "../../clipboard/handlers/index.js";
import type { ClipboardContentHandler } from "../../clipboard/handlers/types.js";
import type { ClipboardEvent } from "../../clipboard/types.js";

export class ClipboardService {
    private clipboardManager: VicinaeClipboardManager;
    private contentHandlers: ClipboardContentHandler[];
    private dbusObject: Gio.DBusExportedObject | null = null;
    private clipboardListener: ((event: ClipboardEvent) => void) | null = null;
    private isListening = false;

    constructor(
        clipboardManager: VicinaeClipboardManager,
        _extension?: Extension,
    ) {
        this.clipboardManager = clipboardManager;
        this.contentHandlers = createHandlers();
        logger.info("ClipboardService initialized with binary-only protocol");
    }

    // Method to set the D-Bus exported object (called by DBusManager)
    setDBusObject(dbusObject: Gio.DBusExportedObject): void {
        this.dbusObject = dbusObject;

        const signalPayloadContext = {
            getBinaryData: (marker: string) =>
                this.clipboardManager.getBinaryData(marker),
        };

        this.clipboardListener = (event: ClipboardEvent) => {
            try {
                if (!event.content || event.content.length === 0) {
                    logger.debug("Skipping empty clipboard content");
                    return;
                }

                const metadata = calculateClipboardMetadata(event);

                const handler = this.contentHandlers
                    .slice()
                    .sort((a, b) => b.priority - a.priority)
                    .find((h) => h.matchesContent(event.content));

                const payload = handler?.toSignalPayload(
                    event,
                    signalPayloadContext,
                );

                if (!payload) {
                    logger.warn(
                        `No handler produced payload for content: ${event.content.substring(0, 50)}...`,
                    );
                    return;
                }

                if (
                    payload.content.length > CLIPBOARD_CONFIG.MAX_CLIPBOARD_SIZE
                ) {
                    logger.warn(
                        `Clipboard data too large: ${payload.content.length} bytes, skipping`,
                    );
                    return;
                }

                logger.debug(
                    `Processing clipboard: ${payload.mimeType}, ${payload.content.length} bytes from ${metadata.sourceApp}`,
                );

                this.emitBinarySignal(payload.content, {
                    mimeType: payload.mimeType,
                    sourceApp: metadata.sourceApp,
                });
            } catch (signalError) {
                logger.error("Error processing clipboard event", {
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
                });
            }
        };

        this.clipboardManager.onClipboardChange(this.clipboardListener);
        this.isListening = true;

        logger.info("📡 Binary-only D-Bus clipboard listener activated");
    }

    private emitBinarySignal(
        content: Uint8Array,
        metadata: {
            mimeType: string;
            sourceApp: string;
        },
    ) {
        try {
            logger.debug(
                `Emitting binary signal: ${metadata.mimeType}, ${content.length} bytes`,
            );

            this.dbusObject?.emit_signal(
                "ClipboardChanged",
                GLib.Variant.new("(ayss)", [
                    content,
                    String(metadata.mimeType),
                    String(metadata.sourceApp),
                ]),
            );

            logger.info(
                `Binary signal emitted: ${metadata.mimeType}, ${content.length} bytes`,
            );
        } catch (error) {
            logger.error("Failed to emit binary signal", error);
            throw error;
        }
    }

    // Method to start listening to clipboard changes
    ListenToClipboardChanges(): void {
        try {
            if (!this.isListening && this.clipboardListener) {
                logger.debug("D-Bus: Starting clipboard listener...");
                this.clipboardManager.onClipboardChange(this.clipboardListener);
                this.isListening = true;
                logger.info(
                    "📡 Binary D-Bus clipboard listener activated via method call",
                );
            } else if (this.isListening) {
                logger.debug("D-Bus: Clipboard listener already active");
            } else {
                logger.warn("D-Bus: No clipboard listener available");
            }
        } catch (error) {
            logger.error("D-Bus: Error starting clipboard listener", error);
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
            logger.error("D-Bus: Error triggering clipboard change", error);
            throw error;
        }
    }

    // Method to get current clipboard content
    GetCurrentContent(): string {
        try {
            return this.clipboardManager.getCurrentContent();
        } catch (error) {
            logger.error(
                "D-Bus: Error getting current clipboard content",
                error,
            );
            throw error;
        }
    }

    // Method to set clipboard content
    SetContent(content: string): void {
        try {
            this.clipboardManager.setContent(content);
        } catch (error) {
            logger.error("D-Bus: Error setting clipboard content", error);
            throw error;
        }
    }

    // Method to set binary clipboard content
    SetContentBinary(content: Uint8Array, mimeType: string): void {
        try {
            this.clipboardManager.setContentBinary(content, mimeType);
        } catch (error) {
            logger.error(
                "D-Bus: Error setting binary clipboard content",
                error,
            );
            throw error;
        }
    }

    // Method to get available MIME types
    GetClipboardMimeTypes(): string[] {
        try {
            return [
                "text/plain",
                "text/uri-list",
                "text/html",
                "image/png",
                "image/jpeg",
                "image/gif",
                "image/webp",
                "application/x-vicinae-concealed",
            ];
        } catch (error) {
            logger.error("D-Bus: Error getting clipboard MIME types", error);
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
                logger.info("🔕 Binary D-Bus clipboard listener deactivated");
            }
        } catch (error) {
            logger.error("Error stopping clipboard listener", error);
        }
    }

    // Cleanup method
    destroy(): void {
        this.StopListening();
        this.dbusObject = null;
        logger.info("ClipboardService destroyed");
    }
}
