import Clutter from "gi://Clutter";
// import GLib from "gi://GLib";
import St from "gi://St";
import Kenat from "kenat";

const Mainloop = imports.mainloop;

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import { logger } from "./utils/logger.js";

// const getCurrentDateAndTime = () => {
//     const now = GLib.DateTime.new_now_local();
//     const date = now.format("%b %d");
//     const time = now.format("%H:%M");

//     return { date, time };
// };

export default class gnomext extends Extension {
    #indicator: PanelMenu.Button | undefined;
    timeout = 1.0;

    enable() {
        logger("enabled");

        this.#indicator = new PanelMenu.Button(0, "Ethiopian Calendar");

        const label = new St.Label({
            y_align: Clutter.ActorAlign.CENTER,
        });

        this.#indicator.add_child(label);

        this.#indicator.connect("button-press-event", () => {
            logger("Hello gnomext");
            return Clutter.EVENT_STOP;
        });

        const ethDate = new Kenat();

        Mainloop.timeout_add_seconds(this.timeout, () => {
            // const { date, time } = getCurrentDateAndTime();
            label.text = ethDate.formatWithWeekday("amharic", true);
            return true;
        });

        Main.panel.addToStatusArea(
            "ethiopian-calendar",
            this.#indicator,
            0,
            "center",
        );
    }

    disable() {
        if (!this.#indicator) return;

        this.#indicator.destroy();
        this.#indicator = undefined;
        Mainloop.source_remove(this.timeout);
    }
}
