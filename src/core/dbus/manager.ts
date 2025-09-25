import type Gio from "gi://Gio";
import type { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import {
    createDBusService,
    exportDBusService,
    unexportDBusService,
} from "../../utils/dbus-utils.js";
import { error, info } from "../../utils/logger.js";
import type { VicinaeClipboardManager } from "../clipboard/clipboard-manager.js";
import { CLIPBOARD_DBUS_IFACE } from "./interfaces/clipboard.js";
import { WINDOWS_DBUS_IFACE } from "./interfaces/windows.js";
import { ClipboardService } from "./services/clipboard-service.js";
import { WindowsService } from "./services/windows-service.js";

export class DBusManager {
    private clipboardService!: Gio.DBusExportedObject;
    private windowsService!: Gio.DBusExportedObject;
    private clipboardServiceInstance!: ClipboardService;
    private windowsServiceInstance!: WindowsService;

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
            // biome-ignore lint/suspicious/noExplicitAny: we need to cast the instance to any to avoid type errors
            this.clipboardServiceInstance as any,
        );
        this.windowsService = createDBusService(
            WINDOWS_DBUS_IFACE,
            // biome-ignore lint/suspicious/noExplicitAny: we need to cast the instance to any to avoid type errors
            this.windowsServiceInstance as any,
        );

        // Set the D-Bus object on the services so they can emit signals
        this.clipboardServiceInstance.setDBusObject(this.clipboardService);
        this.windowsServiceInstance.setDBusObject(this.windowsService);
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

            info("D-Bus services exported successfully");
        } catch (_error) {
            error("Failed to export D-Bus services", _error);
            throw error;
        }
    }

    unexportServices(): void {
        try {
            // Clean up services
            this.clipboardServiceInstance.destroy();
            this.windowsServiceInstance.destroy();

            unexportDBusService(this.clipboardService);
            unexportDBusService(this.windowsService);

            info("D-Bus services unexported successfully");
        } catch (_error) {
            error("Failed to unexport D-Bus services", _error);
            throw _error;
        }
    }

    getClipboardService(): ClipboardService {
        return this.clipboardServiceInstance;
    }

    getWindowsService(): WindowsService {
        return this.windowsServiceInstance;
    }
}
