import { error as logError } from "../../utils/logger.js";

export class WorkspaceManager {
    getWorkspaceCount(): number {
        try {
            const workspaceManager = global.workspace_manager;
            return workspaceManager.get_n_workspaces();
        } catch (error) {
            logError("Error getting workspace count", error);
            return 0;
        }
    }

    getCurrentWorkspaceIndex(): number {
        try {
            const workspaceManager = global.workspace_manager;
            const currentWorkspace = workspaceManager.get_active_workspace();
            return currentWorkspace.index();
        } catch (error) {
            logError("Error getting current workspace index", error);
            return 0;
        }
    }

    getWorkspaceByIndex(index: number) {
        try {
            const workspaceManager = global.workspace_manager;
            return workspaceManager.get_workspace_by_index(index);
        } catch (error) {
            logError("Error getting workspace by index", error);
            return null;
        }
    }

    switchToWorkspace(index: number): void {
        try {
            const workspace = this.getWorkspaceByIndex(index);
            if (workspace) {
                workspace.activate(global.get_current_time());
            }
        } catch (error) {
            logError("Error switching to workspace", error);
            throw error;
        }
    }

    getWorkspaceInfo(index: number) {
        try {
            const workspace = this.getWorkspaceByIndex(index);
            if (workspace) {
                const windows = workspace.list_windows();
                const hasFullscreen = windows.some(
                    (win) => win.get_maximized() === 3,
                ); // Meta.MaximizeFlags.BOTH

                // Get monitor from first window on this workspace, or default to 0
                let monitor = 0;
                if (windows.length > 0) {
                    monitor = windows[0].get_monitor();
                }

                return {
                    index: workspace.index(),
                    name: `Workspace ${workspace.index() + 1}`,
                    isActive:
                        workspace ===
                        global.workspace_manager.get_active_workspace(),
                    windowCount: windows.length,
                    monitor: monitor,
                    hasfullscreen: hasFullscreen,
                };
            }
            return null;
        } catch (error) {
            logError("Error getting workspace info", error);
            return null;
        }
    }

    getAllWorkspaces() {
        try {
            const workspaceManager = global.workspace_manager;
            const workspaces = [];

            for (let i = 0; i < workspaceManager.get_n_workspaces(); i++) {
                const workspace = workspaceManager.get_workspace_by_index(i);
                if (workspace) {
                    const workspaceInfo = this.getWorkspaceInfo(i);
                    if (workspaceInfo) {
                        workspaces.push(workspaceInfo);
                    }
                }
            }

            return workspaces;
        } catch (error) {
            logError("Error getting all workspaces", error);
            return [];
        }
    }
}
