import type Clutter from "gi://Clutter";
import type Meta from "gi://Meta";
import { logger } from "../../utils/logger.js";
import { VicinaeWindowManager } from "../windows/window-manager.js";
import { ClickHandler } from "./click-handler.js";
import { FocusTracker } from "./focus-tracker.js";
import { WindowTracker } from "./window-tracker.js";

declare const global: {
    display: Meta.Display;
    get_pointer: () => [number, number];
    stage: Clutter.Stage;
    get_window_actors: () => Meta.WindowActor[];
};

export interface LauncherConfig {
    /** Application class name to monitor */
    appClass: string;
    /** Whether to auto-close on focus loss */
    autoCloseOnFocusLoss: boolean;
}

export class LauncherManager {
    private windowManager: VicinaeWindowManager;
    private windowTracker: WindowTracker;
    private focusTracker?: FocusTracker;
    private clickHandler?: ClickHandler;
    private config: LauncherConfig;
    private isEnabled = false;
    private trackedWindows = new Set<number>();

    constructor(config: LauncherConfig) {
        this.windowManager = new VicinaeWindowManager();
        this.config = config;
        this.windowTracker = new WindowTracker(
            config.appClass,
            this.handleWindowTracked.bind(this),
            this.handleWindowUntracked.bind(this),
        );
    }

    enable() {
        if (this.isEnabled) {
            logger("LauncherManager: Already enabled, skipping");
            return;
        }

        try {
            this.windowTracker.enable();

            if (this.config.autoCloseOnFocusLoss) {
                this.setupFocusTracking();
                this.setupClickHandling();
            }

            this.isEnabled = true;
            logger("LauncherManager: Successfully enabled");
        } catch (error) {
            logger("LauncherManager: Error during enable", error);
            this.cleanup();
            throw error;
        }
    }

    private handleWindowTracked(windowId: number) {
        this.trackedWindows.add(windowId);
    }

    private handleWindowUntracked(windowId: number) {
        this.trackedWindows.delete(windowId);
    }

    disable() {
        logger("LauncherManager: Disabling");
        this.isEnabled = false;
        this.cleanup();
    }

    private setupFocusTracking() {
        this.focusTracker = new FocusTracker(() => this.handleFocusChange());
        this.focusTracker.enable();
    }

    private setupClickHandling() {
        this.clickHandler = new ClickHandler(this.config.appClass, () =>
            this.closeTrackedWindows(),
        );
        this.clickHandler.enable();
    }

    private handleFocusChange() {
        if (!this.isEnabled) return;

        const focusedWindow = global.display.get_focus_window();
        if (!focusedWindow) {
            this.closeTrackedWindows();
            return;
        }

        const focusedWmClass =
            focusedWindow.get_wm_class()?.toLowerCase() || "";
        if (!focusedWmClass.includes(this.config.appClass.toLowerCase())) {
            this.closeTrackedWindows();
        }
    }

    private closeTrackedWindows() {
        if (this.trackedWindows.size === 0) return;

        logger(
            `LauncherManager: Closing ${this.trackedWindows.size} launcher windows due to focus loss`,
        );

        const windowsToClose = Array.from(this.trackedWindows);
        this.trackedWindows.clear(); // Clear first to avoid re-entry

        windowsToClose.forEach((windowId) => {
            try {
                if (this.isValidWindowId(windowId)) {
                    this.windowManager.close(windowId);
                    logger(
                        `LauncherManager: Successfully closed window ${windowId}`,
                    );
                } else {
                    logger(
                        `LauncherManager: Window ${windowId} no longer valid, skipping close`,
                    );
                }
            } catch (error) {
                logger(
                    `LauncherManager: Error closing window ${windowId}`,
                    error,
                );
            }
        });
    }

    private isValidWindowId(windowId: number): boolean {
        if (!windowId || windowId <= 0) return false;
        try {
            const details = this.windowManager.details(windowId);
            return details && details.id === windowId;
        } catch {
            return false;
        }
    }

    private cleanup() {
        try {
            this.windowTracker.disable();
            this.focusTracker?.disable();
            this.clickHandler?.disable();
        } catch (error) {
            logger("LauncherManager: Error during cleanup", error);
        }
    }
}
