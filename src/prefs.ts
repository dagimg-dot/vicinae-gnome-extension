import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk";

import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import type { ExtensionMetadata } from "@girs/gnome-shell/extensions/extension";
import { logger } from "./utils/logger.js";

const LICENSE = "You can check out the LICENSE in the github page 🙂";

const getTemplate = (name: string): string => {
    const uri = GLib.uri_resolve_relative(
        import.meta.url,
        `ui/${name}.ui`,
        GLib.UriFlags.NONE,
    );
    if (uri === null) {
        throw new Error(`Failed to resolve URI for template ${name}!`);
    }
    return uri;
};

// Custom expandable row for blocked applications
const BlockedAppRow = GObject.registerClass(
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
            "window-changed": {
                param_types: [GObject.TYPE_STRING, GObject.TYPE_STRING],
            },
            "empty-state-changed": {
                param_types: [GObject.TYPE_BOOLEAN],
            },
            "save-requested": {},
        },
    },
    class BlockedAppRow extends Adw.ExpanderRow {
        private windowClass: string = "";
        private windowEntry: Adw.EntryRow;
        private checkButton: Gtk.Button;
        private deleteButton: Gtk.Button;

        constructor() {
            super();

            this.set_title("Expand this row to enter window class");
            this.set_subtitle("");

            // Create the entry row for window class input
            this.windowEntry = new Adw.EntryRow({
                title: "Window Class",
                text: "",
            });

            // Create check button (save/close)
            this.checkButton = new Gtk.Button({
                icon_name: "emblem-ok-symbolic",
                valign: Gtk.Align.CENTER,
                tooltip_text: "Save and close",
                css_classes: ["flat", "suggested-action"],
            });

            // Create delete button
            this.deleteButton = new Gtk.Button({
                icon_name: "user-trash-symbolic",
                valign: Gtk.Align.CENTER,
                tooltip_text: "Remove",
                css_classes: ["flat"],
            });

            // Add buttons to main row (check button first, then delete)
            this.add_suffix(this.checkButton);
            this.add_suffix(this.deleteButton);

            // Add entry row as child
            this.add_row(this.windowEntry);

            // Initially hide the check button (row starts collapsed)
            this.checkButton.visible = false;

            // Connect signals
            this.checkButton.connect("clicked", () => {
                this.emit("save-requested");
            });

            this.deleteButton.connect("clicked", () => {
                this.emit("delete-requested");
            });

            this.windowEntry.connect("changed", () => {
                const newValue = this.windowEntry.get_text().trim();
                const oldValue = this.windowClass;

                // Update internal state
                this.windowClass = newValue;
                this.updateDisplay();

                // Emit signals
                this.emit("window-changed", oldValue, newValue);
                this.emit("empty-state-changed", newValue === "");
            });

            // Listen for expand/collapse changes
            this.connect("notify::expanded", () => {
                this.updateButtonVisibility();
            });
        }

        setWindowClass(windowClass: string) {
            this.windowClass = windowClass;
            this.windowEntry.set_text(windowClass);
            this.updateDisplay();
        }

        getWindowClass(): string {
            return this.windowClass;
        }

        isEmpty(): boolean {
            return this.windowClass.trim() === "";
        }

        closeExpanded() {
            this.set_expanded(false);
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

        private updateButtonVisibility() {
            this.checkButton.visible = this.get_expanded();
        }
    },
);

interface GeneralPageChildren {
    _blockedAppsGroup: Adw.PreferencesGroup;
    _addWindowButton: Gtk.Button;
    _showStatusIndicator: Adw.SwitchRow;
    _loggingLevel: Adw.ComboRow;
}

