import Clutter from "gi://Clutter";
import type Meta from "gi://Meta";
import { logger } from "../../utils/logger.js";

declare const global: {
    stage: Clutter.Stage;
    get_pointer: () => [number, number];
    get_window_actors: () => Meta.WindowActor[];
};

export class ClickHandler {
    private buttonPressHandler?: number;

    constructor(
        private appClass: string,
        private onClickOutside: () => void,
    ) {}

    enable() {
        try {
            this.buttonPressHandler = global.stage.connect(
                "captured-event",
                (_stage: Clutter.Stage, event: Clutter.Event) => {
                    if (event.type() === Clutter.EventType.BUTTON_PRESS) {
                        this.handleClick();
                    }
                    return Clutter.EVENT_PROPAGATE;
                },
            );
            logger.info("ClickHandler: Click tracking enabled");
        } catch (error) {
            logger.error("ClickHandler: Error enabling click tracking", error);
            throw error;
        }
    }

    disable() {
        if (this.buttonPressHandler) {
            global.stage.disconnect(this.buttonPressHandler);
            this.buttonPressHandler = undefined;
        }
        logger.info("ClickHandler: Click tracking disabled");
    }

    private handleClick() {
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
        const isOurWindow = clickedWindow
            ?.get_wm_class()
            ?.toLowerCase()
            .includes(this.appClass.toLowerCase());

        if (!clickedWindow || !isOurWindow) {
            this.onClickOutside();
        }
    }
}
