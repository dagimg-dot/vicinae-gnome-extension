import { logger } from "../../utils/logger.js";
import { getCurrentTime, isMaximized } from "../../utils/window-utils.js";

// biome-ignore lint/complexity/noStaticOnlyClass: groups workspace-related helpers
export class WorkspaceManager {
    static getWorkspaceCount(): number {
        try {
            return global.workspace_manager.get_n_workspaces();
        } catch (error) {
            logger.error("Error getting workspace count", error);
            return 0;
        }
    }

    static getCurrentWorkspaceIndex(): number {
        try {
            const currentWorkspace =
                global.workspace_manager.get_active_workspace();
            return currentWorkspace.index();
        } catch (error) {
            logger.error("Error getting current workspace index", error);
            return 0;
        }
    }

    static getWorkspaceByIndex(index: number) {
        try {
            return global.workspace_manager.get_workspace_by_index(index);
        } catch (error) {
            logger.error("Error getting workspace by index", error);
            return null;
        }
    }

    static switchToWorkspace(index: number): void {
        try {
            const workspace = WorkspaceManager.getWorkspaceByIndex(index);
            if (workspace) {
                workspace.activate(getCurrentTime());
            }
        } catch (error) {
            logger.error("Error switching to workspace", error);
            throw error;
        }
    }

    static getWorkspaceInfo(index: number) {
        try {
            const workspace = WorkspaceManager.getWorkspaceByIndex(index);
            if (workspace) {
                const windows = workspace.list_windows();
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
                    monitor,
                    hasfullscreen: windows.some(
                        (win) => isMaximized(win) === 3,
                    ),
                };
            }
            return null;
        } catch (error) {
            logger.error("Error getting workspace info", error);
            return null;
        }
    }

    static getAllWorkspaces() {
        try {
            const workspaceManager = global.workspace_manager;
            const workspaces = [];

            for (let i = 0; i < workspaceManager.get_n_workspaces(); i++) {
                const workspaceInfo = WorkspaceManager.getWorkspaceInfo(i);
                if (workspaceInfo) {
                    workspaces.push(workspaceInfo);
                }
            }

            return workspaces;
        } catch (error) {
            logger.error("Error getting all workspaces", error);
            return [];
        }
    }
}
