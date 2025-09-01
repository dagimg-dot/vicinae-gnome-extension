import type Gio from "gi://Gio";
import type GLib from "gi://GLib";
import Meta from "gi://Meta";
import Shell from "gi://Shell";
import St from "gi://St";
import {
    bufferToBase64,
    calculateClipboardMetadata,
    getImageMimeType,
    isValidImageBuffer,
} from "../../utils/clipboard-utils.js";
import { debug, info, error as logError, warn } from "../../utils/logger.js";
import type { ClipboardEvent, ImageContent } from "./types.js";

export class VicinaeClipboardManager {
    private eventListeners: ((event: ClipboardEvent) => void)[] = [];
    private currentContent: string = "";
    private clipboard: St.Clipboard | null = null;
    private selection: Meta.Selection | null = null;
    private _selectionOwnerChangedId: number | null = null;
    private _debouncing: number = 0;
    private settings: Gio.Settings | null = null;

    constructor() {
        this.setupClipboardMonitoring();
    }

    // Method to set settings from external source (like main extension)
    setSettings(settings: Gio.Settings): void {
        this.settings = settings;
        info("Settings set in clipboard manager from external source");

        // Debug: Log current blocked applications
        try {
            const blockedApps = this.settings.get_strv("blocked-applications");
            debug(`Current blocked applications: [${blockedApps.join(", ")}]`);
        } catch (err) {
            logError("Error reading blocked applications from settings", err);
        }
    }

    // Method to update settings when they change
    updateSettings(settings: Gio.Settings): void {
        this.settings = settings;
        info("Settings updated in clipboard manager");

        // Debug: Log updated blocked applications
        try {
            const blockedApps = this.settings.get_strv("blocked-applications");
            debug(`Updated blocked applications: [${blockedApps.join(", ")}]`);
        } catch (err) {
            logError(
                "Error reading updated blocked applications from settings",
                err,
            );
        }
    }

