import type Gio from "gi://Gio";
import GLib from "gi://GLib";
import type Meta from "gi://Meta";
import { logger } from "../../../utils/logger.js";
import { getFocusedWindow } from "../../../utils/window-utils.js";
import type { VicinaeClipboardManager } from "../../clipboard/clipboard-manager.js";
import { VicinaeWindowManager } from "../../windows/window-manager.js";

/** Stores disconnect thunks and runs them all in disconnectAll(). */
class SignalRegistry {
    private disconnectFns: Array<() => void> = [];

    add(fn: () => void): void {
        this.disconnectFns.push(fn);
    }

    disconnectAll(): void {
        for (const fn of this.disconnectFns) {
            try {
                fn();
            } catch (error) {
                logger.debug(`Error during signal cleanup: ${error}`);
            }
        }
        this.disconnectFns = [];
    }
}

export class WindowsService {
    private windowManager: VicinaeWindowManager;
    private dbusObject: Gio.DBusExportedObject | null = null;

    // Signal connection IDs for cleanup
    private windowOpenedSignalId: number = 0;
    private windowFocusSignalId: number = 0;
    private workspaceChangedSignalId: number = 0;
    private windowDestroyHandlerId: number = 0;
    private focusIdleSourceId: number = 0;

    private windowSizeSignalIds: Map<number, number> = new Map();
    private signalRegistry: SignalRegistry = new SignalRegistry();

    // Track previous focused window for paste-to-active-app functionality
    private previousFocusedWindow: { id: number; wmClass: string } | null =
        null;

