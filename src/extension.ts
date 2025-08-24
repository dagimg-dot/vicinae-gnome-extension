import type Gio from "gi://Gio";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { VicinaeIndicator } from "./components/indicator.js";
import { VicinaeClipboardManager } from "./core/clipboard/clipboard-manager.js";
import { DBusManager } from "./core/dbus/manager.js";
import { LauncherManager } from "./core/windows/launcher-manager.js";
import { logger } from "./utils/logger.js";

export default class Vicinae extends Extension {
    private indicator!: VicinaeIndicator | null;
    private dbusManager!: DBusManager | null;
    private clipboardManager!: VicinaeClipboardManager | null;
    private launcherManager!: LauncherManager | null;
    private settings!: Gio.Settings | null;
    private settingsConnection!: number;
    private launcherSettingsConnection!: number;

    enable() {
        logger("Vicinae extension enabled");

        try {
            // Initialize settings
            this.settings = this.getSettings();

            // Initialize clipboard manager with settings
            this.clipboardManager = new VicinaeClipboardManager();
            this.clipboardManager.setSettings(this.settings);

            // Initialize D-Bus services with extension reference and clipboard manager
            this.dbusManager = new DBusManager(this, this.clipboardManager);
            this.dbusManager.exportServices();

            // Initialize launcher manager
            logger("Extension: Initializing launcher manager...");
            this.initializeLauncherManager();

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
                    logger(
                        "Updated clipboard manager with new blocked applications list",
                    );
                }
            });

            logger("Vicinae extension initialized successfully");
        } catch (error) {
            logger("Failed to initialize Vicinae extension", error);
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
            logger("Vicinae indicator shown");
        } else if (!shouldShow && this.indicator) {
            // Hide and destroy indicator
            this.indicator.destroy();
            this.indicator = null;
            logger("Vicinae indicator hidden");
        }
    }

    private initializeLauncherManager() {
        if (!this.settings) return;

        const autoClose = this.settings.get_boolean(
            "launcher-auto-close-focus-loss",
        );
        const appClass =
            this.settings.get_string("launcher-app-class") || "vicinae";

        if (autoClose) {
            this.launcherManager = new LauncherManager({
                appClass: appClass,
                autoCloseOnFocusLoss: autoClose,
            });
            this.launcherManager.enable();
            logger("Launcher manager initialized and enabled");
        }
    }

    private updateLauncherManager() {
        if (!this.settings) return;

        const autoClose = this.settings.get_boolean(
            "launcher-auto-close-focus-loss",
        );

        if (autoClose && !this.launcherManager) {
            // Enable launcher manager
            this.initializeLauncherManager();
        } else if (!autoClose && this.launcherManager) {
            // Disable launcher manager
            this.launcherManager.disable();
            this.launcherManager = null;
            logger("Launcher manager disabled");
        } else if (autoClose && this.launcherManager) {
            // Update existing launcher manager configuration
            const appClass =
                this.settings.get_string("launcher-app-class") || "vicinae";

            // Log the actual app class being used
            logger(
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
        logger("Vicinae extension disabled");

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

            logger("Vicinae extension cleaned up successfully");
        } catch (error) {
            logger("Error during extension cleanup", error);
        }
    }
}
