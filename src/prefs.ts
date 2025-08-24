import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk";

import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import type { ExtensionMetadata } from "@girs/gnome-shell/extensions/extension";
import { logger } from "./utils/logger.js";

const LICENSE = "You can check out the LICENSE in the github page 🙂";
type BlockedAppRowType = InstanceType<typeof BlockedAppRow>;

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
            "save-requested": {},
            "input-changed": {},
        },
    },
    class BlockedAppRow extends Adw.ExpanderRow {
        private windowClass: string = "";
        private inputValue: string = ""; // Separate state for input field
        private originalWindowClass: string = ""; // Store the original value before editing
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
                this.saveChanges();
            });

            this.deleteButton.connect("clicked", () => {
                this.emit("delete-requested");
            });

            // Only track input changes locally, don't emit signals
            this.windowEntry.connect("changed", () => {
                this.inputValue = this.windowEntry.get_text().trim();
                this.updateCheckButtonState();
                // Emit a signal to notify parent about empty state change
                this.emit("input-changed");
            });

            // Listen for expand/collapse changes
            this.connect("notify::expanded", () => {
                this.updateButtonVisibility();
            });
        }

        setWindowClass(windowClass: string) {
            this.windowClass = windowClass;
            this.inputValue = windowClass;
            this.originalWindowClass = windowClass; // Initialize original value
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

        // Get the current effective window class (either the original or the edited value)
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
            // Update the main state only when saving
            const oldValue = this.windowClass;
            const newValue = this.inputValue.trim();

            if (newValue !== oldValue) {
                // Store the original value before updating
                this.originalWindowClass = oldValue;

                // Update the main state
                this.windowClass = newValue;
                this.updateDisplay();
                // Emit save signal so parent can update settings
                this.emit("save-requested");
            }

            // Close the expanded row
            this.closeExpanded();
        }

        private updateButtonVisibility() {
            this.checkButton.visible = this.get_expanded();
            if (this.get_expanded()) {
                this.updateCheckButtonState();
            }
        }

        updateCheckButtonState() {
            // Disable check button if input is empty
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

interface GeneralPageChildren {
    _blockedAppsGroup: Adw.PreferencesGroup;
    _addWindowButton: Gtk.Button;
    _showStatusIndicator: Adw.SwitchRow;
    _loggingLevel: Adw.ComboRow;
    _launcherAutoCloseFocusLoss: Adw.SwitchRow;
    _launcherAppClass: Adw.EntryRow;
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
            "launcherAutoCloseFocusLoss",
            "launcherAppClass",
        ],
    },
    class GeneralPage extends Adw.PreferencesPage {
        private settings!: Gio.Settings;
        private blockedAppRows: Map<string, BlockedAppRowType> = new Map();
        private emptyRows: Set<BlockedAppRowType> = new Set();

        bindSettings(settings: Gio.Settings) {
            this.settings = settings;
            logger("Settings bound to GeneralPage");

            this.loadBlockedApplications();
            this.updateAddButtonState(); // Initial state

            const children = this as unknown as GeneralPageChildren;
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

            // Bind launcher auto-close settings
            settings.bind(
                "launcher-auto-close-focus-loss",
                children._launcherAutoCloseFocusLoss,
                "active",
                Gio.SettingsBindFlags.DEFAULT,
            );

            settings.bind(
                "launcher-app-class",
                children._launcherAppClass,
                "text",
                Gio.SettingsBindFlags.DEFAULT,
            );
        }

        private loadBlockedApplications() {
            try {
                const blockedApps = this.settings.get_strv(
                    "blocked-applications",
                );

                // Clean up any duplicates that might exist
                const uniqueBlockedApps = this.removeDuplicates(blockedApps);
                if (uniqueBlockedApps.length !== blockedApps.length) {
                    this.settings.set_strv(
                        "blocked-applications",
                        uniqueBlockedApps,
                    );
                }

                // Clear existing rows
                const children = this as unknown as GeneralPageChildren;
                // Remove all existing rows from the UI by iterating through children
                const existingRows = Array.from(this.blockedAppRows.values());
                existingRows.forEach((row) => {
                    children._blockedAppsGroup.remove(row);
                });
                this.blockedAppRows.clear();
                this.emptyRows.clear();

                // Add rows for each unique blocked app
                uniqueBlockedApps.forEach((windowClass) => {
                    this.addBlockedAppRow(windowClass);
                });
            } catch (error) {
                logger("Error loading blocked applications", error);
            }
        }

        private removeDuplicates(apps: string[]): string[] {
            const seen = new Set<string>();
            return apps.filter((app) => {
                const lowerApp = app.toLowerCase();
                if (seen.has(lowerApp)) {
                    return false;
                }
                seen.add(lowerApp);
                return true;
            });
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

            row.connect("save-requested", () => {
                this.handleSaveRequest(row);
            });

            row.connect("input-changed", () => {
                this.handleInputChange(row);
            });

            children._blockedAppsGroup.add(row);

            if (windowClass) {
                this.blockedAppRows.set(windowClass, row);
            } else {
                this.emptyRows.add(row);
                // Ensure the check button is disabled for empty rows
                row.updateCheckButtonState();
            }

            // Update button state
            this.updateAddButtonState();
        }

        private handleInputChange(row: BlockedAppRowType) {
            const isEmpty = row.isEmpty();
            const wasEmpty = this.emptyRows.has(row);

            if (isEmpty && !wasEmpty) {
                // Row became empty
                this.emptyRows.add(row);
            } else if (!isEmpty && wasEmpty) {
                // Row is no longer empty
                this.emptyRows.delete(row);
            }

            // Update button state
            this.updateAddButtonState();
        }

        private updateAddButtonState() {
            const children = this as unknown as GeneralPageChildren;
            // Enable button if there are no empty rows
            const hasEmptyRows = this.emptyRows.size > 0;
            children._addWindowButton.set_sensitive(!hasEmptyRows);
        }

        private handleSaveRequest(row: BlockedAppRowType) {
            const oldClass = row.getOriginalWindowClass();
            const newClass = row.getInputValue().trim();

            if (newClass) {
                // Check if this window class already exists in settings (excluding the current row's old class)
                const currentBlockedApps = this.settings.get_strv(
                    "blocked-applications",
                );

                const isDuplicate = currentBlockedApps.some(
                    (app) =>
                        app !== oldClass && // Exclude the current row's old class
                        app.toLowerCase() === newClass.toLowerCase(),
                );

                if (isDuplicate) {
                    const root = this.get_root() as Adw.PreferencesWindow;
                    if (root && "add_toast" in root) {
                        const toast = new Adw.Toast({
                            title: `Can't add ${newClass} to the list, because it's already there`,
                        });
                        (
                            root as Adw.PreferencesWindow & {
                                add_toast: (toast: Adw.Toast) => void;
                            }
                        ).add_toast(toast);
                    }
                    // Reset to old value and don't save
                    row.setWindowClass(oldClass);
                    return;
                } else {
                    this.updateBlockedAppInSettings(row, oldClass, newClass);
                }
            } else {
                this.removeBlockedAppFromSettings(row, oldClass);
            }
            this.updateAddButtonState();
        }

        private updateBlockedAppInSettings(
            row: BlockedAppRowType,
            oldClass: string,
            newClass: string,
        ) {
            try {
                // Get blocked apps from settings
                const currentBlockedApps = this.settings.get_strv(
                    "blocked-applications",
                );

                let filteredApps: string[];

                if (oldClass && oldClass.trim() !== "") {
                    // Updating existing app - remove old class
                    filteredApps = currentBlockedApps.filter(
                        (app) => app !== oldClass,
                    );
                } else {
                    // Adding new app - use current list as is
                    filteredApps = [...currentBlockedApps];
                }

                // Add new class
                filteredApps.push(newClass);

                // Update settings
                this.settings.set_strv("blocked-applications", filteredApps);

                // Update our internal tracking
                if (oldClass && oldClass.trim() !== "") {
                    this.blockedAppRows.delete(oldClass);
                }
                this.blockedAppRows.set(newClass, row);
            } catch (error) {
                logger("Error updating blocked app in settings", error);
            }
        }

        private removeBlockedAppFromSettings(
            _row: BlockedAppRowType,
            oldClass: string,
        ) {
            try {
                // Only remove if we have a valid oldClass
                if (!oldClass || oldClass.trim() === "") {
                    return;
                }

                // Get current blocked apps from settings
                const currentBlockedApps = this.settings.get_strv(
                    "blocked-applications",
                );

                // Remove the old class
                const filteredApps = currentBlockedApps.filter(
                    (app) => app !== oldClass,
                );

                // Update settings
                this.settings.set_strv("blocked-applications", filteredApps);

                // Update our internal tracking
                this.blockedAppRows.delete(oldClass);
            } catch (error) {
                logger("Error removing blocked app from settings", error);
            }
        }

        private removeBlockedAppRow(row: BlockedAppRowType) {
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
