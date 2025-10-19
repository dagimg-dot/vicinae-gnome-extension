import type Meta from "gi://Meta";
import { logger } from "../../utils/logger.js";
import type { VicinaeClipboardManager } from "../clipboard/clipboard-manager.js";
import { VicinaeWindowManager } from "../windows/window-manager.js";
import { ClickHandler } from "./click-handler.js";
import { FocusTracker } from "./focus-tracker.js";
import { WindowTracker } from "./window-tracker.js";

declare const global: {
    display: Meta.Display;
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

    constructor(
        config: LauncherConfig,
        clipboardManager: VicinaeClipboardManager,
    ) {
        this.windowManager = new VicinaeWindowManager(clipboardManager);
        this.config = config;
        this.windowTracker = new WindowTracker(
            config.appClass,
            this.handleWindowTracked.bind(this),
            this.handleWindowUntracked.bind(this),
        );
    }

    async enable() {
        if (this.isEnabled) {
            logger.debug("LauncherManager: Already enabled, skipping");
            return;
        }

        try {
            await this.windowTracker.enable();

            if (this.config.autoCloseOnFocusLoss) {
                this.setupFocusTracking();
                this.setupClickHandling();
            }

            this.isEnabled = true;
            logger.info("LauncherManager: Successfully enabled");
        } catch (error) {
            logger.error("LauncherManager: Error during enable", error);
            this.cleanup();
            throw error;
        }
    }

    private handleWindowTracked(windowId: number) {
        this.trackedWindows.add(windowId);
        logger.debug(`LauncherManager: Window ${windowId} is now tracked`);
    }

    private handleWindowUntracked(windowId: number) {
        this.trackedWindows.delete(windowId);
        logger.debug(
            `LauncherManager: Window ${windowId} is no longer tracked`,
        );
    }

    disable() {
        logger.info("LauncherManager: Disabling");
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

        logger.debug(
            `LauncherManager: Closing ${this.trackedWindows.size} launcher windows due to focus loss`,
        );

        const windowsToClose = Array.from(this.trackedWindows);
        this.trackedWindows.clear(); // Clear first to avoid re-entry

        windowsToClose.forEach((windowId) => {
            try {
                if (this.isValidWindowId(windowId)) {
                    this.windowManager.close(windowId);
                    logger.debug(
                        `LauncherManager: Successfully closed window ${windowId}`,
                    );
                } else {
                    logger.debug(
                        `LauncherManager: Window ${windowId} no longer valid, skipping close`,
                    );
                }
            } catch (error) {
                logger.error(
                    `LauncherManager: Error closing window ${windowId}`,
                    error,
                );
                // Don't re-throw to prevent cascading failures
            }
        });
    }

    private isValidWindowId(windowId: number): boolean {
        if (!windowId || windowId <= 0) return false;
        try {
            // First check if window exists in the global window list
            const windowActors = global.get_window_actors();
            const windowExists = windowActors.some((actor) => {
                try {
                    return (
                        actor.meta_window &&
                        actor.meta_window.get_id() === windowId
                    );
                } catch {
                    return false;
                }
            });

            if (!windowExists) return false;

            // Then try to get details to ensure it's accessible
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
            this.trackedWindows.clear();
        } catch (error) {
            logger.error("LauncherManager: Error during cleanup", error);
        }
    }

    // Recovery method for error situations
    recover() {
        logger.warn("LauncherManager: Attempting recovery from errors");

        try {
            this.cleanup();
            this.isEnabled = false;

            // Wait a bit before re-enabling
            setTimeout(() => {
                this.enable();
            }, 500);

            logger.info("LauncherManager: Recovery initiated");
        } catch (error) {
            logger.error("LauncherManager: Recovery failed", error);
        }
    }

    // Public methods for dynamic configuration
    updateConfig(newConfig: Partial<LauncherConfig>) {
        const oldConfig = { ...this.config };
        this.config = { ...this.config, ...newConfig };

        logger.debug("LauncherManager: Configuration updated", {
            old: oldConfig,
            new: this.config,
        });

        // Re-enable if currently enabled to apply new config
        if (this.isEnabled) {
            logger.info("LauncherManager: Re-enabling with new configuration");
            this.disable();
            setTimeout(() => this.enable(), 100);
        }
    }

    getTrackedWindows(): number[] {
        return Array.from(this.trackedWindows);
    }

    getStatus() {
        return {
            isEnabled: this.isEnabled,
            trackedWindowsCount: this.trackedWindows.size,
            config: this.config,
            hasFocusTracker: !!this.focusTracker,
            hasClickHandler: !!this.clickHandler,
            hasWindowTracker: !!this.windowTracker,
        };
    }

    // Force refresh of tracked windows
    refresh() {
        logger.debug("LauncherManager: Refreshing tracked windows");
        this.trackedWindows.clear();
        // The WindowTracker will automatically pick up existing windows
    }
}
