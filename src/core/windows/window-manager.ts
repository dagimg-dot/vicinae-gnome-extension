import Meta from "gi://Meta";
import { getCurrentTime, getWindowById } from "../../utils/window-utils.js";
import type {
    FrameBounds,
    FrameRect,
    WindowInfo,
    WindowManager,
    WorkspaceInfo,
} from "./types.js";
import { WorkspaceManager } from "./workspace-manager.js";

// The GJS type definitions are sometimes incomplete or don't export all types.
// We define our own interfaces here for type safety.
interface Rectangle {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface MetaWindowWithExtras extends Meta.Window {
    get_frame_bounds(): Rectangle;
}

export class VicinaeWindowManager implements WindowManager {
    list(): WindowInfo[] {
        const windowActors = global.get_window_actors();
        const workspaceManager = global.workspace_manager;

        const windows = windowActors.map((w) => {
            const metaWindow = w.meta_window;
            const windowWorkspace = metaWindow.get_workspace();
            const frame = metaWindow.get_frame_rect();

            // Explicitly construct the object to be type-safe
            return {
                id: metaWindow.get_id(),
                title: metaWindow.get_title(),
                wm_class: metaWindow.get_wm_class(),
                wm_class_instance: metaWindow.get_wm_class_instance(),
                pid: metaWindow.get_pid(),
                maximized: metaWindow.get_maximized() !== 0, // 0 means not maximized
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
        const w = getWindowById(winid);

        if (!w) {
            throw new Error("Window not found");
        }

        const metaWindow = w.meta_window;
        const workspaceManager = global.workspace_manager;
        const windowWorkspace = metaWindow.get_workspace();
        const frame = metaWindow.get_frame_rect();

        // Explicitly construct the object to be type-safe
        const win = {
            id: metaWindow.get_id(),
            title: metaWindow.get_title(),
            wm_class: metaWindow.get_wm_class(),
            wm_class_instance: metaWindow.get_wm_class_instance(),
            pid: metaWindow.get_pid(),
            maximized: metaWindow.get_maximized() !== 0, // 0 means not maximized
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
            return w.meta_window.get_title();
        } else {
            throw new Error("Window not found");
        }
    }

    getFrameRect(winid: number): FrameRect {
        const w = getWindowById(winid);
        if (w) {
            const frame = w.meta_window.get_frame_rect();
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
                frame_bounds: (
                    w.meta_window as MetaWindowWithExtras
                ).get_frame_bounds(),
            };
        } else {
            throw new Error("Window not found");
        }
    }

    moveToWorkspace(winid: number, workspaceNum: number): void {
        const win = getWindowById(winid)?.meta_window;
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
            if (
                win.meta_window.maximized_horizontally ||
                win.meta_window.maximized_vertically
            ) {
                win.meta_window.unmaximize(Meta.MaximizeFlags.BOTH);
            }

            win.meta_window.move_resize_frame(true, x, y, width, height);
        } else {
            throw new Error("Window not found");
        }
    }

    resize(winid: number, width: number, height: number): void {
        const win = getWindowById(winid);
        if (win) {
            if (
                win.meta_window.maximized_horizontally ||
                win.meta_window.maximized_vertically
            ) {
                win.meta_window.unmaximize(Meta.MaximizeFlags.BOTH);
            }
            win.meta_window.move_resize_frame(
                true,
                win.get_x(),
                win.get_y(),
                width,
                height,
            );
        } else {
            throw new Error("Window not found");
        }
    }

    move(winid: number, x: number, y: number): void {
        const win = getWindowById(winid);
        if (win) {
            if (
                win.meta_window.maximized_horizontally ||
                win.meta_window.maximized_vertically
            ) {
                win.meta_window.unmaximize(Meta.MaximizeFlags.BOTH);
            }
            win.meta_window.move_frame(true, x, y);
        } else {
            throw new Error("Window not found");
        }
    }

    maximize(winid: number): void {
        const win = getWindowById(winid)?.meta_window;
        if (win) {
            win.maximize(Meta.MaximizeFlags.BOTH);
        } else {
            throw new Error("Window not found");
        }
    }

    minimize(winid: number): void {
        const win = getWindowById(winid)?.meta_window;
        if (win) {
            win.minimize();
        } else {
            throw new Error("Window not found");
        }
    }

    unmaximize(winid: number): void {
        const win = getWindowById(winid)?.meta_window;
        if (win) {
            win.unmaximize(Meta.MaximizeFlags.BOTH);
        } else {
            throw new Error("Window not found");
        }
    }

    unminimize(winid: number): void {
        const win = getWindowById(winid)?.meta_window;
        if (win) {
            win.unminimize();
        } else {
            throw new Error("Window not found");
        }
    }

    activate(winid: number): void {
        const win = getWindowById(winid)?.meta_window;
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
        const win = getWindowById(winid)?.meta_window;
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
}
