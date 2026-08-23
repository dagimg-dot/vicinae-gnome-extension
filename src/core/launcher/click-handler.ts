import Clutter from "gi://Clutter";
import type Meta from "gi://Meta";
import { logger } from "../../utils/logger.js";
import { SignalRegistry } from "../../utils/signal-registry.js";
import { isTargetWindow } from "../../utils/window-utils.js";

declare const global: {
    stage: Clutter.Stage;
    get_pointer: () => [number, number];
    get_window_actors: () => Meta.WindowActor[];
};

export class ClickHandler {
    private signals = new SignalRegistry();

    constructor(
        private appClass: string,
        private onClickOutside: () => void,
    ) {}

    enable() {
        try {
            const buttonPressHandler = global.stage.connect(
                "captured-event",
                (_stage: Clutter.Stage, event: Clutter.Event) => {
                    if (event.type() === Clutter.EventType.BUTTON_PRESS) {
                        this.handleClick();
                    }
                    return Clutter.EVENT_PROPAGATE;
                },
            );
            this.signals.add(() => global.stage.disconnect(buttonPressHandler));
            logger.info("ClickHandler: Click tracking enabled");
        } catch (error) {
            logger.error("ClickHandler: Error enabling click tracking", error);
            throw error;
        }
    }

    disable() {
        this.signals.disconnectAll();
        logger.info("ClickHandler: Click tracking disabled");
    }

    private handleClick() {
        try {
            const [x, y] = global.get_pointer();
            const windows = global.get_window_actors();
            const window = windows.find((actor: Meta.WindowActor) => {
                const win = actor.meta_window;
                if (!win) return false;

                const rect = win.get_frame_rect();
                return (
                    x >= rect.x &&
                    x <= rect.x + rect.width &&
                    y >= rect.y &&
                    y <= rect.y + rect.height
                );
            });

            const clickedWindow = window?.meta_window;
            const isLauncher = isTargetWindow(clickedWindow, this.appClass);

            if (!clickedWindow || !isLauncher) {
                this.onClickOutside();
            }
        } catch (error) {
            logger.error("ClickHandler: Error handling click", error);
        }
    }
}