const GeneralPage = GObject.registerClass(
    {
        GTypeName: "TypescriptTemplateGeneralPage",
        Template: getTemplate("GeneralPage"),
        InternalChildren: [
            "blockedAppsGroup",
            "addWindowButton",
            "showStatusIndicator",
            "loggingLevel",
        ],
    },
    class GeneralPage extends Adw.PreferencesPage {
        private settings!: Gio.Settings;
        private blockedAppRows: Map<string, BlockedAppRow> = new Map();
        private emptyRows: Set<BlockedAppRow> = new Set();

        bindSettings(settings: Gio.Settings) {
            logger("Binding Vicinae preferences settings");
            this.settings = settings;
            const children = this as unknown as GeneralPageChildren;

            // Load and display blocked applications
            this.loadBlockedApplications();

            // Connect add window button
            children._addWindowButton.connect("clicked", () => {
                this.addEmptyBlockedAppRow();
            });

            // Bind status indicator switch
            settings.bind(
                "show-status-indicator",
                children._showStatusIndicator,
                "active",
                Gio.SettingsBindFlags.DEFAULT,
            );

            // Bind logging level combo
            const loggingLevels = ["error", "warn", "info", "debug"];
            const currentLevel = settings.get_string("logging-level");
            const currentIndex = loggingLevels.indexOf(currentLevel);
            children._loggingLevel.set_selected(
                currentIndex >= 0 ? currentIndex : 2,
            ); // default to "info"

            children._loggingLevel.connect("notify::selected", () => {
                const selectedIndex = children._loggingLevel.get_selected();
                if (
                    selectedIndex >= 0 &&
                    selectedIndex < loggingLevels.length
                ) {
                    settings.set_string(
                        "logging-level",
                        loggingLevels[selectedIndex],
                    );
                }
            });
        }

        private loadBlockedApplications() {
            const children = this as unknown as GeneralPageChildren;
            const blockedApps = this.settings.get_strv("blocked-applications");

            // Clear existing rows
            this.blockedAppRows.forEach((row) => {
                children._blockedAppsGroup.remove(row);
            });
            this.blockedAppRows.clear();
            this.emptyRows.clear();

            // Add rows for each blocked application
            blockedApps.forEach((app) => {
                this.addBlockedAppRow(app);
            });

            // Update button state
            this.updateAddButtonState();
        }

        private addEmptyBlockedAppRow() {
            this.addBlockedAppRow("");
        }

        private addBlockedAppRow(windowClass: string) {
            const children = this as unknown as GeneralPageChildren;

            const row = new BlockedAppRow();
            row.setWindowClass(windowClass);

            // Connect signals
            row.connect("delete-requested", () => {
                this.removeBlockedAppRow(row);
            });

            row.connect(
                "window-changed",
                (_, oldClass: string, newClass: string) => {
                    this.updateBlockedApp(row, oldClass, newClass);
                },
            );

            row.connect("empty-state-changed", (_, isEmpty: boolean) => {
                this.handleEmptyStateChange(row, isEmpty);
            });

            row.connect("save-requested", () => {
                this.saveAndCloseRow(row);
            });

            children._blockedAppsGroup.add(row);

            if (windowClass) {
                this.blockedAppRows.set(windowClass, row);
            } else {
                this.emptyRows.add(row);
            }

            // Update button state
            this.updateAddButtonState();
        }

        private removeBlockedAppRow(row: BlockedAppRow) {
            const children = this as unknown as GeneralPageChildren;
            const windowClass = row.getWindowClass();

            if (windowClass) {
                // Remove from settings
                const currentApps = this.settings.get_strv(
                    "blocked-applications",
                );
                const updatedApps = currentApps.filter(
                    (app) => app !== windowClass,
                );
                this.settings.set_strv("blocked-applications", updatedApps);

                // Remove from map
                this.blockedAppRows.delete(windowClass);
            } else {
                // Remove from empty rows set
                this.emptyRows.delete(row);
            }

            // Remove from UI
            children._blockedAppsGroup.remove(row);

            // Update button state
            this.updateAddButtonState();
        }

        private handleEmptyStateChange(row: BlockedAppRow, isEmpty: boolean) {
            if (isEmpty) {
                this.emptyRows.add(row);
            } else {
                this.emptyRows.delete(row);
            }
            this.updateAddButtonState();
        }

        private updateAddButtonState() {
            const children = this as unknown as GeneralPageChildren;
            // Disable button if there are any empty rows
            children._addWindowButton.set_sensitive(this.emptyRows.size === 0);
        }

        private updateBlockedApp(
            row: BlockedAppRow,
            oldClass: string,
            newClass: string,
        ) {
            // Trim whitespace
            newClass = newClass.trim();
            oldClass = oldClass.trim();

            // Check if new class is already in use
            if (
                newClass &&
                this.blockedAppRows.has(newClass) &&
                newClass !== oldClass
            ) {
                // Show toast notification
                const root = this.get_root() as Adw.PreferencesWindow;
                if (root && "add_toast" in root) {
                    const toast = new Adw.Toast({
                        title: `Can't add ${newClass} to the list, because it's already there`,
                    });
                    (root as Adw.PreferencesWindow & { add_toast: (toast: Adw.Toast) => void }).add_toast(toast);
                }

                // Revert the change
                row.setWindowClass(oldClass);
                return;
            }

            const currentApps = this.settings.get_strv("blocked-applications");

            if (oldClass === "") {
                // Adding new entry
                if (newClass) {
                    const updatedApps = [...currentApps, newClass];
                    this.settings.set_strv("blocked-applications", updatedApps);
                    this.blockedAppRows.set(newClass, row);
                    this.emptyRows.delete(row);
                }
            } else {
                // Updating existing entry
                const index = currentApps.indexOf(oldClass);
                if (index !== -1) {
                    if (newClass) {
                        // Replace old with new
                        currentApps[index] = newClass;
                        this.settings.set_strv(
                            "blocked-applications",
                            currentApps,
                        );
                        this.blockedAppRows.delete(oldClass);
                        this.blockedAppRows.set(newClass, row);
                    } else {
                        // Remove if empty
                        const updatedApps = currentApps.filter(
                            (app) => app !== oldClass,
                        );
                        this.settings.set_strv(
                            "blocked-applications",
                            updatedApps,
                        );
                        this.blockedAppRows.delete(oldClass);
                        this.emptyRows.add(row);
                    }
                }
            }

            // Update button state after any change
            this.updateAddButtonState();
        }

        private saveAndCloseRow(row: BlockedAppRow) {
            const windowClass = row.getWindowClass();
            if (windowClass) {
                const currentApps = this.settings.get_strv(
                    "blocked-applications",
                );
                if (!currentApps.includes(windowClass)) {
                    const updatedApps = [...currentApps, windowClass];
                    this.settings.set_strv("blocked-applications", updatedApps);
                    this.blockedAppRows.set(windowClass, row);
                    this.emptyRows.delete(row);
                }
            } else {
                // This case should ideally not happen if save-requested is only connected to non-empty rows
                // but as a safeguard, we can remove the row if it's empty.
                this.removeBlockedAppRow(row);
            }
            row.closeExpanded();
        }
    },
);

