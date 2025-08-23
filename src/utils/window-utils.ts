export const getWindowById = (winid: number) => {
    const windowActors = global.get_window_actors();
    return windowActors.find((w) => w.meta_window.get_id() === winid);
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
