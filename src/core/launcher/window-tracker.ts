import type Meta from "gi://Meta";
import { logger } from "../../utils/logger.js";

declare const global: {
    display: Meta.Display;
    get_window_actors: () => Meta.WindowActor[];
    get_current_time: () => number;
};

export class WindowTracker {
    private trackedWindows = new Set<number>();
    private windowCreatedHandler?: number;
    private windowDestroySignalIds = new Map<number, number>();

    constructor(
        private appClass: string,
        private onWindowTracked: (windowId: number) => void,
        private onWindowUntracked: (windowId: number) => void,
    ) {}

    enable() {
        try {
            this.windowCreatedHandler = global.display.connect(
                "window-created",
                (_display: Meta.Display, window: Meta.Window) => {
                    // Add delay to ensure window is fully initialized
                    setTimeout(() => {
                        this.handleNewWindow(window);
                    }, 100);
                },
            );

            // Handle existing windows
            this.scanExistingWindows();
            logger("WindowTracker: Window tracking enabled");
        } catch (error) {
            logger("WindowTracker: Error enabling window tracking", error);
            throw error;
        }
    }

    disable() {
        if (this.windowCreatedHandler) {
            global.display.disconnect(this.windowCreatedHandler);
            this.windowCreatedHandler = undefined;
        }

        // Disconnect all window destroy handlers
        for (const [windowId, signalId] of this.windowDestroySignalIds) {
            const window = this.getWindowById(windowId);
            if (window) {
                try {
                    window.disconnect(signalId);
                } catch (error) {
                    logger(
                        `WindowTracker: Error disconnecting signal for window ${windowId}`,
                        error,
                    );
                }
            }
        }
        this.windowDestroySignalIds.clear();
        this.trackedWindows.clear();
        logger("WindowTracker: Window tracking disabled");
    }

    private scanExistingWindows() {
        try {
            const windowActors = global.get_window_actors();
            logger(
                `WindowTracker: Scanning ${windowActors.length} existing windows`,
            );

            windowActors.forEach((actor: Meta.WindowActor) => {
                if (actor?.meta_window) {
                    this.handleNewWindow(actor.meta_window);
                } else {
                    logger("WindowTracker: Skipping invalid window actor");
                }
            });
        } catch (error) {
            logger("WindowTracker: Error scanning existing windows", error);
        }
    }

    private handleNewWindow(window: Meta.Window) {
        if (!this.isValidWindow(window)) {
            logger("WindowTracker: Invalid window object received, skipping");
            return;
        }

        try {
            const wmClass = window.get_wm_class();
            const title = window.get_title();
            const windowId = window.get_id();

            if (!wmClass || !title || windowId <= 0) {
                logger("WindowTracker: Invalid window properties", {
                    wmClass,
                    title,
                    windowId,
                });
                return;
            }

            if (wmClass.toLowerCase().includes(this.appClass.toLowerCase())) {
                if (!this.trackedWindows.has(windowId)) {
                    this.trackedWindows.add(windowId);
                    this.onWindowTracked(windowId);

                    // Center the window after tracking
                    this.centerWindow(window);

                    // Set up window destroy handler
                    const signalId = window.connect("destroy", () => {
                        this.handleWindowDestroyed(window);
                    });

                    this.windowDestroySignalIds.set(windowId, signalId);

                    logger(
                        `WindowTracker: Tracking new window ${windowId} (${wmClass})`,
                    );
                }
            }
        } catch (error) {
            logger("WindowTracker: Error handling new window", error);
        }
    }

    private isValidWindow(window: Meta.Window): boolean {
        if (!window) return false;

        // Check if required methods exist
        if (typeof window.get_wm_class !== "function") return false;
        if (typeof window.get_id !== "function") return false;

        // Check if window is in a valid state
        try {
            const windowId = window.get_id();
            return windowId > 0 && windowId !== undefined;
        } catch {
            return false;
        }
    }

    private handleWindowDestroyed(window: Meta.Window) {
        if (!this.isValidWindow(window)) return;

        const windowId = window.get_id();
        if (this.trackedWindows.has(windowId)) {
            this.trackedWindows.delete(windowId);
            this.onWindowUntracked(windowId);

            // Clean up the destroy signal handler
            const signalId = this.windowDestroySignalIds.get(windowId);
            if (signalId) {
                try {
                    window.disconnect(signalId);
                } catch (_error) {
                    // Window might be already gone, so this can fail
                }
                this.windowDestroySignalIds.delete(windowId);
            }

            logger(`WindowTracker: Untracking destroyed window ${windowId}`);
        }
    }

    private getWindowById(windowId: number): Meta.Window | null {
        try {
            const actors = global.get_window_actors();
            for (const actor of actors) {
                const window = actor.meta_window;
                if (window && window.get_id() === windowId) {
                    return window;
                }
            }
        } catch (error) {
            logger(`WindowTracker: Error finding window ${windowId}`, error);
        }
        return null;
    }

    // Public methods for external access
    getTrackedWindows(): number[] {
        return Array.from(this.trackedWindows);
    }

    getTrackedWindowsCount(): number {
        return this.trackedWindows.size;
    }

    /**
     * Centers a window on the current monitor
     */
    private centerWindow(window: Meta.Window): void {
        try {
            const { x, y } = this.getCenterPosition(window);

            // Move the window to center position
            window.move_frame(true, x, y);

            logger(
                `WindowTracker: Centered window ${window.get_id()} at (${Math.round(
                    x,
                )}, ${Math.round(y)})`,
            );
        } catch (error) {
            logger("WindowTracker: Error centering window", error);
        }
    }

    /**
     * Gets the center position of a window
     */
    private getCenterPosition(window: Meta.Window): { x: number; y: number } {
        const monitor = window.get_monitor();
        const display = global.display;
        const monitorGeometry = display.get_monitor_geometry(monitor);

        const frame = window.get_frame_rect();

        const centerX =
            monitorGeometry.x + (monitorGeometry.width - frame.width) / 2;
        const centerY =
            monitorGeometry.y + (monitorGeometry.height - frame.height) / 2;

        return { x: centerX, y: centerY };
    }
}
