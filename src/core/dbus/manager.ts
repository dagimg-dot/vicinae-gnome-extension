import type Gio from "gi://Gio";
import type { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import {
    createDBusService,
    exportDBusService,
    unexportDBusService,
} from "../../utils/dbus-utils.js";
import { logger } from "../../utils/logger.js";
import type { VicinaeClipboardManager } from "../clipboard/clipboard-manager.js";
import { CLIPBOARD_DBUS_IFACE } from "./interfaces/clipboard.js";
import { WINDOWS_DBUS_IFACE } from "./interfaces/windows.js";
import { ClipboardService } from "./services/clipboard-service.js";
import { WindowsService } from "./services/windows-service.js";

export class DBusManager {
    private clipboardService: Gio.DBusExportedObject;
    private windowsService: Gio.DBusExportedObject;
    private clipboardServiceInstance: ClipboardService;
    private windowsServiceInstance: WindowsService;

    constructor(
        extension?: Extension,
        clipboardManager?: VicinaeClipboardManager,
    ) {
        if (!clipboardManager) {
            throw new Error(
                "ClipboardManager instance is required for DBusManager",
            );
        }

        this.clipboardServiceInstance = new ClipboardService(
            clipboardManager,
            extension,
        );
        this.windowsServiceInstance = new WindowsService();

        this.clipboardService = createDBusService(
            CLIPBOARD_DBUS_IFACE,
            this.clipboardServiceInstance,
        );
        this.windowsService = createDBusService(
            WINDOWS_DBUS_IFACE,
            this.windowsServiceInstance,
        );

        // Set the D-Bus object on the clipboard service so it can emit signals
        this.clipboardServiceInstance.setDBusObject(this.clipboardService);
    }

    exportServices(): void {
        try {
            exportDBusService(
                this.clipboardService,
                "/org/gnome/Shell/Extensions/Clipboard",
            );
            exportDBusService(
                this.windowsService,
                "/org/gnome/Shell/Extensions/Windows",
            );

            logger("D-Bus services exported successfully");
        } catch (error) {
            logger("Failed to export D-Bus services", error);
            throw error;
        }
    }

    unexportServices(): void {
        try {
            // Clean up clipboard service
            this.clipboardServiceInstance.destroy();

            unexportDBusService(this.clipboardService);
            unexportDBusService(this.windowsService);

            logger("D-Bus services unexported successfully");
        } catch (error) {
            logger("Failed to unexport D-Bus services", error);
            throw error;
        }
    }

    getClipboardService(): ClipboardService {
        return this.clipboardServiceInstance;
    }

    getWindowsService(): WindowsService {
        return this.windowsServiceInstance;
    }
}