interface AboutPageChildren {
    _extensionName: Gtk.Label;
    _extensionDescription: Gtk.Label;
    _linkGithub: Gtk.LinkButton;
    _linkIssues: Gtk.LinkButton;
    _extensionLicense: Gtk.TextView;
}

const AboutPage = GObject.registerClass(
    {
        GTypeName: "TypescriptTemplateAboutPage",
        Template: getTemplate("AboutPage"),
        InternalChildren: [
            "extensionName",
            "extensionDescription",
            "linkGithub",
            "linkIssues",
            "extensionLicense",
        ],
    },
    class AboutPage extends Adw.PreferencesPage {
        setMetadata(metadata: ExtensionMetadata) {
            const children = this as unknown as AboutPageChildren;
            children._extensionName.set_text(metadata.name);
            children._extensionDescription.set_text(metadata.description);
            if (metadata.url) {
                children._linkGithub.set_uri(metadata.url);
                children._linkIssues.set_uri(`${metadata.url}/issues`);
            } else {
                children._linkGithub.visible = false;
                children._linkIssues.visible = false;
            }
            children._extensionLicense.buffer.set_text(LICENSE, -1);
        }
    },
);

export default class VicinaePrefs extends ExtensionPreferences {
    override async fillPreferencesWindow(
        window: Adw.PreferencesWindow,
    ): Promise<void> {
        const prefsWindow = window as Adw.PreferencesWindow & {
            _settings: Gio.Settings;
        };

        // Create a settings object and bind the row to our key.
        // Attach the settings object to the window to keep it alive while the window is alive.
        prefsWindow._settings = this.getSettings();

        const generalPage = new GeneralPage();
        generalPage.bindSettings(prefsWindow._settings);
        prefsWindow.add(generalPage);

        const aboutPage = new AboutPage();
        aboutPage.setMetadata(this.metadata);
        prefsWindow.add(aboutPage);
    }
}
