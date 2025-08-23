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
