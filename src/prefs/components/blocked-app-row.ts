import Adw from "gi://Adw";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk";

/**
 * Expandable row for editing a blocked-application window class in preferences.
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
    class BlockedAppRow extends Adw.ExpanderRow {
        private windowClass: string = "";
        private inputValue: string = "";
        private originalWindowClass: string = "";
        private windowEntry: Adw.EntryRow;
        private checkButton: Gtk.Button;
        private deleteButton: Gtk.Button;

        constructor() {
            super();

            this.set_title("Expand this row to enter window class");
            this.set_subtitle("");

            this.windowEntry = new Adw.EntryRow({
                title: "Window Class",
                text: "",
            });

            this.checkButton = new Gtk.Button({
                icon_name: "object-select-symbolic",
                valign: Gtk.Align.CENTER,
                tooltip_text: "Save and close",
                css_classes: ["flat", "suggested-action"],
            });

            this.deleteButton = new Gtk.Button({
                icon_name: "user-trash-symbolic",
                valign: Gtk.Align.CENTER,
                tooltip_text: "Remove",
                css_classes: ["flat"],
            });

            this.add_suffix(this.checkButton);
            this.add_suffix(this.deleteButton);
            this.add_row(this.windowEntry);

            this.checkButton.visible = false;

            this.checkButton.connect("clicked", () => {
                this.saveChanges();
            });

            this.deleteButton.connect("clicked", () => {
                this.emit("delete-requested");
            });

            this.windowEntry.connect("changed", () => {
                this.inputValue = this.windowEntry.get_text().trim();
                this.updateCheckButtonState();
                this.emit("input-changed");
            });

            this.connect("notify::expanded", () => {
                this.updateButtonVisibility();
            });
        }

        setWindowClass(windowClass: string) {
            this.windowClass = windowClass;
            this.inputValue = windowClass;
            this.originalWindowClass = windowClass;
            this.windowEntry.set_text(windowClass);
            this.updateDisplay();
            this.updateCheckButtonState();
        }

        getWindowClass(): string {
            return this.windowClass;
        }

        getInputValue(): string {
            return this.inputValue;
        }

        getCurrentWindowClass(): string {
            return this.inputValue.trim() || this.windowClass;
        }

        getOriginalWindowClass(): string {
            return this.originalWindowClass;
        }

        isEmpty(): boolean {
            return this.inputValue.trim() === "";
        }

        closeExpanded() {
            this.set_expanded(false);
        }

        private saveChanges() {
            const oldValue = this.windowClass;
            const newValue = this.inputValue.trim();

            if (newValue !== oldValue) {
                this.originalWindowClass = oldValue;
                this.windowClass = newValue;
                this.updateDisplay();
                this.emit("save-requested");
            }

            this.closeExpanded();
        }

        private updateButtonVisibility() {
            this.checkButton.visible = this.get_expanded();
            if (this.get_expanded()) {
                this.updateCheckButtonState();
            }
        }

        updateCheckButtonState() {
            this.checkButton.set_sensitive(this.inputValue.trim().length > 0);
        }

        private updateDisplay() {
            if (this.windowClass) {
                this.set_title(this.windowClass);
                this.set_subtitle(
                    `Expand this row to edit - ${this.windowClass}`,
                );
            } else {
                this.set_title("Expand this row to enter window class");
                this.set_subtitle("");
            }
        }
    },
);

export type BlockedAppRowInstance = InstanceType<typeof BlockedAppRow>;
