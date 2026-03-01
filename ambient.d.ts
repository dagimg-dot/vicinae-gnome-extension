import "@girs/gjs";
import "@girs/gjs/dom";
import "@girs/gnome-shell/ambient";
import "@girs/gnome-shell/extensions/global";

declare global {
    /** Build-injected env suffix (e.g. "-dev") when .env has ENV=<name>. Empty in production. */
    const __VICINAE_ENV_SUFFIX__: string;
}
