import type Meta from "gi://Meta";

export const getWindowById = (winid: number): Meta.Window | null => {
    if (!winid || winid <= 0) return null;

    try {
        const windowActors = global.get_window_actors();
        const actor = windowActors.find((w) => {
            try {
                return w.meta_window && w.meta_window.get_id() === winid;
            } catch {
                return false;
            }
        });
        return actor?.meta_window ?? null;
    } catch (_error) {
        return null;
    }
};

export const getCurrentWorkspace = () => {
    const workspaceManager = global.workspace_manager;
    return workspaceManager.get_active_workspace();
};

export const getCurrentMonitor = () => {
    return global.display.get_current_monitor();
};

export const getCurrentTime = () => {
    return global.get_current_time();
};

export const getFocusedWindow = (): Meta.Window | null => {
    const windowActors = global.get_window_actors();
    const actor = windowActors.find((w) => w.meta_window?.has_focus());
    return actor?.meta_window ?? null;
};

export const getFocusedWindowApp = () => {
    const focusedWindow = getFocusedWindow();
    if (focusedWindow) {
        const wmClass = focusedWindow.get_wm_class();
        const title = focusedWindow.get_title();

        return wmClass || title || "unknown";
    }
    return "gnome-shell";
};

/**
 * Starting from GNOME 49, the method is_maximized() is available on the Window object.
 * For older versions, we use get_maximized() instead.
 */
export const isMaximized = (win: Meta.Window) => {
    if (win.is_maximized !== undefined) {
        return win.is_maximized();
    }

    // @ts-expect-error - get_maximized is not in the type definitions for GNOME 49+
    return win.get_maximized();
};

/**
 * Checks if a window is the Vicinae launcher window.
 * Matches wm_class and excludes non-launcher windows (such as Settings).
 */
export const isTargetWindow = (
    window: Meta.Window | null | undefined,
    appClass: string = "vicinae",
): boolean => {
    if (!window) return false;

    const wmClass = window.get_wm_class();
    if (!wmClass) return false;

    const lowerWmClass = wmClass.toLowerCase();
    const lowerAppClass = appClass.toLowerCase();

    if (
        !lowerWmClass.includes(lowerAppClass) &&
        !lowerAppClass.includes(lowerWmClass)
    ) {
        return false;
    }

    const title = window.get_title();
    if (title?.toLowerCase().includes("setting")) {
        return false;
    }

    return true;
};
