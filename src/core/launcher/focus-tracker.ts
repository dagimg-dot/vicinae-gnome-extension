import GLib from "gi://GLib";
import type Meta from "gi://Meta";
import { logger } from "../../utils/logger.js";
import { SignalRegistry } from "../../utils/signal-registry.js";

declare const global: {
    display: Meta.Display;
};

export class FocusTracker {
    private signals = new SignalRegistry();
    private focusIdleId: number = 0;

    constructor(private onFocusChange: () => void) {}

    enable() {
        try {
            const focusHandler = global.display.connect(
                "notify::focus-window",
                () => {
                    if (this.focusIdleId) {
                        GLib.source_remove(this.focusIdleId);
                    }

                    this.focusIdleId = GLib.idle_add(
                        GLib.PRIORITY_DEFAULT_IDLE,
                        () => {
                            this.focusIdleId = 0;
                            try {
                                this.onFocusChange();
                            } catch (error) {
                                logger.error(
                                    "FocusTracker: Error in focus change handler",
                                    error,
                                );
                            }
                            return GLib.SOURCE_REMOVE;
                        },
                    );
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
        if (this.focusIdleId) {
            GLib.source_remove(this.focusIdleId);
            this.focusIdleId = 0;
        }
        this.signals.disconnectAll();
        logger.info("FocusTracker: Focus tracking disabled");
    }
}
