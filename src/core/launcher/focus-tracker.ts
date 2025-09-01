import type Meta from "gi://Meta";
import { info, error as logError } from "../../utils/logger.js";

declare const global: {
    display: Meta.Display;
};

export class FocusTracker {
    private focusHandler?: number;

    constructor(private onFocusChange: () => void) {}

    enable() {
        try {
            this.focusHandler = global.display.connect(
                "notify::focus-window",
                (_display: Meta.Display, _window: Meta.Window) => {
                    this.onFocusChange();
                },
            );
            info("FocusTracker: Focus tracking enabled");
        } catch (error) {
            logError("FocusTracker: Error enabling focus tracking", error);
            throw error;
        }
    }

    disable() {
        if (this.focusHandler) {
            global.display.disconnect(this.focusHandler);
            this.focusHandler = undefined;
        }
        info("FocusTracker: Focus tracking disabled");
    }
}
