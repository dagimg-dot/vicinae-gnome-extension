import Clutter from "gi://Clutter";
import type Gio from "gi://Gio";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { VicinaeIndicator } from "./components/indicator.js";
import { VicinaeClipboardManager } from "./core/clipboard/clipboard-manager.js";
import { DBusManager } from "./core/dbus/manager.js";
import { LauncherManager } from "./core/launcher/launcher-manager.js";
import {
    deinitializeLogger,
    initializeLogger,
    logger,
} from "./utils/logger.js";

// Create VirtualKeyboard in extension context
const getVirtualKeyboard = (() => {
    let virtualKeyboard: Clutter.VirtualInputDevice;
    return () => {
        if (!virtualKeyboard) {
            virtualKeyboard = Clutter.get_default_backend()
                .get_default_seat()
                .create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
        }
        return virtualKeyboard;
    };
})();

export default class Vicinae extends Extension {
    private indicator: VicinaeIndicator | null = null;
    private dbusManager: DBusManager | null = null;
    private clipboardManager: VicinaeClipboardManager | null = null;
    private launcherManager: LauncherManager | null = null;
    private settings: Gio.Settings | null = null;
    private settingsConnection: number = 0;
    private launcherSettingsConnection: number = 0;
    private blockedAppsConnection: number = 0;

    async enable() {
        logger.info("Vicinae extension enabled");

        this.settings = this.getSettings();
        initializeLogger(this.settings);

        this.clipboardManager = new VicinaeClipboardManager(
            getVirtualKeyboard(),
        );
        this.clipboardManager.enable();
        this.clipboardManager.setSettings(this.settings);

        const appClass =
            this.settings.get_string("launcher-app-class") || "vicinae";

        this.dbusManager = new DBusManager(
            appClass,
            this,
            this.clipboardManager,
        );
        this.dbusManager.exportServices();

        this.indicator = VicinaeIndicator.createOrUpdate(
            this.settings,
            this,
            null,
        );

        logger.debug("Extension: Initializing launcher manager...");
        this.launcherManager = await LauncherManager.create(
            this.settings,
            this.clipboardManager,
            this.dbusManager.getWindowsService(),
        );

        this.settingsConnection = this.settings.connect(
            "changed::show-status-indicator",
            () => {
                if (!this.settings) return;
                this.indicator = VicinaeIndicator.createOrUpdate(
                    this.settings,
                    this,
                    this.indicator,
                );
            },
        );

        this.launcherSettingsConnection = this.settings.connect(
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
                    this.clipboardManager,
                    this.dbusManager.getWindowsService(),
                    this.launcherManager,
                ).then((mgr) => {
                    this.launcherManager = mgr;
                });
            },
        );

        this.blockedAppsConnection = this.settings.connect(
            "changed::blocked-applications",
            () => {
                if (this.clipboardManager && this.settings) {
                    this.clipboardManager.updateSettings(this.settings);
                    logger.debug(
                        "Updated clipboard manager with new blocked applications list",
                    );
                }
            },
        );

        logger.info("Vicinae extension initialized successfully");
    }

    disable() {
        logger.info("Vicinae extension disabled");

        if (this.settingsConnection) {
            this.settings?.disconnect(this.settingsConnection);
            this.settingsConnection = 0;
        }

        if (this.launcherSettingsConnection) {
            this.settings?.disconnect(this.launcherSettingsConnection);
            this.launcherSettingsConnection = 0;
        }

        if (this.blockedAppsConnection) {
            this.settings?.disconnect(this.blockedAppsConnection);
            this.blockedAppsConnection = 0;
        }

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

        logger.info("Vicinae extension cleaned up successfully");
    }
}
