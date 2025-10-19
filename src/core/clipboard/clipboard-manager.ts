import Clutter from "gi://Clutter";
import type Gio from "gi://Gio";
import GLib from "gi://GLib";
import Meta from "gi://Meta";
import Shell from "gi://Shell";
import St from "gi://St";
import {
    calculateClipboardMetadata,
    getImageMimeType,
    isValidImageBuffer,
} from "../../utils/clipboard-utils.js";
import { logger } from "../../utils/logger.js";
import type { BufferLike, ClipboardEvent, ImageContent } from "./types.js";

// VirtualKeyboard will be passed from the main extension

export class VicinaeClipboardManager {
    private eventListeners: ((event: ClipboardEvent) => void)[] = [];
    private virtualKeyboard: Clutter.VirtualInputDevice;

    private currentContent: string = "";
    private clipboard: St.Clipboard | null = null;
    private selection: Meta.Selection | null = null;
    private _selectionOwnerChangedId: number | null = null;
    private _debouncing: number = 0;
    private settings: Gio.Settings | null = null;
    public pasteHackCallbackId: number | null = null;

    constructor(virtualKeyboard: Clutter.VirtualInputDevice) {
        this.virtualKeyboard = virtualKeyboard;
        this.setupClipboardMonitoring();
    }

    setSettings(settings: Gio.Settings): void {
        this.settings = settings;
        logger.info("Settings set in clipboard manager from external source");

        try {
            const blockedApps = this.settings.get_strv("blocked-applications");
            logger.debug(
                `Current blocked applications: [${blockedApps.join(", ")}]`,
            );
        } catch (err) {
            logger.error(
                "Error reading blocked applications from settings",
                err,
            );
        }
    }

    updateSettings(settings: Gio.Settings): void {
        this.settings = settings;
        logger.info("Settings updated in clipboard manager");

        try {
            const blockedApps = this.settings.get_strv("blocked-applications");
            logger.debug(
                `Updated blocked applications: [${blockedApps.join(", ")}]`,
            );
        } catch (err) {
            logger.error(
                "Error reading updated blocked applications from settings",
                err,
            );
        }
    }

    private isApplicationBlocked(sourceApp: string): boolean {
        if (!this.settings) {
            logger.warn(
                "No settings available in clipboard manager - blocking logic disabled",
            );
            return false; // If no settings, don't block anything
        }

        try {
            const blockedApps = this.settings.get_strv("blocked-applications");
            logger.debug(
                `Checking if ${sourceApp} is blocked. Blocked apps list: [${blockedApps.join(
                    ", ",
                )}]`,
            );

            const isBlocked = blockedApps.some(
                (blockedApp: string) =>
                    sourceApp
                        .toLowerCase()
                        .includes(blockedApp.toLowerCase()) ||
                    blockedApp.toLowerCase().includes(sourceApp.toLowerCase()),
            );

            if (isBlocked) {
                logger.debug(
                    `Application ${sourceApp} is blocked from clipboard access`,
                );
            } else {
                logger.debug(
                    `Application ${sourceApp} is NOT blocked (not in blocked apps list)`,
                );
            }

            return isBlocked;
        } catch (error) {
            logger.error(
                "Error checking blocked applications in clipboard manager",
                error,
            );
            return false;
        }
    }

    private shouldBlockContentType(
        contentType: string,
        mimeType: string,
    ): boolean {
        return contentType === "text" || mimeType.startsWith("text/");
    }

    private setupClipboardMonitoring() {
        try {
            this.clipboard = St.Clipboard.get_default();
            this.selection = Shell.Global.get().get_display().get_selection();

            if (this.selection) {
                this._selectionOwnerChangedId = this.selection.connect(
                    "owner-changed",
                    this.onSelectionOwnerChanged.bind(this),
                );

                this.queryClipboard();

                logger.info(
                    "Clipboard monitoring set up successfully using selection listener",
                );
            } else {
                logger.error("Failed to get selection instance");
            }
        } catch (error) {
            logger.error("Error setting up clipboard monitoring", error);
        }
    }

    private onSelectionOwnerChanged(
        _: unknown,
        selectionType: Meta.SelectionType,
    ) {
        if (selectionType === Meta.SelectionType.SELECTION_CLIPBOARD) {
            this.queryClipboard();
        }
    }

    private queryClipboard() {
        if (!this.clipboard) return;

        try {
            this.clipboard.get_text(St.ClipboardType.CLIPBOARD, (_, text) => {
                if (text) {
                    this.processClipboardContent(text, "system");
                }
            });

            this.clipboard.get_text(St.ClipboardType.PRIMARY, (_, text) => {
                if (text) {
                    this.processClipboardContent(text, "system");
                }
            });

            const mimeTypes = this.clipboard.get_mimetypes(
                St.ClipboardType.CLIPBOARD,
            );
            if (mimeTypes.length > 0) {
                if (mimeTypes.some((type) => type.startsWith("image/"))) {
                    this.captureImageData();
                }
            }
        } catch (error) {
            logger.error("Error querying clipboard", error);
        }
    }

