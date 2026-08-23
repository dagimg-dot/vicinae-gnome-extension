import Adw from "gi://Adw";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk";

/**
 * Action row for editing a blocked-application window class in preferences.
 */
export const BlockedAppRow = GObject.registerClass(
    {
        GTypeName: "BlockedAppRow",
        Properties: {
            "window-class": GObject.ParamSpec.string(
                "window-class",
                "Window Class",
                "The window class of the blocked application",
                GObject.ParamFlags.READWRITE,
                "",
            ),
        },
        Signals: {
            "delete-requested": {},
            "save-requested": {},
            "input-changed": {},
        },
    },
    class BlockedAppRow extends Adw.EntryRow {
        private windowClass: string = "";
        private originalWindowClass: string = "";

        private deleteButton: Gtk.Button;

        constructor() {
            super();

            this.set_title("Window Class");
            this.set_show_apply_button(true);

            this.deleteButton = new Gtk.Button({
                icon_name: "user-trash-symbolic",
                valign: Gtk.Align.CENTER,
                tooltip_text: "Remove",
                css_classes: ["flat"],
            });

            this.add_suffix(this.deleteButton);

            this.deleteButton.connect("clicked", () => {
                this.emit("delete-requested");
            });

            this.connect("changed", () => {
                this.emit("input-changed");
            });

            this.connect("apply", () => {
                this.saveChanges();
            });
        }

        focusInput() {
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this.grab_focus();
                return GLib.SOURCE_REMOVE;
            });
        }

        setWindowClass(windowClass: string) {
            this.windowClass = windowClass;
            this.originalWindowClass = windowClass;
            this.set_text(windowClass);
        }

        getWindowClass(): string {
            return this.windowClass;
        }

        getInputValue(): string {
            return this.get_text().trim();
        }

        getCurrentWindowClass(): string {
            return this.getInputValue() || this.windowClass;
        }

        getOriginalWindowClass(): string {
            return this.originalWindowClass;
        }

        isEmpty(): boolean {
            return this.getInputValue() === "";
        }

        private saveChanges() {
            const oldValue = this.windowClass;
            const newValue = this.getInputValue();

            if (newValue !== oldValue) {
                this.originalWindowClass = oldValue;
                this.windowClass = newValue;
                this.emit("save-requested");
            }

            const root = this.get_root();
            if (root) {
                root.set_focus(null);
            }
        }
    },
);

export type BlockedAppRowInstance = InstanceType<typeof BlockedAppRow>;
