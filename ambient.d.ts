import "@girs/gjs";
import "@girs/gjs/dom";
import "@girs/gnome-shell/ambient";
import "@girs/gnome-shell/extensions/global";

declare global {
    /** Build-injected env suffix (e.g. "-dev") when .env has ENV=<name>. Empty in production. */
    const __VICINAE_ENV_SUFFIX__: string;
}

declare module "@girs/gobject-2.0" {
    namespace GObject {
        interface Object {
            connectObject(...args: unknown[]): void;
            disconnectObject(...args: unknown[]): void;
        }
    }
}
