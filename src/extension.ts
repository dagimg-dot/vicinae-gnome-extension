import Clutter from "gi://Clutter";
import St from "gi://St";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import { logger } from "./utils/logger.js";

export default class Vicinae extends Extension {
    #indicator: PanelMenu.Button | undefined;

    enable() {
        logger("enabled");

        this.#indicator = new PanelMenu.Button(0, "Vicinae Gnome Extension");

        const label = new St.Label({
            y_align: Clutter.ActorAlign.CENTER,
        });

        label.text = "Vicinae";

        this.#indicator.add_child(label);

        this.#indicator.connect("button-press-event", () => {
            logger("Hello vicinae-gnome-extension");
            return Clutter.EVENT_STOP;
        });

        Main.panel.addToStatusArea(
            "vicinae-gnome-extension",
            this.#indicator,
            0,
            "center",
        );
    }

    disable() {
        if (!this.#indicator) return;

        this.#indicator.destroy();
        this.#indicator = undefined;
    }
}