    private captureImageData() {
        if (!this.clipboard) return;

        try {
            try {
                this.clipboard.get_content(
                    St.ClipboardType.CLIPBOARD,
                    "image/png",
                    (_: unknown, content: unknown) => {
                        if (content) {
                            if (content && typeof content === "object") {
                                if (
                                    content.constructor &&
                                    (content.constructor.name ===
                                        "GLib.Bytes" ||
                                        content.constructor.name.includes(
                                            "GLib.Bytes",
                                        ) ||
                                        content.constructor.name.includes(
                                            "Bytes",
                                        ))
                                ) {
                                    this.extractGLibBytesData(
                                        content as GLib.Bytes,
                                    );
                                } else {
                                    if (
                                        content &&
                                        typeof content === "object" &&
                                        "data" in content
                                    ) {
                                        this.processImageContent(
                                            content as ImageContent,
                                        );
                                    } else {
                                        this.processClipboardContent(
                                            "[IMAGE_DATA_AVAILABLE]",
                                            "system",
                                        );
                                    }
                                }
                            }
                        }
                    },
                );
            } catch (_contentError) {
                this.processClipboardContent(
                    "[IMAGE_DATA_AVAILABLE]",
                    "system",
                );
            }
        } catch (error) {
            logger.error("Error capturing image data", error);
        }
    }

    private processImageContent(content: ImageContent) {
        try {
            if (content.data && content.data.length > 0) {
                const isValid = isValidImageBuffer(content.data);
                const detectedMimeType = getImageMimeType(content.data);
                const finalMimeType = content.mimeType || detectedMimeType;

                if (isValid) {
                    logger.debug(
                        `Processed image content: ${finalMimeType}, ${content.data.length} bytes`,
                    );

                    const binaryMarker = `[BINARY_IMAGE:${finalMimeType}:${content.data.length}]`;
                    this.storeBinaryData(
                        binaryMarker,
                        content.data,
                        finalMimeType,
                    );

                    this.processClipboardContent(binaryMarker, "image");
                } else {
                    logger.warn(
                        `Invalid image buffer detected: ${content.data.length} bytes`,
                    );
                    this.processClipboardContent(
                        "[BINARY_DATA_AVAILABLE]",
                        "system",
                    );
                }
            } else {
                logger.debug("No image data available in content object");
                this.processClipboardContent(
                    "[IMAGE_DATA_AVAILABLE]",
                    "system",
                );
            }
        } catch (error) {
            logger.error("Error processing image content", error);
            this.processClipboardContent("[IMAGE_DATA_AVAILABLE]", "system");
        }
    }

    private binaryDataStore = new Map<
        string,
        { data: BufferLike; mimeType: string }
    >();

    private storeBinaryData(
        marker: string,
        data: BufferLike,
        mimeType: string,
    ) {
        this.binaryDataStore.set(marker, { data, mimeType });
        logger.debug(`Stored binary data: ${marker}`);
    }

    getBinaryData(
        marker: string,
    ): { data: BufferLike; mimeType: string } | null {
        return this.binaryDataStore.get(marker) || null;
    }

    private extractGLibBytesData(bytes: GLib.Bytes) {
        try {
            if (typeof bytes.get_data === "function") {
                try {
                    const data = bytes.get_data();

                    if (data && data.length > 0) {
                        const isValid = isValidImageBuffer(data);
                        const mimeType = getImageMimeType(data);

                        if (isValid) {
                            const binaryMarker = `[BINARY_IMAGE:${mimeType}:${data.length}]`;
                            this.storeBinaryData(binaryMarker, data, mimeType);

                            logger.debug(
                                `Extracted GLib.Bytes data: ${mimeType}, ${data.length} bytes`,
                            );
                            this.processClipboardContent(binaryMarker, "image");
                        } else {
                            logger.warn(
                                `Invalid image buffer from get_data: ${data.length} bytes`,
                            );
                            this.processClipboardContent(
                                "[BINARY_DATA_AVAILABLE]",
                                "system",
                            );
                        }
                    }
                } catch (getDataError) {
                    logger.error("get_data failed", getDataError);
                }
            }

            if (typeof bytes.toArray === "function") {
                try {
                    const array = bytes.toArray();

                    if (array && array.length > 0) {
                        const isValid = isValidImageBuffer(array);
                        const mimeType = getImageMimeType(array);

                        if (isValid) {
                            const binaryMarker = `[BINARY_IMAGE:${mimeType}:${array.length}]`;
                            this.storeBinaryData(binaryMarker, array, mimeType);

                            logger.debug(
                                `Extracted GLib.Bytes array data: ${mimeType}, ${array.length} bytes`,
                            );
                            this.processClipboardContent(binaryMarker, "image");
                        }
                    }
                } catch (toArrayError) {
                    logger.error("to_array failed", toArrayError);
                }
            }
        } catch (error) {
            logger.error("Error extracting GLib.Bytes data", error);
        }
    }

