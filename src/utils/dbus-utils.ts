import Gio from "gi://Gio";

// Define a proper interface for D-Bus service objects
export interface DBusServiceObject {
    [key: string]: (...args: unknown[]) => unknown;
}

export const createDBusService = (
    interfaceDefinition: string,
    serviceObject: DBusServiceObject,
) => {
    try {
        const dbus = Gio.DBusExportedObject.wrapJSObject(
            interfaceDefinition,
            serviceObject,
        );
        return dbus;
    } catch (error) {
        throw new Error(`Failed to create D-Bus service: ${error}`);
    }
};

export const exportDBusService = (
    dbus: Gio.DBusExportedObject,
    path: string,
) => {
    try {
        dbus.export(Gio.DBus.session, path);
        return true;
    } catch (error) {
        throw new Error(`Failed to export D-Bus service at ${path}: ${error}`);
    }
};

export const unexportDBusService = (dbus: Gio.DBusExportedObject) => {
    try {
        dbus.flush();
        dbus.unexport();
        return true;
    } catch (error) {
        throw new Error(`Failed to unexport D-Bus service: ${error}`);
    }
};
