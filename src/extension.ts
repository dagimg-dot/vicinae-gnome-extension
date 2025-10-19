import Clutter from "gi://Clutter";
import type Gio from "gi://Gio";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { VicinaeIndicator } from "./components/indicator.js";
import { VicinaeClipboardManager } from "./core/clipboard/clipboard-manager.js";
import { DBusManager } from "./core/dbus/manager.js";
import { LauncherManager } from "./core/launcher/launcher-manager.js";
import { initializeLogger, logger } from "./utils/logger.js";

// Create VirtualKeyboard in extension context (similar to gnome-clipboard-history)
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
    private indicator!: VicinaeIndicator | null;
    private dbusManager!: DBusManager | null;
    private clipboardManager!: VicinaeClipboardManager | null;
    private launcherManager!: LauncherManager | null;
    private settings!: Gio.Settings | null;
    private settingsConnection!: number;
    private launcherSettingsConnection!: number;

    async enable() {
        logger.info("Vicinae extension enabled");

        try {
            // Initialize settings
            this.settings = this.getSettings();

            // Initialize logger with settings
            initializeLogger(this.settings);

            // Initialize clipboard manager with settings and VirtualKeyboard
            this.clipboardManager = new VicinaeClipboardManager(
                getVirtualKeyboard(),
            );
            this.clipboardManager.setSettings(this.settings);

            // Initialize D-Bus services with extension reference and clipboard manager
            this.dbusManager = new DBusManager(this, this.clipboardManager);
            this.dbusManager.exportServices();

            // Initialize launcher manager
            logger.debug("Extension: Initializing launcher manager...");
            await this.initializeLauncherManager();

            // Initialize UI indicator if enabled
            this.updateIndicatorVisibility();

            // Listen for settings changes
            this.settingsConnection = this.settings.connect(
                "changed::show-status-indicator",
                () => {
                    this.updateIndicatorVisibility();
                },
            );

            // Listen for launcher auto-close settings changes
            this.launcherSettingsConnection = this.settings.connect(
                "changed::launcher-auto-close-focus-loss",
                () => {
                    this.updateLauncherManager();
                },
            );

            // Listen for blocked applications changes
            this.settings.connect("changed::blocked-applications", () => {
                if (this.clipboardManager && this.settings) {
                    this.clipboardManager.updateSettings(this.settings);
                    logger.debug(
                        "Updated clipboard manager with new blocked applications list",
                    );
                }
            });

            logger.info("Vicinae extension initialized successfully");
        } catch (error) {
            logger.error(
                "Failed to initialize Vicinae extension",
                error as Error,
            );
            throw error;
        }
    }

    private updateIndicatorVisibility() {
        const shouldShow = this.settings?.get_boolean("show-status-indicator");

        if (shouldShow && !this.indicator) {
            // Create and show indicator
            this.indicator = new VicinaeIndicator(this);
            Main.panel.addToStatusArea(
                "vicinae-gnome-extension",
                this.indicator.getButton(),
                0,
                "right",
            );
            logger.debug("Vicinae indicator shown");
        } else if (!shouldShow && this.indicator) {
            // Hide and destroy indicator
            this.indicator.destroy();
            this.indicator = null;
            logger.debug("Vicinae indicator hidden");
        }
    }

    private async initializeLauncherManager() {
        if (!this.settings) return;

        const autoClose = this.settings.get_boolean(
            "launcher-auto-close-focus-loss",
        );
        const appClass =
            this.settings.get_string("launcher-app-class") || "vicinae";

        if (autoClose) {
            if (!this.clipboardManager) {
                throw new Error("Clipboard manager is not initialized");
            }

            this.launcherManager = new LauncherManager(
                {
                    appClass: appClass,
                    autoCloseOnFocusLoss: autoClose,
                },
                this.clipboardManager,
            );

            await this.launcherManager.enable();
            logger.info("Launcher manager initialized and enabled");
        }
    }

    private async updateLauncherManager() {
        if (!this.settings) return;

        const autoClose = this.settings.get_boolean(
            "launcher-auto-close-focus-loss",
        );

        if (autoClose && !this.launcherManager) {
            // Enable launcher manager
            await this.initializeLauncherManager();
        } else if (!autoClose && this.launcherManager) {
            // Disable launcher manager
            this.launcherManager.disable();
            this.launcherManager = null;
            logger.debug("Launcher manager disabled");
        } else if (autoClose && this.launcherManager) {
            // Update existing launcher manager configuration
            const appClass =
                this.settings.get_string("launcher-app-class") || "vicinae";

            // Log the actual app class being used
            logger.debug(
                "initializeShellIntegrationManager: Using app class",
                appClass,
            );

            this.launcherManager.updateConfig({
                appClass: appClass,
                autoCloseOnFocusLoss: autoClose,
            });
        }
    }

    disable() {
        logger.info("Vicinae extension disabled");

        try {
            // Disconnect settings listeners
            if (this.settingsConnection) {
                this.settings?.disconnect(this.settingsConnection);
                this.settingsConnection = 0;
            }

            if (this.launcherSettingsConnection) {
                this.settings?.disconnect(this.launcherSettingsConnection);
                this.launcherSettingsConnection = 0;
            }

            // Clean up launcher manager
            if (this.launcherManager) {
                this.launcherManager.disable();
                this.launcherManager = null;
            }

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

            // Clean up clipboard manager
            if (this.clipboardManager) {
                this.clipboardManager.destroy();
                this.clipboardManager = null;
            }

            // Clean up settings
            this.settings = null;

            logger.info("Vicinae extension cleaned up successfully");
        } catch (error) {
            logger.error("Error during extension cleanup", error);
        }
    }
}
