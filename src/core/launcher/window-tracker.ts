import GLib from "gi://GLib";
import type Meta from "gi://Meta";
import { logger } from "../../utils/logger.js";

declare const global: {
    display: Meta.Display;
    window_manager: {
        connect: (
            signal: string,
            callback: (...args: unknown[]) => void,
        ) => number;
        disconnect: (id: number) => void;
    };
    get_window_actors: () => Meta.WindowActor[];
    get_current_time: () => number;
};

export class WindowTracker {
    private trackedWindows = new Set<number>();
    private windowCreatedHandler?: number;
    private windowDestroyHandler?: number;
    private isDestroying = false;

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
                    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                        this.handleNewWindow(window);
                        return GLib.SOURCE_REMOVE;
                    });
                },
            );

            this.windowDestroyHandler = global.window_manager.connect(
                "destroy",
                (_wm: unknown, actor: unknown) => {
                    if (this.isDestroying) return;
                    try {
                        const metaWindow = (actor as Meta.WindowActor)
                            ?.meta_window;
                        const windowId = metaWindow?.get_id();
                        if (windowId && this.trackedWindows.has(windowId)) {
                            this.trackedWindows.delete(windowId);
                            this.onWindowUntracked(windowId);
                            logger.debug(
                                `WindowTracker: Untracking destroyed window ${windowId}`,
                            );
                        }
                    } catch {
                        // Window already gone, safe to ignore
                    }
                },
            );

            this.scanExistingWindows();
            logger.info("WindowTracker: Window tracking enabled");
        } catch (error) {
            logger.error(
                "WindowTracker: Error enabling window tracking",
                error,
            );
            throw error;
        }
    }

    disable() {
        this.isDestroying = true;

        if (this.windowCreatedHandler) {
            global.display.disconnect(this.windowCreatedHandler);
            this.windowCreatedHandler = undefined;
        }

        if (this.windowDestroyHandler) {
            global.window_manager.disconnect(this.windowDestroyHandler);
            this.windowDestroyHandler = undefined;
        }

        this.trackedWindows.clear();
        this.isDestroying = false;
        logger.info("WindowTracker: Window tracking disabled");
    }

    private scanExistingWindows() {
        try {
            const windowActors = global.get_window_actors();
            logger.debug(
                `WindowTracker: Scanning ${windowActors.length} existing windows`,
            );

            windowActors.forEach((actor: Meta.WindowActor) => {
                if (actor?.meta_window) {
                    this.handleNewWindow(actor.meta_window);
                } else {
                    logger.debug(
                        "WindowTracker: Skipping invalid window actor",
                    );
                }
            });
        } catch (error) {
            logger.error(
                "WindowTracker: Error scanning existing windows",
                error,
            );
        }
    }

    private handleNewWindow(window: Meta.Window) {
        if (this.isDestroying) return;

        try {
            const wmClass = window.get_wm_class();
            const title = window.get_title();
            const windowId = window.get_id();

            if (!wmClass || !title || windowId <= 0) {
                return;
            }

            if (wmClass.toLowerCase().includes(this.appClass.toLowerCase())) {
                if (!this.trackedWindows.has(windowId)) {
                    this.trackedWindows.add(windowId);
                    this.onWindowTracked(windowId);
                    this.centerWindow(window);

                    logger.debug(
                        `WindowTracker: Tracking new window ${windowId} (${wmClass})`,
                    );
                }
            }
        } catch (error) {
            logger.error("WindowTracker: Error handling new window", {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
        }
    }

    getTrackedWindows(): number[] {
        return Array.from(this.trackedWindows);
    }

    getTrackedWindowsCount(): number {
        return this.trackedWindows.size;
    }

    private centerWindow(window: Meta.Window): void {
        if (this.isDestroying) return;

        try {
            const pos = this.getCenterPosition(window);
            if (!pos) return;

            const { x, y } = pos;
            window.move_frame(true, x, y);

            logger.debug(
                `WindowTracker: Centered window ${window.get_id()} at (${Math.round(
                    x,
                )}, ${Math.round(y)})`,
            );
        } catch (error) {
            logger.error("WindowTracker: Error centering window", error);
        }
    }

    private getCenterPosition(window: Meta.Window): { x: number; y: number } | null {
        const monitor = window.get_monitor();
        const display = global.display;
        const nMonitors = display.get_n_monitors();

        if (monitor < 0 || monitor >= nMonitors) {
            logger.debug(
                `WindowTracker: Invalid monitor index ${monitor} (n_monitors=${nMonitors}), skipping center`,
            );
            return null;
        }

        const monitorGeometry = display.get_monitor_geometry(monitor);

        const frame = window.get_frame_rect();

        const centerX =
            monitorGeometry.x + (monitorGeometry.width - frame.width) / 2;
        const centerY =
            monitorGeometry.y + (monitorGeometry.height - frame.height) / 2;

        return { x: centerX, y: centerY };
    }
}
