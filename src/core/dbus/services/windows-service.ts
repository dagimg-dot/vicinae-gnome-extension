import type Gio from "gi://Gio";
import GLib from "gi://GLib";
import type Meta from "gi://Meta";
import { logger } from "../../../utils/logger.js";
import { getFocusedWindow } from "../../../utils/window-utils.js";
import type { VicinaeClipboardManager } from "../../clipboard/clipboard-manager.js";
import { VicinaeWindowManager } from "../../windows/window-manager.js";

export class WindowsService {
    private windowManager: VicinaeWindowManager;
    private dbusObject: Gio.DBusExportedObject | null = null;

    // Signal connection IDs for cleanup
    private windowOpenedSignalId: number = 0;
    private windowFocusSignalId: number = 0;
    private workspaceChangedSignalId: number = 0;

    // Track individual window signal IDs
    private windowDestroySignalIds: Map<number, number> = new Map();
    private windowSizeSignalIds: Map<number, number> = new Map();

    // Track previous focused window for paste-to-active-app functionality
    private previousFocusedWindow: { id: number; wmClass: string } | null =
        null;

    constructor(clipboardManager: VicinaeClipboardManager) {
        this.windowManager = new VicinaeWindowManager(clipboardManager);
    }

    // Method to set the D-Bus exported object (called by DBusManager)
    setDBusObject(dbusObject: Gio.DBusExportedObject): void {
        this.dbusObject = dbusObject;
        logger.debug("WindowsService: D-Bus object set for signal emission");

        // Set up GNOME window event listeners
        this.setupWindowEventListeners();
    }

