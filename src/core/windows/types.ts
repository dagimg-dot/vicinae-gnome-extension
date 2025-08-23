export interface WindowInfo {
    id: number;
    title: string;
    wm_class: string;
    wm_class_instance: string;
    pid: number;
    maximized: boolean;
    display: string;
    frame_type: number;
    window_type: number;
    layer: number;
    monitor: number;
    role: string;
    width: number;
    height: number;
    x: number;
    y: number;
    in_current_workspace: boolean;
    canclose: boolean;
    canmaximize: boolean;
    canminimize: boolean;
    canshade: boolean;
    moveable: boolean;
    resizeable: boolean;
    has_focus: boolean;
}

export interface FrameRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface FrameBounds {
    frame_bounds: FrameRect;
}

export interface WindowManager {
    list(): WindowInfo[];
    details(winid: number): WindowInfo;
    getTitle(winid: number): string;
    getFrameRect(winid: number): FrameRect;
    getFrameBounds(winid: number): FrameBounds;
    moveToWorkspace(winid: number, workspaceNum: number): void;
    moveResize(
        winid: number,
        x: number,
        y: number,
        width: number,
        height: number,
    ): void;
    resize(winid: number, width: number, height: number): void;
    move(winid: number, x: number, y: number): void;
    maximize(winid: number): void;
    minimize(winid: number): void;
    unmaximize(winid: number): void;
    unminimize(winid: number): void;
    activate(winid: number): void;
    close(winid: number): void;
}