    private isApplicationBlocked(sourceApp: string): boolean {
        if (!this.settings) {
            warn(
                "No settings available in clipboard manager - blocking logic disabled",
            );
            return false; // If no settings, don't block anything
        }

        try {
            const blockedApps = this.settings.get_strv("blocked-applications");
            debug(
                `Checking if ${sourceApp} is blocked. Blocked apps list: [${blockedApps.join(", ")}]`,
            );

            const isBlocked = blockedApps.some(
                (blockedApp: string) =>
                    sourceApp
                        .toLowerCase()
                        .includes(blockedApp.toLowerCase()) ||
                    blockedApp.toLowerCase().includes(sourceApp.toLowerCase()),
            );

            if (isBlocked) {
                debug(
                    `Application ${sourceApp} is blocked from clipboard access`,
                );
            } else {
                debug(
                    `Application ${sourceApp} is NOT blocked (not in blocked apps list)`,
                );
            }

            return isBlocked;
        } catch (error) {
            logError(
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
        // Only block text content, not images or other binary content
        // This prevents blocking screenshots when the last focused app was blocked
        return contentType === "text" || mimeType.startsWith("text/");
    }

    private setupClipboardMonitoring() {
        try {
            // Get the default clipboard (St.Clipboard is the correct way for GNOME Shell)
            this.clipboard = St.Clipboard.get_default();

            // Get the global selection object for monitoring clipboard changes
            this.selection = Shell.Global.get().get_display().get_selection();

            if (this.selection) {
                // Listen to 'owner-changed' signal (this is the correct approach)
                this._selectionOwnerChangedId = this.selection.connect(
                    "owner-changed",
                    this.onSelectionOwnerChanged.bind(this),
                );

                // Get initial content
                this.queryClipboard();

                info(
                    "Clipboard monitoring set up successfully using selection listener",
                );
            } else {
                logError("Failed to get selection instance");
            }
        } catch (error) {
            logError("Error setting up clipboard monitoring", error);
        }
    }

    private onSelectionOwnerChanged(
        _: unknown,
        selectionType: Meta.SelectionType,
    ) {
        // When clipboard selection changes, query the clipboard
        if (selectionType === Meta.SelectionType.SELECTION_CLIPBOARD) {
            this.queryClipboard();
        }
    }

    private queryClipboard() {
        if (!this.clipboard) return;

        try {
            // Check for text content in CLIPBOARD
            this.clipboard.get_text(St.ClipboardType.CLIPBOARD, (_, text) => {
                if (text) {
                    this.processClipboardContent(text, "system");
                }
            });

            // Check for text content in PRIMARY (screenshots often use this)
            this.clipboard.get_text(St.ClipboardType.PRIMARY, (_, text) => {
                if (text) {
                    this.processClipboardContent(text, "system");
                }
            });

            // Check available MIME types to see what's in the clipboard
            const mimeTypes = this.clipboard.get_mimetypes(
                St.ClipboardType.CLIPBOARD,
            );
            if (mimeTypes.length > 0) {
                // Check if image data is available
                if (mimeTypes.some((type) => type.startsWith("image/"))) {
                    // Capture the actual image data
                    this.captureImageData();
                }
            }
        } catch (error) {
            logError("Error querying clipboard", error);
        }
    }

    private captureImageData() {
        if (!this.clipboard) return;

        try {
            // Try to get the actual content using get_content
            try {
                this.clipboard.get_content(
                    St.ClipboardType.CLIPBOARD,
                    "image/png", // MIME type we want
                    (_: unknown, content: unknown) => {
                        if (content) {
                            // Process the content if it contains image data
                            if (content && typeof content === "object") {
                                // Check if it's a GLib.Bytes object
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
                                    // Type guard to ensure content has required properties
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
            logError("Error capturing image data", error);
        }
    }

    private processImageContent(content: ImageContent) {
        try {
            // Try to extract image data from the content object
            if (content.data && content.data.length > 0) {
                // Validate if this is actually image data
                const isValid = isValidImageBuffer(content.data);
                const detectedMimeType = getImageMimeType(content.data);
                const finalMimeType = content.mimeType || detectedMimeType;

                if (isValid) {
                    // Convert to base64 if it's binary data
                    const base64Data = bufferToBase64(content.data);
                    const imageContent = `data:${finalMimeType};base64,${base64Data}`;

                    this.processClipboardContent(imageContent, "image");
                } else {
                    this.processClipboardContent(
                        "[BINARY_DATA_AVAILABLE]",
                        "system",
                    );
                }
            } else {
                this.processClipboardContent(
                    "[IMAGE_DATA_AVAILABLE]",
                    "system",
                );
            }
        } catch (error) {
            logError("Error processing image content", error);
            this.processClipboardContent("[IMAGE_DATA_AVAILABLE]", "system");
        }
    }

    private extractGLibBytesData(bytes: GLib.Bytes) {
        try {
            // Try different methods to extract the data

            if (typeof bytes.get_data === "function") {
                try {
                    const data = bytes.get_data();

                    if (data && data.length > 0) {
                        // Validate if this is actually image data
                        const isValid = isValidImageBuffer(data);
                        const mimeType = getImageMimeType(data);

                        if (isValid) {
                            // Convert to base64 for transmission
                            const base64Data = bufferToBase64(data);

                            // Emit the actual image data with metadata
                            const imageContent = `data:${mimeType};base64,${base64Data}`;
                            this.processClipboardContent(imageContent, "image");
                        } else {
                            this.processClipboardContent(
                                "[BINARY_DATA_AVAILABLE]",
                                "system",
                            );
                        }
                    }
                } catch (getDataError) {
                    logError("get_data failed", getDataError);
                }
            }

            if (typeof bytes.toArray === "function") {
                try {
                    const array = bytes.toArray();

                    // If get_data failed but toArray works, try with the array
                    if (array && array.length > 0) {
                        const isValid = isValidImageBuffer(array);
                        const mimeType = getImageMimeType(array);

                        if (isValid) {
                            const base64Data = bufferToBase64(array);

                            const imageContent = `data:${mimeType};base64,${base64Data}`;
                            this.processClipboardContent(imageContent, "image");
                        }
                    }
                } catch (toArrayError) {
                    logError("to_array failed", toArrayError);
                }
            }
        } catch (error) {
            logError("Error extracting GLib.Bytes data", error);
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
            this.shouldBlockContentType(
                metadata.contentType,
                metadata.mimeType,
            );

        debug("🎯 CLIPBOARD EVENT EMITTED", {
            type: event.type,
            content:
                content.length > 100
                    ? `${content.substring(0, 100)}...`
                    : content,
            contentLength: content.length,
            timestamp: new Date(event.timestamp).toISOString(),
            source: event.source,
            listeners: this.eventListeners.length,
            // Enhanced metadata fields (same as DBUS emission)
            mimeType: metadata.mimeType,
            contentType: metadata.contentType,
            contentHash: metadata.contentHash,
            size: metadata.size,
            sourceApp: metadata.sourceApp,
            // Blocking status for user visibility
            isBlocked: isBlocked,
            shouldBlock: shouldBlock,
            note: shouldBlock
                ? "⚠️ This event will be blocked by clipboard manager"
                : "✅ Event will be processed normally",
        });

        // Block the event if it should be blocked - don't notify listeners
        if (shouldBlock) {
            debug(
                `🚫 Clipboard access blocked for application: ${metadata.sourceApp} (${metadata.contentType}) - Event not forwarded to listeners`,
            );
            return; // Don't emit to listeners for blocked applications
        }

        // Only emit to listeners if not blocked
        this.eventListeners.forEach((listener) => {
            try {
                listener(event);
            } catch (error) {
                logError("❌ Error in clipboard event listener", error);
            }
        });
    }

    // Method for external components to listen to clipboard events
    onClipboardChange(listener: (event: ClipboardEvent) => void): void {
        this.eventListeners.push(listener);
        debug("👂 Clipboard change listener added");
    }

    // Method to remove a listener
    removeClipboardListener(listener: (event: ClipboardEvent) => void): void {
        const index = this.eventListeners.indexOf(listener);
        if (index > -1) {
            this.eventListeners.splice(index, 1);
            debug("Clipboard change listener removed");
        }
    }

    // Method to get current clipboard content
    getCurrentContent(): string {
        return this.currentContent;
    }

    // Method to set clipboard content
    setContent(content: string): void {
        if (this.clipboard) {
            try {
                // Set both clipboard and primary selection
                this.clipboard.set_text(St.ClipboardType.CLIPBOARD, content);
                this.clipboard.set_text(St.ClipboardType.PRIMARY, content);

                this.currentContent = content;
                this.emitClipboardEvent(content, "user");
            } catch (error) {
                logError("Error setting clipboard content", error);
            }
        }
    }

    // Method to manually trigger clipboard change (for testing or external triggers)
    triggerClipboardChange(
        content: string,
        source: "user" | "system" | "image" = "user",
    ): void {
        this.emitClipboardEvent(content, source);
    }

    // Cleanup method
    destroy(): void {
        if (this.selection && this._selectionOwnerChangedId) {
            try {
                this.selection.disconnect(this._selectionOwnerChangedId);
                this._selectionOwnerChangedId = null;
            } catch (edit_error) {
                logError("Error disconnecting selection listener", edit_error);
            }
        }

        this.eventListeners = [];
        this.currentContent = "";
        this.clipboard = null;
        this.selection = null;
        info("Clipboard manager destroyed");
    }
}
