import type Meta from "gi://Meta";
import { logger } from "../../utils/logger.js";

/**
 * Manages per-window "size-changed" signal connections.
 *
 * When a window's size changes, calls the onSizeChanged callback with the
 * window ID so the owner can query dimensions and emit D-Bus signals.
 *
 * Clean up with disconnectAll() — iterates the active window list to find
 * and disconnect each tracked window's signal.
 */
export class WindowSizeTracker {
    private trackedWindows = new Set<number>();

    constructor(private onSizeChanged: (windowId: number) => void) {}

    connectToWindow(window: Meta.Window): void {
        const windowId = window.get_id();

        if (this.trackedWindows.has(windowId)) {
            logger.debug(
                `Window ${windowId} already has a size-changed connection, skipping`,
            );
            return;
        }

        try {
            window.connectObject(
                "size-changed",
                () => {
                    try {
                        this.onSizeChanged(windowId);
                    } catch (error) {
                        logger.debug(
                            `Error in size-changed callback for window ${windowId}: ${error}`,
                        );
                    }
                },
                this,
            );

            this.trackedWindows.add(windowId);
        } catch (error) {
            logger.debug(
                `Failed to connect size-changed signal for window ${windowId}: ${error}`,
            );
        }
    }

    connectToExistingWindows(): void {
        try {
            const windowActors = global.get_window_actors();

            for (const actor of windowActors) {
                if (actor.meta_window) {
                    this.connectToWindow(actor.meta_window);
                }
            }
        } catch (error) {
            logger.debug(`Error connecting to existing windows: ${error}`);
        }
    }

    removeWindow(windowId: number): void {
        this.trackedWindows.delete(windowId);
    }

    disconnectAll(): void {
        for (const actor of global.get_window_actors()) {
            actor.meta_window?.disconnectObject(this);
        }

        this.trackedWindows.clear();
    }
}
