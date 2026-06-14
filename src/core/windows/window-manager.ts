import type Meta from "gi://Meta";
import { logger } from "../../utils/logger.js";
import {
    getCurrentTime,
    getWindowById,
    isMaximized,
} from "../../utils/window-utils.js";
import type {
    FrameBounds,
    FrameRect,
    Rectangle,
    WindowInfo,
    WindowManager,
    WorkspaceInfo,
} from "./types.js";
import { WorkspaceManager } from "./workspace-manager.js";

interface MetaWindowWithExtras extends Meta.Window {
    get_frame_bounds(): Rectangle;
}

export class VicinaeWindowManager implements WindowManager {
    private appClass: string;

    constructor(appClass: string) {
        this.appClass = appClass;
    }

    /**
     * Checks if the window is a target window.
     *
     * @param wmClass - The window manager class of the window.
     * @returns True if the window is a target window, false otherwise.
     */
    isTargetWindow(wmClass: string): boolean {
        if (!wmClass) {
            logger.debug("isTargetWindow: No wmClass provided");
            return false;
        }

        return (
            wmClass.toLowerCase().includes(this.appClass.toLowerCase()) ||
            this.appClass.toLowerCase().includes(wmClass.toLowerCase())
        );
    }

    list(): WindowInfo[] {
        const windowActors = global.get_window_actors();
        const workspaceManager = global.workspace_manager;

        const windows = windowActors
            .map((w) => w.meta_window)
            .filter((mw): mw is Meta.Window => mw !== null)
            .map((metaWindow) => {
                const windowWorkspace = metaWindow.get_workspace();
                const frame = metaWindow.get_frame_rect();

                // Explicitly construct the object to be type-safe
                return {
                    id: metaWindow.get_id(),
                    title: metaWindow.get_title(),
                    wm_class: metaWindow.get_wm_class() || "",
                    wm_class_instance: metaWindow.get_wm_class_instance() || "",
                    pid: metaWindow.get_pid(),
                    maximized: isMaximized(metaWindow) !== 0, // 0 means not maximized
                    display: metaWindow.get_display(),
                    frame_type: metaWindow.get_frame_type(),
                    window_type: metaWindow.get_window_type(),
                    layer: metaWindow.get_layer(),
                    monitor: metaWindow.get_monitor(),
                    role: metaWindow.get_role(),
                    width: frame.width,
                    height: frame.height,
                    x: frame.x,
                    y: frame.y,
                    in_current_workspace: metaWindow.located_on_workspace?.(
                        workspaceManager.get_active_workspace?.(),
                    ),
                    canclose: metaWindow.can_close(),
                    canmaximize: metaWindow.can_maximize(),
                    canminimize: metaWindow.can_minimize(),
                    canshade: false, // can_shade() is not in the type definitions
                    moveable: metaWindow.allows_move(),
                    resizeable: metaWindow.allows_resize(),
                    has_focus: metaWindow.has_focus(),
                    workspace: windowWorkspace ? windowWorkspace.index() : -1,
                };
            });

        return windows as unknown as WindowInfo[];
    }

    details(winid: number): WindowInfo {
        const metaWindow = getWindowById(winid);

        if (!metaWindow) {
            throw new Error("Window not found");
        }
        const workspaceManager = global.workspace_manager;
        const windowWorkspace = metaWindow.get_workspace();
        const frame = metaWindow.get_frame_rect();

        // Explicitly construct the object to be type-safe
        const win = {
            id: metaWindow.get_id(),
            title: metaWindow.get_title(),
            wm_class: metaWindow.get_wm_class() || "",
            wm_class_instance: metaWindow.get_wm_class_instance() || "",
            pid: metaWindow.get_pid(),
            maximized: isMaximized(metaWindow) !== 0, // 0 means not maximized
            display: metaWindow.get_display(),
            frame_type: metaWindow.get_frame_type(),
            window_type: metaWindow.get_window_type(),
            layer: metaWindow.get_layer(),
            monitor: metaWindow.get_monitor(),
            role: metaWindow.get_role(),
            width: frame.width,
            height: frame.height,
            x: frame.x,
            y: frame.y,
            in_current_workspace: metaWindow.located_on_workspace?.(
                workspaceManager.get_active_workspace?.(),
            ),
            canclose: metaWindow.can_close(),
            canmaximize: metaWindow.can_maximize(),
            canminimize: metaWindow.can_minimize(),
            canshade: false, // can_shade() is not in the type definitions
            moveable: metaWindow.allows_move(),
            resizeable: metaWindow.allows_resize(),
            has_focus: metaWindow.has_focus(),
            workspace: windowWorkspace ? windowWorkspace.index() : -1,
        };

        return win as unknown as WindowInfo;
    }

