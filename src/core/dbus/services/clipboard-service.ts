import { VicinaeClipboardManager } from "../../../core/clipboard/clipboard-manager.js";
import { logger } from "../../../utils/logger.js";

export class ClipboardService {
    private clipboardManager: VicinaeClipboardManager;

    constructor() {
        this.clipboardManager = new VicinaeClipboardManager();
    }

    // Method to listen to clipboard changes
    ListenToClipboardChanges(): void {
        try {
            logger("D-Bus: Listen to clipboard changes requested");
            // This would set up a listener that could forward events to the Vicinae launcher
            // For now, we'll just log that the request was made
        } catch (error) {
            logger("D-Bus: Error setting up clipboard change listener", error);
            throw error;
        }
    }

    // Method to manually trigger a clipboard change (for testing)
    TriggerClipboardChange(content: string, source: string = "user"): void {
        try {
            logger("D-Bus: Trigger clipboard change requested", {
                content,
                source,
            });
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
            logger("D-Bus: Get current clipboard content requested");
            const content = this.clipboardManager.getCurrentContent();
            logger("D-Bus: Returning current clipboard content", { content });
            return content;
        } catch (error) {
            logger("D-Bus: Error getting current clipboard content", error);
            throw error;
        }
    }

    // Method to set clipboard content
    SetContent(content: string): void {
        try {
            logger("D-Bus: Set clipboard content requested", { content });
            // This actually sets the system clipboard content
            this.clipboardManager.setContent(content);
        } catch (error) {
            logger("D-Bus: Error setting clipboard content", error);
            throw error;
        }
    }
}
