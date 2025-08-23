import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { VicinaeIndicator } from "./components/indicator.js";
import { DBusManager } from "./core/dbus/manager.js";
import { logger } from "./utils/logger.js";

export default class Vicinae extends Extension {
    private indicator!: VicinaeIndicator | null;
    private dbusManager!: DBusManager | null;

    enable() {
        logger("Vicinae extension enabled");

        try {
            // Initialize D-Bus services
            this.dbusManager = new DBusManager();
            this.dbusManager.exportServices();

            // Initialize UI indicator
            this.indicator = new VicinaeIndicator();
            Main.panel.addToStatusArea(
                "vicinae-gnome-extension",
                this.indicator.getButton(),
                0,
                "center",
            );

            logger("Vicinae extension initialized successfully");
        } catch (error) {
            logger("Failed to initialize Vicinae extension", error);
            throw error;
        }
    }

    disable() {
        logger("Vicinae extension disabled");

        try {
            // Clean up UI
            if (this.indicator) {
                this.indicator.destroy();
                this.indicator = null;
            }

            // Clean up D-Bus services
            if (this.dbusManager) {
                this.dbusManager.unexportServices();
                this.dbusManager = null;
            }

            logger("Vicinae extension cleaned up successfully");
        } catch (error) {
            logger("Error during extension cleanup", error);
        }
    }
}
