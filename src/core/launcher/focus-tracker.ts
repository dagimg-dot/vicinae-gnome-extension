import type Meta from "gi://Meta";
import { logger } from "../../utils/logger.js";

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
            logger.info("FocusTracker: Focus tracking enabled");
        } catch (error) {
            logger.error("FocusTracker: Error enabling focus tracking", error);
            throw error;
        }
    }

    disable() {
        if (this.focusHandler) {
            global.display.disconnect(this.focusHandler);
            this.focusHandler = undefined;
        }
        logger.info("FocusTracker: Focus tracking disabled");
    }
}
