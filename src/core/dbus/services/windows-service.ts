import { error as logError } from "../../../utils/logger.js";
import { VicinaeWindowManager } from "../../windows/window-manager.js";

export class WindowsService {
    private windowManager: VicinaeWindowManager;

    constructor() {
        this.windowManager = new VicinaeWindowManager();
    }

    List(): string {
        try {
            const windows = this.windowManager.list();
            return JSON.stringify(windows);
        } catch (error) {
            logError("D-Bus: Error listing windows", error);
            throw error;
        }
    }

    Details(winid: number): string {
        try {
            const details = this.windowManager.details(winid);
            return JSON.stringify(details);
        } catch (error) {
            logError("D-Bus: Error getting window details", error);
            throw error;
        }
    }

    GetTitle(winid: number): string {
        try {
            return this.windowManager.getTitle(winid);
        } catch (error) {
            logError("D-Bus: Error getting window title", error);
            throw error;
        }
    }

    GetFrameRect(winid: number): string {
        try {
            const frameRect = this.windowManager.getFrameRect(winid);
            return JSON.stringify(frameRect);
        } catch (error) {
            logError("D-Bus: Error getting window frame rect", error);
            throw error;
        }
    }

    GetFrameBounds(winid: number): string {
        try {
            const frameBounds = this.windowManager.getFrameBounds(winid);
            return JSON.stringify(frameBounds);
        } catch (error) {
            logError("D-Bus: Error getting window frame bounds", error);
            throw error;
        }
    }

    MoveToWorkspace(winid: number, workspaceNum: number): void {
        try {
            this.windowManager.moveToWorkspace(winid, workspaceNum);
        } catch (error) {
            logError("D-Bus: Error moving window to workspace", error);
            throw error;
        }
    }

    MoveResize(
        winid: number,
        x: number,
        y: number,
        width: number,
        height: number,
    ): void {
        try {
            this.windowManager.moveResize(winid, x, y, width, height);
        } catch (error) {
            logError("D-Bus: Error move resizing window", error);
            throw error;
        }
    }

    Resize(winid: number, width: number, height: number): void {
        try {
            this.windowManager.resize(winid, width, height);
        } catch (error) {
            logError("D-Bus: Error resizing window", error);
            throw error;
        }
    }

    Move(winid: number, x: number, y: number): void {
        try {
            this.windowManager.move(winid, x, y);
        } catch (error) {
            logError("D-Bus: Error moving window", error);
            throw error;
        }
    }

    Maximize(winid: number): void {
        try {
            this.windowManager.maximize(winid);
        } catch (error) {
            logError("D-Bus: Error maximizing window", error);
            throw error;
        }
    }

    Minimize(winid: number): void {
        try {
            this.windowManager.minimize(winid);
        } catch (error) {
            logError("D-Bus: Error minimizing window", error);
            throw error;
        }
    }

    Unmaximize(winid: number): void {
        try {
            this.windowManager.unmaximize(winid);
        } catch (error) {
            logError("D-Bus: Error unmaximizing window", error);
            throw error;
        }
    }

    Unminimize(winid: number): void {
        try {
            this.windowManager.unminimize(winid);
        } catch (error) {
            logError("D-Bus: Error unminimizing window", error);
            throw error;
        }
    }

    Activate(winid: number): void {
        try {
            this.windowManager.activate(winid);
        } catch (error) {
            logError("D-Bus: Error activating window", error);
            throw error;
        }
    }

    Close(winid: number): void {
        try {
            this.windowManager.close(winid);
        } catch (error) {
            logError("D-Bus: Error closing window", error);
            throw error;
        }
    }

    ListWorkspaces(): string {
        try {
            const workspaces = this.windowManager.listWorkspaces();
            return JSON.stringify(workspaces);
        } catch (error) {
            logError("D-Bus: Error listing workspaces", error);
            throw error;
        }
    }

    GetActiveWorkspace(): string {
        try {
            const workspace = this.windowManager.getActiveWorkspace();
            return JSON.stringify(workspace);
        } catch (error) {
            logError("D-Bus: Error getting active workspace", error);
            throw error;
        }
    }

    GetWorkspaceWindows(workspaceIndex: number): string {
        try {
            const windows = this.windowManager.list();
            const workspaceWindows = windows.filter(
                (win) => win.workspace === workspaceIndex,
            );
            return JSON.stringify(workspaceWindows);
        } catch (error) {
            logError("D-Bus: Error getting workspace windows", error);
            throw error;
        }
    }
}