    private setupWindowEventListeners(): void {
        logger.debug("WindowsService: Setting up GNOME window event listeners");

        // Connect to GNOME's global window events
        const _display = global.display;

        // Window opened event
        this.windowOpenedSignalId = global.display.connect(
            "window-created",
            (_display, window) => {
                try {
                    const windowInfo = this.getWindowInfo(window);
                    this.emitOpenWindow(
                        windowInfo.id.toString(),
                        windowInfo.workspace.toString(),
                        windowInfo.wm_class,
                        windowInfo.title,
                    );

                    // Connect to this window's signals
                    this.connectToWindowDestroy(window);
                    this.connectToWindowSizeChanges(window);
                } catch (error) {
                    logger.debug(
                        `Error handling window opened event: ${error}`,
                    );
                }
            },
        );

        // Connect to destroy signals for all existing windows
        this.connectToExistingWindows();

        // Window focus changed event
        this.windowFocusSignalId = global.display.connect(
            "notify::focus-window",
            () => {
                try {
                    // Add a small delay to ensure GNOME Shell has updated its internal state
                    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                        const focusWindow = global.display.focus_window;
                        if (focusWindow) {
                            // Track previous focused window
                            const currentWmClass =
                                focusWindow.get_wm_class() || "";
                            if (!this.isVicinaeWindow(currentWmClass)) {
                                // Only update previous window if current is not Vicinae
                                this.previousFocusedWindow = {
                                    id: focusWindow.get_id(),
                                    wmClass: currentWmClass,
                                };
                            }

                            this.emitFocusWindow(
                                focusWindow.get_id().toString(),
                            );
                        }
                        return GLib.SOURCE_REMOVE;
                    });
                } catch (error) {
                    logger.debug(`Error handling window focus event: ${error}`);
                }
            },
        );

        // Workspace changed event
        this.workspaceChangedSignalId = global.workspace_manager?.connect(
            "notify::active-workspace",
            () => {
                try {
                    const activeWorkspace =
                        global.workspace_manager?.get_active_workspace();
                    if (activeWorkspace) {
                        this.emitWorkspaceChanged(
                            activeWorkspace.index().toString(),
                        );
                    }
                } catch (error) {
                    logger.debug(
                        `Error handling workspace changed event: ${error}`,
                    );
                }
            },
        );

        logger.debug(
            "WindowsService: GNOME window event listeners set up successfully",
        );
    }

    private connectToWindowDestroy(window: Meta.Window): void {
        const windowId = window.get_id();

        try {
            let signalId: number | undefined;

            let connectedSignal = "";

            // Try to connect to destroy signal first
            try {
                logger.debug(
                    `Attempting to connect 'destroy' signal for window ${windowId}`,
                );
                signalId = window.connect("destroy", () => {
                    try {
                        logger.debug(
                            `Window ${windowId} destroy signal triggered - emitting closewindow`,
                        );
                        this.emitCloseWindow(windowId.toString());
                        // Clean up the signal ID
                        this.windowDestroySignalIds.delete(windowId);
                    } catch (error) {
                        logger.debug(
                            `Error emitting closewindow for ${windowId}: ${error}`,
                        );
                    }
                });
                connectedSignal = "destroy";
                logger.debug(
                    `Successfully connected to 'destroy' signal for window ${windowId}`,
                );
            } catch (_destroyError) {
                logger.debug(
                    `'destroy' signal not available for window ${windowId}, trying 'unmanaged'`,
                );
                // If destroy signal doesn't exist, try unmanaged signal
                try {
                    signalId = window.connect("unmanaged", () => {
                        try {
                            logger.debug(
                                `Window ${windowId} unmanaged signal triggered - emitting closewindow`,
                            );
                            this.emitCloseWindow(windowId.toString());
                            // Clean up the signal ID
                            this.windowDestroySignalIds.delete(windowId);
                        } catch (error) {
                            logger.debug(
                                `Error emitting closewindow for ${windowId}: ${error}`,
                            );
                        }
                    });
                    connectedSignal = "unmanaged";
                    logger.debug(
                        `Successfully connected to 'unmanaged' signal for window ${windowId}`,
                    );
                } catch (_unmanagedError) {
                    logger.debug(
                        `No suitable destroy signal for window ${windowId}, skipping signal connection`,
                    );
                    return;
                }
            }

            // Store the signal ID for cleanup
            if (signalId !== undefined) {
                this.windowDestroySignalIds.set(windowId, signalId);
                logger.debug(
                    `Successfully connected ${connectedSignal} signal for window ${windowId} (signal ID: ${signalId})`,
                );
            }
        } catch (error) {
            logger.debug(
                `Failed to connect any destroy signal for window ${windowId}: ${error}`,
            );
        }
    }

    private connectToWindowSizeChanges(window: Meta.Window): void {
        const windowId = window.get_id();

        try {
            const signalId = window.connect("size-changed", () => {
                try {
                    const windowInfo = this.getWindowInfo(window);
                    logger.debug(
                        `Window ${windowId} size changed - emitting movewindow`,
                    );
                    this.emitMoveWindow(
                        windowInfo.id.toString(),
                        windowInfo.x,
                        windowInfo.y,
                        windowInfo.width,
                        windowInfo.height,
                    );
                } catch (error) {
                    logger.debug(
                        `Error handling size change for window ${windowId}: ${error}`,
                    );
                }
            });

            this.windowSizeSignalIds.set(windowId, signalId);
            logger.debug(
                `Connected size-changed signal for window ${windowId}`,
            );
        } catch (error) {
            logger.debug(
                `Failed to connect size-changed signal for window ${windowId}: ${error}`,
            );
        }
    }

    private connectToExistingWindows(): void {
        try {
            const windowActors = global.get_window_actors();
            logger.debug(
                `WindowsService: Connecting to ${windowActors.length} existing windows`,
            );

            for (const actor of windowActors) {
                if (actor.meta_window) {
                    this.connectToWindowDestroy(actor.meta_window);
                    this.connectToWindowSizeChanges(actor.meta_window);
                }
            }
        } catch (error) {
            logger.debug(`Error connecting to existing windows: ${error}`);
        }
    }

    private getWindowInfo(window: Meta.Window): {
        id: number;
        title: string;
        wm_class: string;
        workspace: number;
        x: number;
        y: number;
        width: number;
        height: number;
    } {
        let x = 0,
            y = 0,
            width = 0,
            height = 0;

        try {
            // Safely get frame rect - may not be available on all window types
            if (typeof window.get_frame_rect === "function") {
                const frame = window.get_frame_rect();
                x = frame.x;
                y = frame.y;
                width = frame.width;
                height = frame.height;
            } else {
                logger.debug(
                    `Window ${window.get_id()} does not have get_frame_rect method`,
                );
            }
        } catch (error) {
            logger.debug(
                `Error getting frame rect for window ${window.get_id()}: ${error}`,
            );
        }

        const workspace = window.get_workspace();
        return {
            id: window.get_id(),
            title: window.get_title(),
            wm_class: window.get_wm_class() || "",
            workspace: workspace ? workspace.index() : -1,
            x,
            y,
            width,
            height,
        };
    }

    // Cleanup method to disconnect signals
    destroy(): void {
        logger.debug("WindowsService: Cleaning up window event listeners");

        // Disconnect display-level signal handlers
        if (this.windowOpenedSignalId) {
            global.display.disconnect(this.windowOpenedSignalId);
        }
        if (this.windowFocusSignalId) {
            global.display.disconnect(this.windowFocusSignalId);
        }
        if (this.workspaceChangedSignalId && global.workspace_manager) {
            global.workspace_manager.disconnect(this.workspaceChangedSignalId);
        }

        // Disconnect all individual window signals
        const allWindowIds = new Set([
            ...this.windowDestroySignalIds.keys(),
            ...this.windowSizeSignalIds.keys(),
        ]);

        for (const windowId of allWindowIds) {
            try {
                // Find the window and disconnect all its signals
                const windowActors = global.get_window_actors();
                const windowActor = windowActors.find(
                    (actor) => actor.meta_window?.get_id() === windowId,
                );

                if (windowActor?.meta_window) {
                    // Disconnect destroy signal
                    const destroySignalId =
                        this.windowDestroySignalIds.get(windowId);
                    if (destroySignalId) {
                        windowActor.meta_window.disconnect(destroySignalId);
                    }

                    // Disconnect size signal
                    const sizeSignalId = this.windowSizeSignalIds.get(windowId);
                    if (sizeSignalId) {
                        windowActor.meta_window.disconnect(sizeSignalId);
                    }
                }
            } catch (error) {
                logger.debug(
                    `Error disconnecting signals for window ${windowId}: ${error}`,
                );
            }
        }

        // Clear the maps
        this.windowDestroySignalIds.clear();
        this.windowSizeSignalIds.clear();

        logger.debug("WindowsService: Window event listeners cleaned up");
    }

    List(): string {
        try {
            // Force a brief delay to ensure focus state is consistent
            // This helps prevent race conditions between focus changes and list requests
            GLib.usleep(1000); // 1ms delay

            const windows = this.windowManager.list();
            return JSON.stringify(windows);
        } catch (error) {
            logger.error("D-Bus: Error listing windows", error);
            throw error;
        }
    }

    Details(winid: number): string {
        try {
            const details = this.windowManager.details(winid);
            return JSON.stringify(details);
        } catch (error) {
            logger.error("D-Bus: Error getting window details", error);
            throw error;
        }
    }

    GetTitle(winid: number): string {
        try {
            return this.windowManager.getTitle(winid);
        } catch (error) {
            logger.error("D-Bus: Error getting window title", error);
            throw error;
        }
    }

    GetFrameRect(winid: number): string {
        try {
            const frameRect = this.windowManager.getFrameRect(winid);
            return JSON.stringify(frameRect);
        } catch (error) {
            logger.error("D-Bus: Error getting window frame rect", error);
            throw error;
        }
    }

    GetFrameBounds(winid: number): string {
        try {
            const frameBounds = this.windowManager.getFrameBounds(winid);
            return JSON.stringify(frameBounds);
        } catch (error) {
            logger.error("D-Bus: Error getting window frame bounds", error);
            throw error;
        }
    }

    MoveToWorkspace(winid: number, workspaceNum: number): void {
        try {
            this.windowManager.moveToWorkspace(winid, workspaceNum);
        } catch (error) {
            logger.error("D-Bus: Error moving window to workspace", error);
            throw error;
        }
    }

    MoveResize(
        winid: number,
        x: number,
        y: number,
        width: number,
        height: number,
    ): void {
        try {
            this.windowManager.moveResize(winid, x, y, width, height);
        } catch (error) {
            logger.error("D-Bus: Error move resizing window", error);
            throw error;
        }
    }

    Resize(winid: number, width: number, height: number): void {
        try {
            this.windowManager.resize(winid, width, height);
        } catch (error) {
            logger.error("D-Bus: Error resizing window", error);
            throw error;
        }
    }

    Move(winid: number, x: number, y: number): void {
        try {
            this.windowManager.move(winid, x, y);
        } catch (error) {
            logger.error("D-Bus: Error moving window", error);
            throw error;
        }
    }

    Maximize(winid: number): void {
        try {
            this.windowManager.maximize(winid);
        } catch (error) {
            logger.error("D-Bus: Error maximizing window", error);
            throw error;
        }
    }

    Minimize(winid: number): void {
        try {
            this.windowManager.minimize(winid);
        } catch (error) {
            logger.error("D-Bus: Error minimizing window", error);
            throw error;
        }
    }

    Unmaximize(winid: number): void {
        try {
            this.windowManager.unmaximize(winid);
        } catch (error) {
            logger.error("D-Bus: Error unmaximizing window", error);
            throw error;
        }
    }

    Unminimize(winid: number): void {
        try {
            this.windowManager.unminimize(winid);
        } catch (error) {
            logger.error("D-Bus: Error unminimizing window", error);
            throw error;
        }
    }

    Activate(winid: number): void {
        try {
            this.windowManager.activate(winid);
        } catch (error) {
            logger.error("D-Bus: Error activating window", error);
            throw error;
        }
    }

    Close(winid: number): void {
        try {
            this.windowManager.close(winid);
        } catch (error) {
            logger.error("D-Bus: Error closing window", error);
            throw error;
        }
    }

    ListWorkspaces(): string {
        try {
            const workspaces = this.windowManager.listWorkspaces();
            return JSON.stringify(workspaces);
        } catch (error) {
            logger.error("D-Bus: Error listing workspaces", error);
            throw error;
        }
    }

    GetActiveWorkspace(): string {
        try {
            const workspace = this.windowManager.getActiveWorkspace();
            return JSON.stringify(workspace);
        } catch (error) {
            logger.error("D-Bus: Error getting active workspace", error);
            throw error;
        }
    }

    GetWorkspaceWindows(workspaceIndex: number): string {
        try {
            const windows = this.windowManager.list();
            const workspaceWindows = windows.filter(
                (win) => win.workspace === workspaceIndex,
            );
            return JSON.stringify(workspaceWindows);
        } catch (error) {
            logger.error("D-Bus: Error getting workspace windows", error);
            throw error;
        }
    }

    SendShortcut(winid: number, key: string, modifiers: string): boolean {
        let success = false;

        try {
            success = this.windowManager.sendShortcut(winid, key, modifiers);
        } catch (error) {
            logger.error("D-Bus: Error sending shortcut", error);
            return false;
        }

        return success;
    }

    private isVicinaeWindow(wmClass: string): boolean {
        return (
            wmClass.toLowerCase().includes("vicinae") ||
            "vicinae".includes(wmClass.toLowerCase())
        );
    }

    GetFocusedWindowSync(): string {
        try {
            const focusedWindow = getFocusedWindow();
            if (!focusedWindow) {
                logger.debug("GetFocusedWindowSync: No focused window");
                return JSON.stringify(null);
            }

            const currentWmClass =
                focusedWindow.meta_window.get_wm_class() || "";

            // If current focused window is Vicinae, return previous window
            if (this.isVicinaeWindow(currentWmClass)) {
                if (this.previousFocusedWindow) {
                    logger.debug(
                        `GetFocusedWindowSync: Vicinae focused, returning previous window: ${this.previousFocusedWindow.wmClass}`,
                    );

                    // Get full window details for the previous window
                    const windowDetails = this.windowManager.details(
                        this.previousFocusedWindow.id,
                    );

                    return JSON.stringify(windowDetails);
                } else {
                    logger.debug(
                        "GetFocusedWindowSync: Vicinae focused but no previous window",
                    );

                    return JSON.stringify(null);
                }
            }

            logger.debug(
                `GetFocusedWindowSync: Returning current focused window: ${currentWmClass}`,
            );

            const windowDetails = this.windowManager.details(
                focusedWindow.meta_window.get_id(),
            );

            return JSON.stringify(windowDetails);
        } catch (error) {
            logger.error("D-Bus: Error in GetFocusedWindowSync", error);
            return JSON.stringify(null);
        }
    }

    // Signal emission methods - called by window manager when events occur
    emitOpenWindow(
        windowAddress: string,
        workspaceName: string,
        wmClass: string,
        title: string,
    ): void {
        try {
            logger.debug(
                `Emitting openwindow signal for ${title} (${wmClass})`,
            );
            this.dbusObject?.emit_signal(
                "openwindow",
                GLib.Variant.new("(ssss)", [
                    String(windowAddress),
                    String(workspaceName),
                    String(wmClass),
                    String(title),
                ]),
            );
        } catch (signalError) {
            logger.error("Error emitting openwindow signal", signalError);
        }
    }

    emitCloseWindow(windowAddress: string): void {
        try {
            logger.debug(`Emitting closewindow signal for ${windowAddress}`);
            this.dbusObject?.emit_signal(
                "closewindow",
                GLib.Variant.new("(s)", [String(windowAddress)]),
            );
        } catch (signalError) {
            logger.error("Error emitting closewindow signal", signalError);
        }
    }

    emitFocusWindow(windowAddress: string): void {
        try {
            logger.debug(`Emitting focuswindow signal for ${windowAddress}`);
            this.dbusObject?.emit_signal(
                "focuswindow",
                GLib.Variant.new("(s)", [String(windowAddress)]),
            );
        } catch (signalError) {
            logger.error("Error emitting focuswindow signal", signalError);
        }
    }

    emitMoveWindow(
        windowAddress: string,
        x: number,
        y: number,
        width: number,
        height: number,
    ): void {
        try {
            logger.debug(`Emitting movewindow signal for ${windowAddress}`);
            this.dbusObject?.emit_signal(
                "movewindow",
                GLib.Variant.new("(siiuu)", [
                    String(windowAddress),
                    x,
                    y,
                    width,
                    height,
                ]),
            );
        } catch (signalError) {
            logger.error("Error emitting movewindow signal", signalError);
        }
    }

    emitStateWindow(windowAddress: string, state: string): void {
        try {
            logger.debug(
                `Emitting statewindow signal for ${windowAddress}: ${state}`,
            );
            this.dbusObject?.emit_signal(
                "statewindow",
                GLib.Variant.new("(ss)", [
                    String(windowAddress),
                    String(state),
                ]),
            );
        } catch (signalError) {
            logger.error("Error emitting statewindow signal", signalError);
        }
    }

    emitWorkspaceChanged(workspaceId: string): void {
        try {
            logger.debug(`Emitting workspacechanged signal for ${workspaceId}`);
            this.dbusObject?.emit_signal(
                "workspacechanged",
                GLib.Variant.new("(s)", [String(workspaceId)]),
            );
        } catch (signalError) {
            logger.error("Error emitting workspacechanged signal", signalError);
        }
    }

    emitMonitorLayoutChanged(): void {
        try {
            logger.debug("Emitting monitorlayoutchanged signal");
            this.dbusObject?.emit_signal(
                "monitorlayoutchanged",
                GLib.Variant.new("()", []),
            );
        } catch (signalError) {
            logger.error(
                "Error emitting monitorlayoutchanged signal",
                signalError,
            );
        }
    }
}