    constructor(clipboardManager: VicinaeClipboardManager, appClass: string) {
        this.windowManager = new VicinaeWindowManager(
            clipboardManager,
            appClass,
        );
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

        this.windowDestroyHandlerId = global.window_manager.connect(
            "destroy",
            (_wm: unknown, actor: Meta.WindowActor) => {
                try {
                    const metaWindow = actor.meta_window;
                    if (!metaWindow) return;

                    const windowId = metaWindow.get_id();

                    logger.debug(
                        `Window ${windowId} destroy signal triggered - emitting closewindow`,
                    );

                    this.emitCloseWindow(windowId.toString());
                    this.windowSizeSignalIds.delete(windowId);
                } catch (error) {
                    logger.debug(`Error handling window destroy: ${error}`);
                }
            },
        );
        this.signalRegistry.add(() => {
            if (this.windowDestroyHandlerId) {
                global.window_manager.disconnect(this.windowDestroyHandlerId);
            }
        });

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

                    this.connectToWindowSizeChanges(window);
                } catch (error) {
                    logger.debug(
                        `Error handling window opened event: ${error}`,
                    );
                }
            },
        );
        this.signalRegistry.add(() => {
            if (this.windowOpenedSignalId) {
                global.display.disconnect(this.windowOpenedSignalId);
            }
        });

        this.connectSizeSignalsToExistingWindows();

        this.signalRegistry.add(() => {
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
        });

        this.windowFocusSignalId = global.display.connect(
            "notify::focus-window",
            () => {
                try {
                    if (this.focusIdleSourceId) {
                        GLib.source_remove(this.focusIdleSourceId);
                        this.focusIdleSourceId = 0;
                    }

                    this.focusIdleSourceId = GLib.idle_add(
                        GLib.PRIORITY_DEFAULT_IDLE,
                        () => {
                            this.focusIdleSourceId = 0;
                            const focusWindow = global.display.focus_window;
                            if (focusWindow) {
                                const currentWmClass =
                                    focusWindow.get_wm_class() || "";
                                if (
                                    !this.windowManager.isTargetWindow(
                                        currentWmClass,
                                    )
                                ) {
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
                        },
                    );
                } catch (error) {
                    logger.debug(`Error handling window focus event: ${error}`);
                }
            },
        );

        this.signalRegistry.add(() => {
            if (this.windowFocusSignalId) {
                global.display.disconnect(this.windowFocusSignalId);
            }
        });

        this.signalRegistry.add(() => {
            if (this.focusIdleSourceId) {
                GLib.source_remove(this.focusIdleSourceId);
                this.focusIdleSourceId = 0;
            }
        });

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

        this.signalRegistry.add(() => {
            if (this.workspaceChangedSignalId && global.workspace_manager) {
                global.workspace_manager.disconnect(
                    this.workspaceChangedSignalId,
                );
            }
        });

        logger.debug(
            "WindowsService: GNOME window event listeners set up successfully",
        );
    }

    private connectToWindowSizeChanges(window: Meta.Window): void {
        const windowId = window.get_id();

        try {
            const signalId = window.connect("size-changed", () => {
                try {
                    const currentWindow = this.findWindowById(windowId);
                    if (!currentWindow) return;
                    const windowInfo = this.getWindowInfo(currentWindow);
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
        } catch (error) {
            logger.debug(
                `Failed to connect size-changed signal for window ${windowId}: ${error}`,
            );
        }
    }

    private findWindowById(windowId: number): Meta.Window | null {
        try {
            const actors = global.get_window_actors();

            for (const actor of actors) {
                if (actor.meta_window?.get_id() === windowId) {
                    return actor.meta_window;
                }
            }
        } catch {
            // ignore
        }
        return null;
    }

    private connectSizeSignalsToExistingWindows(): void {
        try {
            const windowActors = global.get_window_actors();

            for (const actor of windowActors) {
                if (actor.meta_window) {
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

    destroy(): void {
        logger.debug("WindowsService: Cleaning up window event listeners");
        this.signalRegistry.disconnectAll();
        logger.debug("WindowsService: Window event listeners cleaned up");
    }

    private wrapDBusMethod<T>(
        operation: string,
        fn: () => T,
        serialize: (r: T) => string,
    ): string;

    private wrapDBusMethod<T>(operation: string, fn: () => T): T;

    private wrapDBusMethod<T>(
        operation: string,
        fn: () => T,
        serialize?: (r: T) => string,
    ): string | T {
        try {
            const result = fn();
            return serialize ? serialize(result) : result;
        } catch (error) {
            logger.error(`D-Bus: Error ${operation}`, error);
            throw error;
        }
    }

    List(): string {
        return this.wrapDBusMethod(
            "listing windows",
            () => {
                GLib.usleep(1000);
                const windows = this.windowManager.list();
                return windows.filter(
                    (window) =>
                        !this.windowManager.isTargetWindow(window.wm_class),
                );
            },
            JSON.stringify,
        );
    }

    Details(winid: number): string {
        return this.wrapDBusMethod(
            "getting window details",
            () => this.windowManager.details(winid),
            JSON.stringify,
        );
    }

    GetTitle(winid: number): string {
        return this.wrapDBusMethod("getting window title", () =>
            this.windowManager.getTitle(winid),
        );
    }

    GetFrameRect(winid: number): string {
        return this.wrapDBusMethod(
            "getting window frame rect",
            () => this.windowManager.getFrameRect(winid),
            JSON.stringify,
        );
    }

    GetFrameBounds(winid: number): string {
        return this.wrapDBusMethod(
            "getting window frame bounds",
            () => this.windowManager.getFrameBounds(winid),
            JSON.stringify,
        );
    }

    MoveToWorkspace(winid: number, workspaceNum: number): void {
        this.wrapDBusMethod("moving window to workspace", () =>
            this.windowManager.moveToWorkspace(winid, workspaceNum),
        );
    }

    MoveResize(
        winid: number,
        x: number,
        y: number,
        width: number,
        height: number,
    ): void {
        this.wrapDBusMethod("move resizing window", () =>
            this.windowManager.moveResize(winid, x, y, width, height),
        );
    }

    Resize(winid: number, width: number, height: number): void {
        this.wrapDBusMethod("resizing window", () =>
            this.windowManager.resize(winid, width, height),
        );
    }

    Move(winid: number, x: number, y: number): void {
        this.wrapDBusMethod("moving window", () =>
            this.windowManager.move(winid, x, y),
        );
    }

    Maximize(winid: number): void {
        this.wrapDBusMethod("maximizing window", () =>
            this.windowManager.maximize(winid),
        );
    }

    Minimize(winid: number): void {
        this.wrapDBusMethod("minimizing window", () =>
            this.windowManager.minimize(winid),
        );
    }

    Unmaximize(winid: number): void {
        this.wrapDBusMethod("unmaximizing window", () =>
            this.windowManager.unmaximize(winid),
        );
    }

    Unminimize(winid: number): void {
        this.wrapDBusMethod("unminimizing window", () =>
            this.windowManager.unminimize(winid),
        );
    }

    Activate(winid: number): void {
        this.wrapDBusMethod("activating window", () =>
            this.windowManager.activate(winid),
        );
    }

    Close(winid: number): void {
        this.wrapDBusMethod("closing window", () =>
            this.windowManager.close(winid),
        );
    }

    ListWorkspaces(): string {
        return this.wrapDBusMethod(
            "listing workspaces",
            () => this.windowManager.listWorkspaces(),
            JSON.stringify,
        );
    }

    GetActiveWorkspace(): string {
        return this.wrapDBusMethod(
            "getting active workspace",
            () => this.windowManager.getActiveWorkspace(),
            JSON.stringify,
        );
    }

    GetWorkspaceWindows(workspaceIndex: number): string {
        return this.wrapDBusMethod(
            "getting workspace windows",
            () => {
                const windows = this.windowManager.list();
                return windows.filter(
                    (win) => win.workspace === workspaceIndex,
                );
            },
            JSON.stringify,
        );
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
            if (this.windowManager.isTargetWindow(currentWmClass)) {
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

    private emitSignal(
        signalName: string,
        signature: string,
        args: unknown[],
    ): void {
        try {
            logger.debug(`Emitting ${signalName} signal...`);

            this.dbusObject?.emit_signal(
                signalName,
                GLib.Variant.new(signature, args),
            );
        } catch (signalError) {
            logger.error(`Error emitting ${signalName} signal`, signalError);
        }
    }

    emitOpenWindow(
        windowAddress: string,
        workspaceName: string,
        wmClass: string,
        title: string,
    ): void {
        this.emitSignal("openwindow", "(ssss)", [
            String(windowAddress),
            String(workspaceName),
            String(wmClass),
            String(title),
        ]);
    }

    emitCloseWindow(windowAddress: string): void {
        this.emitSignal("closewindow", "(s)", [String(windowAddress)]);
    }

    emitFocusWindow(windowAddress: string): void {
        this.emitSignal("focuswindow", "(s)", [String(windowAddress)]);
    }

    emitMoveWindow(
        windowAddress: string,
        x: number,
        y: number,
        width: number,
        height: number,
    ): void {
        this.emitSignal("movewindow", "(siiuu)", [
            String(windowAddress),
            x,
            y,
            width,
            height,
        ]);
    }

    emitStateWindow(windowAddress: string, state: string): void {
        this.emitSignal("statewindow", "(ss)", [
            String(windowAddress),
            String(state),
        ]);
    }

    emitWorkspaceChanged(workspaceId: string): void {
        this.emitSignal("workspacechanged", "(s)", [String(workspaceId)]);
    }

    emitMonitorLayoutChanged(): void {
        this.emitSignal("monitorlayoutchanged", "()", []);
    }
}
