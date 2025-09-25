import type { MetaWindowExtended } from "../types/index.js";

export const getWindowById = (winid: number) => {
    if (!winid || winid <= 0) return null;

    try {
        const windowActors = global.get_window_actors();
        return windowActors.find((w) => {
            try {
                return w.meta_window && w.meta_window.get_id() === winid;
            } catch {
                return false;
            }
        });
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

export const getFocusedWindow = () => {
    const windowActors = global.get_window_actors();
    return windowActors.find((w) => w.meta_window.has_focus());
};

export const getFocusedWindowApp = () => {
    const focusedWindow = getFocusedWindow();
    if (focusedWindow) {
        // Try to get the application name from wm_class first, then title as fallback
        const wmClass = focusedWindow.meta_window.get_wm_class();
        const title = focusedWindow.meta_window.get_title();

        // Return the most descriptive name available
        return wmClass || title || "unknown";
    }
    return "gnome-shell"; // Fallback to gnome-shell if no focused window
};

/**
 * Starting from GNOME 49, the method is_maximized() is available on the Window object.
 * This is used to check if a window is maximized.
 * For older versions, we use get_maximized() instead.
 */
export const isMaximized = (win: MetaWindowExtended) => {
    if (win.is_maximized !== undefined) {
        return win.is_maximized();
    }

    return win.get_maximized();
};
