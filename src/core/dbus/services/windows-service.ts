import { logger } from "../../../utils/logger.js";
import { VicinaeWindowManager } from "../../windows/window-manager.js";

export class WindowsService {
    private windowManager: VicinaeWindowManager;

    constructor() {
        this.windowManager = new VicinaeWindowManager();
    }

    List(): string {
        try {
            logger("D-Bus: List windows requested");
            const windows = this.windowManager.list();
            return JSON.stringify(windows);
        } catch (error) {
            logger("D-Bus: Error listing windows", error);
            throw error;
        }
    }

    Details(winid: number): string {
        try {
            logger("D-Bus: Window details requested", { winid });
            const details = this.windowManager.details(winid);
            return JSON.stringify(details);
        } catch (error) {
            logger("D-Bus: Error getting window details", error);
            throw error;
        }
    }

    GetTitle(winid: number): string {
        try {
            logger("D-Bus: Window title requested", { winid });
            return this.windowManager.getTitle(winid);
        } catch (error) {
            logger("D-Bus: Error getting window title", error);
            throw error;
        }
    }

    GetFrameRect(winid: number): string {
        try {
            logger("D-Bus: Window frame rect requested", { winid });
            const frameRect = this.windowManager.getFrameRect(winid);
            return JSON.stringify(frameRect);
        } catch (error) {
            logger("D-Bus: Error getting window frame rect", error);
            throw error;
        }
    }

    GetFrameBounds(winid: number): string {
        try {
            logger("D-Bus: Window frame bounds requested", { winid });
            const frameBounds = this.windowManager.getFrameBounds(winid);
            return JSON.stringify(frameBounds);
        } catch (error) {
            logger("D-Bus: Error getting window frame bounds", error);
            throw error;
        }
    }

    MoveToWorkspace(winid: number, workspaceNum: number): void {
        try {
            logger("D-Bus: Move window to workspace requested", {
                winid,
                workspaceNum,
            });
            this.windowManager.moveToWorkspace(winid, workspaceNum);
        } catch (error) {
            logger("D-Bus: Error moving window to workspace", error);
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
            logger("D-Bus: Move resize window requested", {
                winid,
                x,
                y,
                width,
                height,
            });
            this.windowManager.moveResize(winid, x, y, width, height);
        } catch (error) {
            logger("D-Bus: Error move resizing window", error);
            throw error;
        }
    }

    Resize(winid: number, width: number, height: number): void {
        try {
            logger("D-Bus: Resize window requested", { winid, width, height });
            this.windowManager.resize(winid, width, height);
        } catch (error) {
            logger("D-Bus: Error resizing window", error);
            throw error;
        }
    }

    Move(winid: number, x: number, y: number): void {
        try {
            logger("D-Bus: Move window requested", { winid, x, y });
            this.windowManager.move(winid, x, y);
        } catch (error) {
            logger("D-Bus: Error moving window", error);
            throw error;
        }
    }

    Maximize(winid: number): void {
        try {
            logger("D-Bus: Maximize window requested", { winid });
            this.windowManager.maximize(winid);
        } catch (error) {
            logger("D-Bus: Error maximizing window", error);
            throw error;
        }
    }

    Minimize(winid: number): void {
        try {
            logger("D-Bus: Minimize window requested", { winid });
            this.windowManager.minimize(winid);
        } catch (error) {
            logger("D-Bus: Error minimizing window", error);
            throw error;
        }
    }

    Unmaximize(winid: number): void {
        try {
            logger("D-Bus: Unmaximize window requested", { winid });
            this.windowManager.unmaximize(winid);
        } catch (error) {
            logger("D-Bus: Error unmaximizing window", error);
            throw error;
        }
    }

    Unminimize(winid: number): void {
        try {
            logger("D-Bus: Unminimize window requested", { winid });
            this.windowManager.unminimize(winid);
        } catch (error) {
            logger("D-Bus: Error unminimizing window", error);
            throw error;
        }
    }

    Activate(winid: number): void {
        try {
            logger("D-Bus: Activate window requested", { winid });
            this.windowManager.activate(winid);
        } catch (error) {
            logger("D-Bus: Error activating window", error);
            throw error;
        }
    }

    Close(winid: number): void {
        try {
            logger("D-Bus: Close window requested", { winid });
            this.windowManager.close(winid);
        } catch (error) {
            logger("D-Bus: Error closing window", error);
            throw error;
        }
    }
}
