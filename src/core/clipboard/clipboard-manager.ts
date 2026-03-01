import Clutter from "gi://Clutter";
import type Gio from "gi://Gio";
import GLib from "gi://GLib";
import Meta from "gi://Meta";
import Shell from "gi://Shell";
import St from "gi://St";
import { calculateClipboardMetadata } from "../../utils/clipboard-utils.js";
import { logger } from "../../utils/logger.js";
import { createHandlers } from "./handlers/index.js";
import type { ClipboardContentHandler } from "./handlers/types.js";
import type { BufferLike, ClipboardEvent } from "./types.js";

// VirtualKeyboard will be passed from the main extension

export class VicinaeClipboardManager {
    private eventListeners: ((event: ClipboardEvent) => void)[] = [];
    private virtualKeyboard: Clutter.VirtualInputDevice;
    private contentHandlers: ClipboardContentHandler[] = [];

    private currentContent: string = "";
    private clipboard: St.Clipboard | null = null;
    private selection: Meta.Selection | null = null;
    private _selectionOwnerChangedId: number | null = null;
    private _debouncing: number = 0;
    private settings: Gio.Settings | null = null;
    public pasteHackCallbackId: number | null = null;

    constructor(virtualKeyboard: Clutter.VirtualInputDevice) {
        this.virtualKeyboard = virtualKeyboard;
        this.contentHandlers = createHandlers();
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
            const mimeTypes = this.clipboard.get_mimetypes(
                St.ClipboardType.CLIPBOARD,
            );

            const handler = this.contentHandlers
                .slice()
                .sort((a, b) => b.priority - a.priority)
                .find((h) => h.matchesMimeTypes(mimeTypes));

            if (handler) {
                const context =
                    handler.priority >= 1
                        ? {
                              storeBinaryData: (
                                  marker: string,
                                  data: unknown,
                                  mimeType: string,
                              ) =>
                                  this.storeBinaryData(
                                      marker,
                                      data as BufferLike,
                                      mimeType,
                                  ),
                          }
                        : undefined;

                handler.capture(
                    this.clipboard,
                    (content) =>
                        this.processClipboardContent(content, "system"),
                    context,
                );
            }

            if (handler && handler.priority >= 1) {
                this.clipboard.get_text(St.ClipboardType.PRIMARY, (_, text) => {
                    if (text) {
                        this.processClipboardContent(text, "system");
                    }
                });
            }
        } catch (error) {
            logger.error("Error querying clipboard", error);
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
        content: string | Uint8Array,
        source: "user" | "system" | "image" = "user",
        mimeType?: string,
    ) {
        // Convert content to string for the event, handling binary data
        let contentString: string;
        let contentType: "text" | "image" = "text";

        if (content instanceof Uint8Array) {
            // For binary data, create a marker similar to how we handle images
            if (mimeType?.startsWith("image/")) {
                contentType = "image";
                contentString = `[BINARY_IMAGE:${mimeType}:${content.length}]`;
            } else {
                contentString = `[BINARY_DATA:${mimeType}:${content.length}]`;
            }
        } else {
            contentString = content;
            contentType = source === "image" ? "image" : "text";
        }

        const event: ClipboardEvent = {
            type: "clipboard-changed",
            content: contentString,
            timestamp: Date.now(),
            source,
            contentType,
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
                contentString.length > 100
                    ? `${contentString.substring(0, 100)}...`
                    : contentString,
            contentLength:
                content instanceof Uint8Array
                    ? content.length
                    : contentString.length,
            originalContentType:
                content instanceof Uint8Array ? "binary" : "string",
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
        if (!this.clipboard) return;

        try {
            const handler = this.contentHandlers
                .slice()
                .sort((a, b) => b.priority - a.priority)
                .find((h) => h.matchesContent(content));

            if (handler?.set(this.clipboard, content)) {
                this.currentContent = content;
                this.emitClipboardEvent(content, "user");
            }
        } catch (error) {
            logger.error("Error setting clipboard content", error);
        }
    }

    setContentBinary(data: Uint8Array, mimeType: string): void {
        if (this.clipboard) {
            try {
                logger.debug(
                    `Setting binary clipboard content: ${mimeType}, ${data.length} bytes`,
                );

                // Use St.Clipboard.set_content for arbitrary MIME types
                this.clipboard.set_content(
                    St.ClipboardType.CLIPBOARD,
                    mimeType,
                    data,
                );
                this.clipboard.set_content(
                    St.ClipboardType.PRIMARY,
                    mimeType,
                    data,
                );

                // For text content, also set PRIMARY for better compatibility
                if (mimeType.startsWith("text/")) {
                    const text = new TextDecoder().decode(data);
                    this.clipboard.set_content(
                        St.ClipboardType.PRIMARY,
                        "text/plain",
                        new TextEncoder().encode(text),
                    );
                }

                this.emitClipboardEvent(data, "user", mimeType);
                logger.debug(
                    `Binary clipboard content set successfully for ${mimeType}`,
                );
            } catch (error) {
                logger.error("Error setting binary clipboard content", error);
            }
        } else {
            logger.error("Clipboard not available for setContentBinary");
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

        if (this.pasteHackCallbackId) {
            GLib.source_remove(this.pasteHackCallbackId);
            this.pasteHackCallbackId = null;
        }

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
        // Remove any pending timeout
        if (this.pasteHackCallbackId) {
            GLib.source_remove(this.pasteHackCallbackId);
            this.pasteHackCallbackId = null;
        }

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
