import type Meta from "gi://Meta";
import {
    getCurrentTime,
    getWindowById,
    isMaximized,
    isTargetWindow,
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

    private static toWindowInfo(mw: Meta.Window): WindowInfo {
        const workspace = mw.get_workspace();
        const frame = mw.get_frame_rect();
        return {
            id: mw.get_id(),
            title: mw.get_title(),
            wm_class: mw.get_wm_class() || "",
            wm_class_instance: mw.get_wm_class_instance() || "",
            pid: mw.get_pid(),
            maximized: isMaximized(mw) !== 0,
            display: mw.get_display(),
            frame_type: mw.get_frame_type(),
            window_type: mw.get_window_type(),
            layer: mw.get_layer(),
            monitor: mw.get_monitor(),
            role: mw.get_role(),
            width: frame.width,
            height: frame.height,
            x: frame.x,
            y: frame.y,
            in_current_workspace: mw.located_on_workspace?.(
                global.workspace_manager.get_active_workspace?.(),
            ),
            canclose: mw.can_close(),
            canmaximize: mw.can_maximize(),
            canminimize: mw.can_minimize(),
            canshade: false,
            moveable: mw.allows_move(),
            resizeable: mw.allows_resize(),
            has_focus: mw.has_focus(),
            workspace: workspace ? workspace.index() : -1,
        } as unknown as WindowInfo;
    }

    list(): WindowInfo[] {
        return global
            .get_window_actors()
            .map((w) => w.meta_window)
            .filter(
                (mw): mw is Meta.Window =>
                    mw !== null && !isTargetWindow(mw, this.appClass),
            )
            .map(VicinaeWindowManager.toWindowInfo);
    }

    details(winid: number): WindowInfo {
        const mw = getWindowById(winid);
        if (!mw) throw new Error("Window not found");
        return VicinaeWindowManager.toWindowInfo(mw);
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
        return WorkspaceManager.getAllWorkspaces();
    }

    getActiveWorkspace(): WorkspaceInfo {
        const currentIndex = WorkspaceManager.getCurrentWorkspaceIndex();
        const workspace = WorkspaceManager.getWorkspaceInfo(currentIndex);
        if (!workspace) {
            throw new Error("No active workspace found");
        }
        return workspace;
    }
}
