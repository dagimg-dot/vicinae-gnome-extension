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
                (_display, window) => this.handleNewWindow(window),
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

        for (const [windowId, signalId] of this.windowDestroySignalIds) {
            const window = this.getWindowById(windowId);
            if (window) {
                try {
                    window.disconnect(signalId);
                } catch (error) {
                    logger(
                        `Error disconnecting signal for window ${windowId}`,
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
            windowActors.forEach((actor: Meta.WindowActor) => {
                if (actor?.meta_window) {
                    this.handleNewWindow(actor.meta_window);
                }
            });
        } catch (error) {
            logger("WindowTracker: Error scanning existing windows", error);
        }
    }

    private handleNewWindow(window: Meta.Window) {
        if (!this.isValidWindow(window)) return;

        try {
            const wmClass = window.get_wm_class();
            const title = window.get_title();
            const windowId = window.get_id();

            if (!wmClass || !title || windowId <= 0) return;

            if (title.toLowerCase() === "vicinae") {
                logger(
                    `WindowTracker: Closing notification toast window ${windowId}`,
                );
                window.delete(global.get_current_time());
                return;
            }

            const isSettingsWindow = title
                .toLowerCase()
                .includes("vicinae settings");

            if (
                wmClass.toLowerCase().includes(this.appClass.toLowerCase()) &&
                !isSettingsWindow
            ) {
                if (!this.trackedWindows.has(windowId)) {
                    this.trackedWindows.add(windowId);
                    this.onWindowTracked(windowId);

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
        if (typeof window.get_wm_class !== "function") return false;
        if (typeof window.get_id !== "function") return false;

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

    closeTrackedWindows() {
        if (this.trackedWindows.size === 0) return;

        logger(
            `WindowTracker: Closing ${this.trackedWindows.size} tracked windows`,
        );

        // Get a copy of the window IDs before clearing
        const windowsToClose = Array.from(this.trackedWindows);
        this.trackedWindows.clear();

        // Close each window
        windowsToClose.forEach((windowId) => {
            try {
                const window = this.getWindowById(windowId);
                if (window) {
                    window.delete(global.get_current_time());
                    logger(
                        `WindowTracker: Successfully closed window ${windowId}`,
                    );
                } else {
                    logger(
                        `WindowTracker: Could not find window ${windowId} to close`,
                    );
                }
            } catch (error) {
                logger(
                    `WindowTracker: Error closing window ${windowId}`,
                    error,
                );
            }
        });
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
}
