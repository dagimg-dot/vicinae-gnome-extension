import Clutter from "gi://Clutter";
import St from "gi://St";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import { logger } from "../utils/logger.js";

export class VicinaeIndicator {
    private indicator: PanelMenu.Button;

    constructor() {
        this.indicator = new PanelMenu.Button(0, "Vicinae Gnome Extension");
        this.setupUI();
    }

    private setupUI() {
        const label = new St.Label({
            y_align: Clutter.ActorAlign.CENTER,
        });

        label.text = "Vicinae";

        this.indicator.add_child(label);

        this.indicator.connect("button-press-event", () => {
            logger("Vicinae indicator clicked");
            return Clutter.EVENT_STOP;
        });
    }

    getButton(): PanelMenu.Button {
        return this.indicator;
    }

    destroy() {
        if (this.indicator) {
            this.indicator.destroy();
        }
    }
}
