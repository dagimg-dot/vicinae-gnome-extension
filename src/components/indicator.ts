import St from "gi://St";
import type { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import { Icons } from "../lib/icons.js";
import { debug } from "../utils/logger.js";

export class VicinaeIndicator {
    private indicator: PanelMenu.Button;
    private extension: Extension;

    constructor(extension: Extension) {
        this.extension = extension;
        this.indicator = new PanelMenu.Button(0, "Vicinae Gnome Extension");
        this.setupUI();
        this.setupMenu();
    }

    private setupUI() {
        new Icons(this.extension.path);

        const vicinaeIcon = Icons.get("vicinae");

        const icon = new St.Icon({
            gicon: vicinaeIcon,
            style_class: "system-status-icon",
        });

        this.indicator.add_child(icon);
    }

    private setupMenu() {
        const settingsItem = new PopupMenu.PopupMenuItem("Settings");
        settingsItem.connect("activate", () => {
            debug("Opening Vicinae settings");
            this.extension.openPreferences();
        });

        if (this.indicator.menu && "addMenuItem" in this.indicator.menu) {
            this.indicator.menu.addMenuItem(settingsItem);
        }
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
