import {
    getCurrentMonitor,
    getCurrentTime,
    getWindowById,
} from "../../utils/window-utils.js";
import type {
    FrameBounds,
    FrameRect,
    WindowInfo,
    WindowManager,
} from "./types.js";

export class VicinaeWindowManager implements WindowManager {
    list(): WindowInfo[] {
        const windowActors = global.get_window_actors();
        const workspaceManager = global.workspace_manager;

        const props = {
            get: [
                "wm_class",
                "wm_class_instance",
                "title",
                "pid",
                "id",
                "frame_type",
                "window_type",
                "width",
                "height",
                "x",
                "y",
            ],
            has: ["focus"],
        };

        const windowJsonArr = windowActors.map((w) => {
            const win: Record<string, unknown> = {
                in_current_workspace: w.meta_window.located_on_workspace?.(
                    workspaceManager.get_active_workspace?.(),
                ),
            };

            // Use for...of loops to avoid assignment in expressions and return value issues
            for (const name of props.get) {
                win[name] = w.meta_window[`get_${name}`]?.();
            }
            for (const name of props.has) {
                win[name] = w.meta_window[`has_${name}`]?.();
            }

            return win;
        });

        return windowJsonArr;
    }

    details(winid: number): WindowInfo {
        const w = getWindowById(winid);

        if (!w) {
            throw new Error("Window not found");
        }

        const workspaceManager = global.workspace_manager;
        const currentmonitor = getCurrentMonitor();

        const props = {
            get: [
                "wm_class",
                "wm_class_instance",
                "pid",
                "id",
                "maximized",
                "display",
                "frame_type",
                "window_type",
                "layer",
                "monitor",
                "role",
                "title",
            ],
            can: ["close", "maximize", "minimize"],
            has: ["focus"],
            custom: new Map([
                ["moveable", "allows_move"],
                ["resizeable", "allows_resize"],
                ["area", "get_work_area_current_monitor"],
                ["area_all", "get_work_area_all_monitors"],
                ["canclose", "can_close"],
                ["canmaximize", "can_maximize"],
                ["canminimize", "can_minimize"],
                ["canshade", "can_shade"],
            ]),
            frame: ["x", "y", "width", "height"],
        };

        const win: Record<string, unknown> = {
            in_current_workspace: w.meta_window.located_on_workspace?.(
                workspaceManager.get_active_workspace?.(),
            ),
            area_cust:
                w.meta_window.get_work_area_for_monitor?.(currentmonitor),
        };

        // Use for...of loops to avoid assignment in expressions and return value issues
        for (const name of props.get) {
            win[name] = w.meta_window[`get_${name}`]?.();
        }
        for (const name of props.can) {
            win[`can${name}`] = w.meta_window[`can_${name}`]?.();
        }
        for (const name of props.has) {
            win[name] = w.meta_window[`has_${name}`]?.();
        }
        props.custom.forEach((fname, name) => {
            win[name] = w.meta_window[fname]?.();
        });

        const frame = w.meta_window.get_frame_rect();
        for (const name of props.frame) {
            win[name] = frame[name];
        }

        return win;
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
                frame_bounds: w.meta_window.get_frame_bounds(),
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
                win.meta_window.unmaximize(3);
            }

            win.meta_window.move_resize_frame(1, x, y, width, height);
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
                win.meta_window.unmaximize(3);
            }
            win.meta_window.move_resize_frame(
                1,
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
                win.meta_window.unmaximize(3);
            }
            win.meta_window.move_frame(1, x, y);
        } else {
            throw new Error("Window not found");
        }
    }

    maximize(winid: number): void {
        const win = getWindowById(winid)?.meta_window;
        if (win) {
            win.maximize(3);
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
            win.unmaximize(3);
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
            const workspace = win.get_workspace();
            if (workspace) {
                workspace.activate_with_focus(win, 0);
            } else {
                win.activate(0);
            }
        } else {
            throw new Error("Window not found");
        }
    }

    close(winid: number): void {
        const win = getWindowById(winid)?.meta_window;
        if (win) {
            win.delete(getCurrentTime());
        } else {
            throw new Error("Window not found");
        }
    }
}
