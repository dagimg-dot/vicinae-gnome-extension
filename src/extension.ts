import type Gio from "gi://Gio";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { VicinaeIndicator } from "./components/indicator.js";
import { VicinaeClipboardManager } from "./core/clipboard/clipboard-manager.js";
import { DBusManager } from "./core/dbus/manager.js";
import { LauncherManager } from "./core/launcher/launcher-manager.js";
import { Icons } from "./lib/icons.js";
import {
    deinitializeLogger,
    initializeLogger,
    logger,
} from "./utils/logger.js";

export default class Vicinae extends Extension {
    private indicator: VicinaeIndicator | null = null;
    private dbusManager: DBusManager | null = null;
    private clipboardManager: VicinaeClipboardManager | null = null;
    private launcherManager: LauncherManager | null = null;
    private settings: Gio.Settings | null = null;

    async enable() {
        logger.info("Vicinae extension enabled");

        this.settings = this.getSettings();
        initializeLogger(this.settings);

        this.clipboardManager = new VicinaeClipboardManager();
        this.clipboardManager.setSettings(this.settings);
        if (this.settings.get_boolean("enable-clipboard-monitoring")) {
            this.clipboardManager.enable();
        }

        const appClass =
            this.settings.get_string("launcher-app-class") || "vicinae";

        this.dbusManager = new DBusManager(appClass, this.clipboardManager);
        this.dbusManager.exportServices();

        this.indicator = VicinaeIndicator.createOrUpdate(
            this.settings,
            this,
            null,
        );

        logger.debug("Extension: Initializing launcher manager...");
        this.launcherManager = await LauncherManager.create(
            this.settings,
            this.dbusManager.getWindowsService(),
        );

        this.settings.connectObject(
            "changed::show-status-indicator",
            () => {
                if (!this.settings) return;
                this.indicator = VicinaeIndicator.createOrUpdate(
                    this.settings,
                    this,
                    this.indicator,
                );
            },
            "changed::launcher-auto-close-focus-loss",
            () => {
                if (
                    !this.settings ||
                    !this.clipboardManager ||
                    !this.dbusManager
                )
                    return;
                LauncherManager.updateOrDestroy(
                    this.settings,
                    this.dbusManager.getWindowsService(),
                    this.launcherManager,
                ).then((mgr) => {
                    this.launcherManager = mgr;
                });
            },
            "changed::blocked-applications",
            () => {
                if (this.clipboardManager && this.settings) {
                    this.clipboardManager.updateSettings(this.settings);
                    logger.debug(
                        "Updated clipboard manager with new blocked applications list",
                    );
                }
            },
            "changed::enable-clipboard-monitoring",
            () => {
                if (this.clipboardManager && this.settings) {
                    if (
                        this.settings.get_boolean("enable-clipboard-monitoring")
                    ) {
                        this.clipboardManager.enable();
                    } else {
                        this.clipboardManager.disable();
                    }
                }
            },
            this,
        );

        logger.info("Vicinae extension initialized successfully");
    }

    disable() {
        logger.info("Vicinae extension disabled");

        this.settings?.disconnectObject(this);
        this.launcherManager?.disable();
        this.launcherManager = null;

        this.indicator?.destroy();
        this.indicator = null;

        this.dbusManager?.unexportServices();
        this.dbusManager = null;

        this.clipboardManager?.destroy();
        this.clipboardManager = null;

        if (this.settings) {
            deinitializeLogger(this.settings);
        }
        this.settings = null;

        Icons.clear();

        logger.info("Vicinae extension cleaned up successfully");
    }
}