    private processClipboardContent(
        text: string,
        source: "user" | "system" | "image",
    ) {
        if (this._debouncing > 0) {
            this._debouncing--;
            return;
        }

        if (!text || text === this.currentContent) {
            return;
        }

        this.currentContent = text;
        this.emitClipboardEvent(text, source);
    }

    // Method to emit clipboard change events
    private emitClipboardEvent(
        content: string,
        source: "user" | "system" | "image" = "user",
    ) {
        const event: ClipboardEvent = {
            type: "clipboard-changed",
            content,
            timestamp: Date.now(),
            source,
            contentType: source === "image" ? "image" : "text",
        };

        // Get comprehensive metadata using the utility function
        const metadata = calculateClipboardMetadata(event);

        // Check blocking status for logging purposes
        const isBlocked = this.isApplicationBlocked(metadata.sourceApp);
        const shouldBlock =
            isBlocked &&
            this.shouldBlockContentType(event.contentType, metadata.mimeType);

        logger.debug("🎯 CLIPBOARD EVENT EMITTED", {
            type: event.type,
            content:
                content.length > 100
                    ? `${content.substring(0, 100)}...`
                    : content,
            contentLength: content.length,
            timestamp: new Date(event.timestamp).toISOString(),
            source: event.source,
            listeners: this.eventListeners.length,
            mimeType: metadata.mimeType,
            contentType: event.contentType,
            sourceApp: metadata.sourceApp,
            isBlocked: isBlocked,
            shouldBlock: shouldBlock,
            note: shouldBlock
                ? "⚠️ This event will be blocked by clipboard manager"
                : "✅ Event will be processed normally",
        });

        if (shouldBlock) {
            logger.debug(
                `🚫 Clipboard access blocked for application: ${metadata.sourceApp} (${event.contentType}) - Event not forwarded to listeners`,
            );
            return;
        }
        this.eventListeners.forEach((listener) => {
            try {
                listener(event);
            } catch (error) {
                logger.error("❌ Error in clipboard event listener", error);
            }
        });
    }

    onClipboardChange(listener: (event: ClipboardEvent) => void): void {
        this.eventListeners.push(listener);
        logger.debug("👂 Clipboard change listener added");
    }

    removeClipboardListener(listener: (event: ClipboardEvent) => void): void {
        const index = this.eventListeners.indexOf(listener);
        if (index > -1) {
            this.eventListeners.splice(index, 1);
            logger.debug("Clipboard change listener removed");
        }
    }

    getCurrentContent(): string {
        return this.currentContent;
    }

    setContent(content: string): void {
        if (this.clipboard) {
            try {
                this.clipboard.set_text(St.ClipboardType.CLIPBOARD, content);
                this.clipboard.set_text(St.ClipboardType.PRIMARY, content);

                this.currentContent = content;
                this.emitClipboardEvent(content, "user");
            } catch (error) {
                logger.error("Error setting clipboard content", error);
            }
        }
    }

    triggerClipboardChange(
        content: string,
        source: "user" | "system" | "image" = "user",
    ): void {
        this.emitClipboardEvent(content, source);
    }

    triggerKeyboardPaste() {
        logger.debug("Trigger keyboard paste called");
        this.pasteHackCallbackId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            1, // Just post to the end of the event loop
            () => {
                const SHIFT_L = 42;
                const INSERT = 110;

                const eventTime = Clutter.get_current_event_time() * 1000;
                this.virtualKeyboard.notify_key(
                    eventTime,
                    SHIFT_L,
                    Clutter.KeyState.PRESSED,
                );
                this.virtualKeyboard.notify_key(
                    eventTime,
                    INSERT,
                    Clutter.KeyState.PRESSED,
                );
                this.virtualKeyboard.notify_key(
                    eventTime,
                    INSERT,
                    Clutter.KeyState.RELEASED,
                );
                this.virtualKeyboard.notify_key(
                    eventTime,
                    SHIFT_L,
                    Clutter.KeyState.RELEASED,
                );

                this.pasteHackCallbackId = null;
                return false;
            },
        );
    }

    destroy(): void {
        if (this.selection && this._selectionOwnerChangedId) {
            try {
                this.selection.disconnect(this._selectionOwnerChangedId);
                this._selectionOwnerChangedId = null;
            } catch (edit_error) {
                logger.error(
                    "Error disconnecting selection listener",
                    edit_error,
                );
            }
        }

        this.eventListeners = [];
        this.currentContent = "";
        this.clipboard = null;
        this.selection = null;
        logger.info("Clipboard manager destroyed");
    }
}
