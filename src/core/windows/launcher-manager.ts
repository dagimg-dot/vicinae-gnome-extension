import type Meta from "gi://Meta";
import { logger } from "../../utils/logger.js";
import { VicinaeWindowManager } from "./window-manager.js";

export interface LauncherConfig {
    /** Application class name to monitor */
    appClass: string;
    /** Whether to auto-close on focus loss */
    autoCloseOnFocusLoss: boolean;
}

export class LauncherManager {
    private windowManager: VicinaeWindowManager;
    private config: LauncherConfig;
    private focusHandler?: number;
    private windowTracker?: number;
    private trackedWindows = new Set<number>();
    private isEnabled = false;

    constructor(config: LauncherConfig) {
        this.windowManager = new VicinaeWindowManager();
        this.config = config;
    }

    enable() {
        if (this.isEnabled) {
            logger("LauncherManager: Already enabled, skipping");
            return;
        }

        logger(
            `LauncherManager: Enabling auto-close for ${this.config.appClass}`,
        );

        try {
            this.setupWindowTracking();
            this.setupFocusTracking();
            this.isEnabled = true;
            logger("LauncherManager: Successfully enabled");
        } catch (error) {
            logger("LauncherManager: Error during enable", error);
            this.cleanup();
            throw error;
        }
    }

    disable() {
        logger("LauncherManager: Disabling auto-close");
        this.isEnabled = false;
        this.cleanup();
    }

    private setupWindowTracking() {
        try {
            // Monitor new windows being created
            this.windowTracker = global.display.connect(
                "window-created",
                (_display: Meta.Display, window: Meta.Window) => {
                    // Add delay to ensure window is fully initialized
                    setTimeout(() => {
                        this.handleNewWindow(window);
                    }, 100);
                },
            );

            // Handle existing windows with validation
            this.scanExistingWindows();

            logger("LauncherManager: Window tracking setup complete");
        } catch (error) {
            logger("LauncherManager: Error setting up window tracking", error);
            throw error;
        }
    }

    private setupFocusTracking() {
        if (!this.config.autoCloseOnFocusLoss) return;

        try {
            // Monitor focus changes globally
            this.focusHandler = global.display.connect(
                "notify::focus-window",
                () => {
                    this.handleFocusChange();
                },
            );

            logger("LauncherManager: Focus tracking setup complete");
        } catch (error) {
            logger("LauncherManager: Error setting up focus tracking", error);
            throw error;
        }
    }

    private scanExistingWindows() {
        try {
            const windowActors = global.get_window_actors();

            logger(
                `LauncherManager: Scanning ${windowActors.length} existing windows`,
            );

            windowActors.forEach((windowActor: Meta.WindowActor) => {
                if (windowActor?.meta_window) {
                    this.handleNewWindow(windowActor.meta_window);
                } else {
                    logger("LauncherManager: Skipping invalid window actor");
                }
            });
        } catch (error) {
            logger("LauncherManager: Error scanning existing windows", error);
        }
    }

    private handleNewWindow(window: Meta.Window) {
        // Validate window state before processing
        if (!this.isValidWindow(window)) {
            logger("LauncherManager: Invalid window object received, skipping");
            return;
        }

        try {
            const wmClass = window.get_wm_class();
            const windowId = window.get_id();

            // Additional validation
            if (!wmClass || windowId <= 0) {
                logger("LauncherManager: Invalid window properties", {
                    wmClass,
                    windowId,
                });
                return;
            }

            if (
                wmClass
                    .toLowerCase()
                    .includes(this.config.appClass.toLowerCase())
            ) {
                // Check if window is already being tracked
                if (this.trackedWindows.has(windowId)) {
                    logger(
                        `LauncherManager: Window ${windowId} already tracked, skipping`,
                    );
                    return;
                }

                this.trackedWindows.add(windowId);
                logger(
                    `LauncherManager: Tracking new launcher window ${windowId} (${wmClass})`,
                );
            }
        } catch (error) {
            logger("LauncherManager: Error handling new window", error);
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

    private handleFocusChange() {
        try {
            const focusedWindow = global.display.get_focus_window();

            if (!focusedWindow) {
                logger(
                    "LauncherManager: No focused window, skipping focus change",
                );
                return;
            }

            const focusedId = focusedWindow.get_id();
            const focusedWmClass = focusedWindow.get_wm_class() || "";

            logger(
                `LauncherManager: Focus changed to window ${focusedId} (${focusedWmClass})`,
            );

            // If focus moved away from our launcher, close all launcher windows
            if (
                !focusedWmClass
                    .toLowerCase()
                    .includes(this.config.appClass.toLowerCase())
            ) {
                this.closeTrackedWindows();
            }
        } catch (error) {
            logger("LauncherManager: Error handling focus change", error);
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
                // Validate window still exists before closing
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
            // Try to get window details to validate it still exists
            const details = this.windowManager.details(windowId);
            return details && details.id === windowId;
        } catch {
            return false;
        }
    }

    private cleanup() {
        try {
            if (this.focusHandler) {
                global.display.disconnect(this.focusHandler);
                this.focusHandler = undefined;
                logger("LauncherManager: Focus handler disconnected");
            }

            if (this.windowTracker) {
                global.display.disconnect(this.windowTracker);
                this.windowTracker = undefined;
                logger("LauncherManager: Window tracker disconnected");
            }

            this.trackedWindows.clear();
            logger("LauncherManager: Cleanup completed successfully");
        } catch (error) {
            logger("LauncherManager: Error during cleanup", error);
        }
    }

    // Recovery method for error situations
    recover() {
        logger("LauncherManager: Attempting recovery from errors");

        try {
            this.cleanup();
            this.isEnabled = false;

            // Wait a bit before re-enabling
            setTimeout(() => {
                this.enable();
            }, 500);

            logger("LauncherManager: Recovery initiated");
        } catch (error) {
            logger("LauncherManager: Recovery failed", error);
        }
    }

    // Public methods for dynamic configuration
    updateConfig(newConfig: Partial<LauncherConfig>) {
        const oldConfig = { ...this.config };
        this.config = { ...this.config, ...newConfig };

        logger("LauncherManager: Configuration updated", {
            old: oldConfig,
            new: this.config,
        });

        // Re-enable if currently enabled to apply new config
        if (this.isEnabled) {
            logger("LauncherManager: Re-enabling with new configuration");
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
            hasFocusHandler: !!this.focusHandler,
            hasWindowTracker: !!this.windowTracker,
        };
    }

    // Force refresh of tracked windows
    refresh() {
        logger("LauncherManager: Refreshing tracked windows");
        this.trackedWindows.clear();
        this.scanExistingWindows();
    }
}