    getTitle(winid: number): string {
        const w = getWindowById(winid);
        if (w) {
            return w.get_title();
        } else {
            throw new Error("Window not found");
        }
    }

    getFrameRect(winid: number): FrameRect {
        const w = getWindowById(winid);
        if (w) {
            const frame = w.get_frame_rect();
            return {
                x: frame.x,
                y: frame.y,
                width: frame.width,
                height: frame.height,
            };
        } else {
            throw new Error("Window not found");
        }
    }

    getFrameBounds(winid: number): FrameBounds {
        const w = getWindowById(winid);
        if (w) {
            return {
                frame_bounds: (w as MetaWindowWithExtras).get_frame_bounds(),
            };
        } else {
            throw new Error("Window not found");
        }
    }

    moveToWorkspace(winid: number, workspaceNum: number): void {
        const win = getWindowById(winid);
        if (win) {
            win.change_workspace_by_index(workspaceNum, false);
        } else {
            throw new Error("Window not found");
        }
    }

    moveResize(
        winid: number,
        x: number,
        y: number,
        width: number,
        height: number,
    ): void {
        const win = getWindowById(winid);

        if (win) {
            if (win.maximized_horizontally || win.maximized_vertically) {
                win.unmaximize();
            }

            win.move_resize_frame(true, x, y, width, height);
        } else {
            throw new Error("Window not found");
        }
    }

    resize(winid: number, width: number, height: number): void {
        const win = getWindowById(winid);
        if (win) {
            if (win.maximized_horizontally || win.maximized_vertically) {
                win.unmaximize();
            }
            const frame = win.get_frame_rect();
            win.move_resize_frame(true, frame.x, frame.y, width, height);
        } else {
            throw new Error("Window not found");
        }
    }

    move(winid: number, x: number, y: number): void {
        const win = getWindowById(winid);
        if (win) {
            if (win.maximized_horizontally || win.maximized_vertically) {
                win.unmaximize();
            }
            win.move_frame(true, x, y);
        } else {
            throw new Error("Window not found");
        }
    }

    maximize(winid: number): void {
        const win = getWindowById(winid);
        if (win) {
            win.maximize();
        } else {
            throw new Error("Window not found");
        }
    }

    minimize(winid: number): void {
        const win = getWindowById(winid);
        if (win) {
            win.minimize();
        } else {
            throw new Error("Window not found");
        }
    }

    unmaximize(winid: number): void {
        const win = getWindowById(winid);
        if (win) {
            win.unmaximize();
        } else {
            throw new Error("Window not found");
        }
    }

    unminimize(winid: number): void {
        const win = getWindowById(winid);
        if (win) {
            win.unminimize();
        } else {
            throw new Error("Window not found");
        }
    }

    activate(winid: number): void {
        const win = getWindowById(winid);
        if (win) {
            const currentTime = getCurrentTime();
            const workspace = win.get_workspace();
            if (workspace) {
                workspace.activate_with_focus(win, currentTime);
            } else {
                win.activate(currentTime);
            }
        } else {
            throw new Error("Window not found");
        }
    }

    close(winid: number): void {
        const win = getWindowById(winid);
        if (win) {
            try {
                // Check if window is still valid before attempting to close
                if (win.get_id() === winid) {
                    win.delete(getCurrentTime());
                } else {
                    throw new Error(
                        "Window ID mismatch - window may be destroyed",
                    );
                }
            } catch (error) {
                // Window might be already destroyed or invalid
                throw new Error(`Failed to close window ${winid}: ${error}`);
            }
        } else {
            throw new Error("Window not found");
        }
    }

    listWorkspaces(): WorkspaceInfo[] {
        const workspaceManager = new WorkspaceManager();
        return workspaceManager.getAllWorkspaces();
    }

    getActiveWorkspace(): WorkspaceInfo {
        const workspaceManager = new WorkspaceManager();
        const currentIndex = workspaceManager.getCurrentWorkspaceIndex();
        const workspace = workspaceManager.getWorkspaceInfo(currentIndex);
        if (!workspace) {
            throw new Error("No active workspace found");
        }
        return workspace;
    }

    destroy(): void {
        logger.debug("Window manager destroyed");
    }
}
