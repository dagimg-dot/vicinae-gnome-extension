import type Gio from "gi://Gio";
import GLib from "gi://GLib";
import type { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import {
    CLIPBOARD_CONFIG,
    calculateClipboardMetadata,
} from "../../../utils/clipboard-utils.js";
import { logger } from "../../../utils/logger.js";
import type { VicinaeClipboardManager } from "../../clipboard/clipboard-manager.js";
import type { BufferLike, ClipboardEvent } from "../../clipboard/types.js";

export class ClipboardService {
    private clipboardManager: VicinaeClipboardManager;
    private dbusObject: Gio.DBusExportedObject | null = null;
    private clipboardListener: ((event: ClipboardEvent) => void) | null = null;
    private isListening = false;

    constructor(
        clipboardManager: VicinaeClipboardManager,
        _extension?: Extension,
    ) {
        this.clipboardManager = clipboardManager;
        logger.info("ClipboardService initialized with binary-only protocol");
    }

    // Method to set the D-Bus exported object (called by DBusManager)
    setDBusObject(dbusObject: Gio.DBusExportedObject): void {
        this.dbusObject = dbusObject;

        // Set up the clipboard event listener and register it with the manager
        this.clipboardListener = (event: ClipboardEvent) => {
            try {
                // Skip empty content
                if (!event.content || event.content.length === 0) {
                    logger.debug("Skipping empty clipboard content");
                    return;
                }

                const metadata = calculateClipboardMetadata(event);

                let content: Uint8Array;
                let finalMimeType = metadata.mimeType;

                if (event.content.startsWith("[BINARY_IMAGE:")) {
                    const binaryInfo = this.clipboardManager.getBinaryData(
                        event.content,
                    );
                    if (binaryInfo) {
                        content = this.bufferLikeToUint8Array(binaryInfo.data);
                        finalMimeType = binaryInfo.mimeType;

                        logger.debug(
                            `Using direct binary data: ${finalMimeType}, ${content.length} bytes`,
                        );
                    } else {
                        logger.warn(
                            `Binary data not found for marker: ${event.content}`,
                        );
                        return;
                    }
                } else {
                    // For text content, encode as UTF-8
                    content = new TextEncoder().encode(event.content);
                }

                if (content.length > CLIPBOARD_CONFIG.MAX_CLIPBOARD_SIZE) {
                    logger.warn(
                        `Clipboard data too large: ${content.length} bytes, skipping`,
                    );
                    return;
                }

                logger.debug(
                    `Processing clipboard: ${finalMimeType}, ${content.length} bytes from ${metadata.sourceApp}`,
                );

                this.emitBinarySignal(content, {
                    mimeType: finalMimeType,
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

        // Register the listener with the clipboard manager
        this.clipboardManager.onClipboardChange(this.clipboardListener);
        this.isListening = true;

        logger.info("📡 Binary-only D-Bus clipboard listener activated");
    }

    private bufferLikeToUint8Array(buffer: BufferLike): Uint8Array {
        if (buffer instanceof Uint8Array) {
            return buffer;
        }

        if (buffer instanceof ArrayBuffer) {
            return new Uint8Array(buffer);
        }

        if (buffer && typeof buffer === "object" && "length" in buffer) {
            const uint8Array = new Uint8Array(buffer.length);
            for (let i = 0; i < buffer.length; i++) {
                uint8Array[i] = buffer[i];
            }
            return uint8Array;
        }

        throw new Error(`Unsupported buffer type: ${typeof buffer}`);
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
