import { logger } from "../../utils/logger.js";

export class WorkspaceManager {
    getWorkspaceCount(): number {
        try {
            const workspaceManager = global.workspace_manager;
            return workspaceManager.get_n_workspaces();
        } catch (error) {
            logger("Error getting workspace count", error);
            return 0;
        }
    }

    getCurrentWorkspaceIndex(): number {
        try {
            const workspaceManager = global.workspace_manager;
            const currentWorkspace = workspaceManager.get_active_workspace();
            return currentWorkspace.index();
        } catch (error) {
            logger("Error getting current workspace index", error);
            return 0;
        }
    }

    getWorkspaceByIndex(index: number) {
        try {
            const workspaceManager = global.workspace_manager;
            return workspaceManager.get_workspace_by_index(index);
        } catch (error) {
            logger("Error getting workspace by index", error);
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
            logger("Error switching to workspace", error);
            throw error;
        }
    }

    getWorkspaceInfo(index: number) {
        try {
            const workspace = this.getWorkspaceByIndex(index);
            if (workspace) {
                return {
                    index: workspace.index(),
                    name: `Workspace ${workspace.index() + 1}`,
                    isActive:
                        workspace ===
                        global.workspace_manager.get_active_workspace(),
                    windowCount: workspace.list_windows().length,
                };
            }
            return null;
        } catch (error) {
            logger("Error getting workspace info", error);
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
                    workspaces.push(this.getWorkspaceInfo(i));
                }
            }

            return workspaces;
        } catch (error) {
            logger("Error getting all workspaces", error);
            return [];
        }
    }
}
