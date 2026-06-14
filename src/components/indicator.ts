import type Gio from "gi://Gio";
import St from "gi://St";
import type { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import { Icons } from "../lib/icons.js";
import { logger } from "../utils/logger.js";

export class VicinaeIndicator {
    private indicator: PanelMenu.Button | null;
    private extension: Extension;

    constructor(extension: Extension) {
        this.extension = extension;
        this.indicator = new PanelMenu.Button(0, "Vicinae Gnome Extension");
        this.setupUI();
        this.setupMenu();
    }

    static createOrUpdate(
        settings: Gio.Settings,
        extension: Extension,
        current: VicinaeIndicator | null,
    ): VicinaeIndicator | null {
        const shouldShow = settings.get_boolean("show-status-indicator");

        if (shouldShow && !current) {
            const indicator = new VicinaeIndicator(extension);
            Main.panel.addToStatusArea(
                "vicinae-gnome-extension",
                indicator.getButton(),
                0,
                "right",
            );
            logger.debug("Vicinae indicator shown");
            return indicator;
        }

        if (!shouldShow && current) {
            current.destroy();
            logger.debug("Vicinae indicator hidden");
            return null;
        }

        return current;
    }

    private setupUI() {
        Icons.load(this.extension.path);

        const vicinaeIcon = Icons.get("vicinae");

        const icon = new St.Icon({
            gicon: vicinaeIcon,
            style_class: "system-status-icon",
        });

        this.indicator?.add_child(icon);
    }

    private setupMenu() {
        const settingsItem = new PopupMenu.PopupMenuItem("Settings");
        settingsItem.connect("activate", () => {
            logger.debug("Opening Vicinae settings");
            this.extension.openPreferences();
        });

        const menu = this.indicator?.menu;
        if (menu && "addMenuItem" in menu) {
            menu.addMenuItem(settingsItem);
        }
    }

    getButton(): PanelMenu.Button {
        // biome-ignore lint/style/noNonNullAssertion: called from createOrUpdate right after construction
        return this.indicator!;
    }

    destroy() {
        if (this.indicator) {
            this.indicator.destroy();
            this.indicator = null;
        }
        Icons.clear();
    }
}
