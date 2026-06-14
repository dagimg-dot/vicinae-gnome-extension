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
    private windowSizeSignalIds = new Map<number, number>();

    constructor(private onSizeChanged: (windowId: number) => void) {}

    connectToWindow(window: Meta.Window): void {
        const windowId = window.get_id();

        try {
            const signalId = window.connect("size-changed", () => {
                this.onSizeChanged(windowId);
            });

            this.windowSizeSignalIds.set(windowId, signalId);
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
        this.windowSizeSignalIds.delete(windowId);
    }

    disconnectAll(): void {
        for (const [windowId, sizeSignalId] of this.windowSizeSignalIds) {
            try {
                const windowActors = global.get_window_actors();

                const windowActor = windowActors.find(
                    (actor) => actor.meta_window?.get_id() === windowId,
                );

                if (windowActor?.meta_window && sizeSignalId) {
                    windowActor.meta_window.disconnect(sizeSignalId);
                }
            } catch (error) {
                logger.debug(
                    `Error disconnecting size signal for window ${windowId}: ${error}`,
                );
            }
        }

        this.windowSizeSignalIds.clear();
    }
}
