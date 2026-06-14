import type Meta from "gi://Meta";
import { logger } from "../../utils/logger.js";
import { SignalRegistry } from "../../utils/signal-registry.js";

declare const global: {
    display: Meta.Display;
};

export class FocusTracker {
    private signals = new SignalRegistry();

    constructor(private onFocusChange: () => void) {}

    enable() {
        try {
            const focusHandler = global.display.connect(
                "notify::focus-window",
                (_display: Meta.Display, _window: Meta.Window) => {
                    this.onFocusChange();
                },
            );
            this.signals.add(() => global.display.disconnect(focusHandler));
            logger.info("FocusTracker: Focus tracking enabled");
        } catch (error) {
            logger.error("FocusTracker: Error enabling focus tracking", error);
            throw error;
        }
    }

    disable() {
        this.signals.disconnectAll();
        logger.info("FocusTracker: Focus tracking disabled");
    }
}
