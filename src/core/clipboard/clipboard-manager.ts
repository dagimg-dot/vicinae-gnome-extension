import Meta from "gi://Meta";
import Shell from "gi://Shell";
import St from "gi://St";
import { logger } from "../../utils/logger.js";

export interface ClipboardEvent {
    type: "clipboard-changed";
    content: string;
    timestamp: number;
    source: "user" | "system";
}

export class VicinaeClipboardManager {
    private eventListeners: ((event: ClipboardEvent) => void)[] = [];
    private currentContent: string = "";
    private clipboard: St.Clipboard | null = null;
    private selection: Meta.Selection | null = null;
    private _selectionOwnerChangedId: number | null = null;
    private _debouncing: number = 0;

    constructor() {
        this.setupClipboardMonitoring();
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

                logger(
                    "Clipboard monitoring set up successfully using selection listener",
                );
            } else {
                logger("Failed to get selection instance");
            }
        } catch (error) {
            logger("Error setting up clipboard monitoring", error);
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
            // Use the proper method to get clipboard text
            this.clipboard.get_text(St.ClipboardType.CLIPBOARD, (_, text) => {
                this.processClipboardContent(text, "system");
            });
        } catch (error) {
            logger("Error querying clipboard", error);
        }
    }

    private processClipboardContent(text: string, source: "user" | "system") {
        if (this._debouncing > 0) {
            this._debouncing--;
            return;
        }

        if (!text || text === this.currentContent) {
            return;
        }

        this.currentContent = text;
        logger("Processing new clipboard content", {
            content: text,
            source,
            length: text.length,
            preview: text.length > 50 ? `${text.substring(0, 50)}...` : text,
        });
        this.emitClipboardEvent(text, source);
    }

    // Method to emit clipboard change events
    private emitClipboardEvent(
        content: string,
        source: "user" | "system" = "user",
    ) {
        const event: ClipboardEvent = {
            type: "clipboard-changed",
            content,
            timestamp: Date.now(),
            source,
        };

        logger("🎯 CLIPBOARD EVENT EMITTED", {
            type: event.type,
            content:
                content.length > 100
                    ? `${content.substring(0, 100)}...`
                    : content,
            contentLength: content.length,
            timestamp: new Date(event.timestamp).toISOString(),
            source: event.source,
            listeners: this.eventListeners.length,
        });

        this.eventListeners.forEach((listener, index) => {
            try {
                logger(
                    `📡 Sending event to listener ${index + 1}/${this.eventListeners.length}`,
                );
                listener(event);
            } catch (error) {
                logger("❌ Error in clipboard event listener", error);
            }
        });
    }

    // Method for external components to listen to clipboard events
    onClipboardChange(listener: (event: ClipboardEvent) => void): void {
        this.eventListeners.push(listener);
        logger("👂 Clipboard change listener added", {
            totalListeners: this.eventListeners.length,
            listenerId: this.eventListeners.length,
        });
    }

    // Method to remove a listener
    removeClipboardListener(listener: (event: ClipboardEvent) => void): void {
        const index = this.eventListeners.indexOf(listener);
        if (index > -1) {
            this.eventListeners.splice(index, 1);
            logger("Clipboard change listener removed");
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
                logger("Clipboard content set successfully", { content });
            } catch (error) {
                logger("Error setting clipboard content", error);
            }
        }
    }

    // Method to manually trigger clipboard change (for testing or external triggers)
    triggerClipboardChange(
        content: string,
        source: "user" | "system" = "user",
    ): void {
        this.emitClipboardEvent(content, source);
    }

    // Cleanup method
    destroy(): void {
        if (this.selection && this._selectionOwnerChangedId) {
            try {
                this.selection.disconnect(this._selectionOwnerChangedId);
                this._selectionOwnerChangedId = null;
            } catch (error) {
                logger("Error disconnecting selection listener", error);
            }
        }

        this.eventListeners = [];
        this.currentContent = "";
        this.clipboard = null;
        this.selection = null;
        logger("Clipboard manager destroyed");
    }
}
