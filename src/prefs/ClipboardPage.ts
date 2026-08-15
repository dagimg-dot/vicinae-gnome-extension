import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import type { ClipboardPageChildren } from "../types/prefs.js";
import { getTemplate } from "../utils/getTemplate.js";
import { logger } from "../utils/logger.js";
import {
    BlockedAppRow,
    type BlockedAppRowInstance,
} from "./components/blocked-app-row.js";

export const ClipboardPage = GObject.registerClass(
    {
        GTypeName: "VicinaeClipboardPage",
        Template: getTemplate("ClipboardPage"),
        InternalChildren: [
            "enableClipboardMonitoring",
            "blockedAppsGroup",
            "emptyPlaceholderRow",
            "addWindowButton",
        ],
    },
    class ClipboardPage extends Adw.PreferencesPage {
        private settings!: Gio.Settings;
        private blockedAppRows: Map<string, BlockedAppRowInstance> = new Map();
        private emptyRows: Set<BlockedAppRowInstance> = new Set();

        bindSettings(settings: Gio.Settings) {
            this.settings = settings;
            logger.debug("Settings bound to ClipboardPage");

            this.loadBlockedApplications();
            this.updateAddButtonState();

            const children = this as unknown as ClipboardPageChildren;

            this.connectAddBlockedAppButton(children);
            this.bindEnableClipboardMonitoring(settings, children);
        }

        /** "Add window class" → append an empty blocked-app row. */
        private connectAddBlockedAppButton(children: ClipboardPageChildren) {
            children._addWindowButton.connect("clicked", () => {
                this.addEmptyBlockedAppRow();
            });
        }

        /** `enable-clipboard-monitoring` ↔ clipboard monitoring switch. */
        private bindEnableClipboardMonitoring(
            settings: Gio.Settings,
            children: ClipboardPageChildren,
        ) {
            settings.bind(
                "enable-clipboard-monitoring",
                children._enableClipboardMonitoring,
                "active",
                Gio.SettingsBindFlags.DEFAULT,
            );

            // Update sensitivity of blocked apps group based on the switch
            const updateSensitivity = () => {
                const isEnabled = settings.get_boolean(
                    "enable-clipboard-monitoring",
                );
                children._blockedAppsGroup.set_sensitive(isEnabled);
            };

            settings.connect(
                "changed::enable-clipboard-monitoring",
                updateSensitivity,
            );
            updateSensitivity();
        }

        private loadBlockedApplications() {
            try {
                const blockedApps = this.settings.get_strv(
                    "blocked-applications",
                );

                const uniqueBlockedApps = this.removeDuplicates(blockedApps);
                if (uniqueBlockedApps.length !== blockedApps.length) {
                    this.settings.set_strv(
                        "blocked-applications",
                        uniqueBlockedApps,
                    );
                }

                const children = this as unknown as ClipboardPageChildren;
                const existingRows = Array.from(this.blockedAppRows.values());
                existingRows.forEach((row) => {
                    children._blockedAppsGroup.remove(row);
                });
                this.blockedAppRows.clear();
                this.emptyRows.clear();

                uniqueBlockedApps.forEach((windowClass) => {
                    this.addBlockedAppRow(windowClass);
                });
            } catch (error) {
                logger.error("Error loading blocked applications", error);
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
            if (this.emptyRows.size > 0) {
                const firstEmptyRow = this.emptyRows.values().next().value;
                if (firstEmptyRow) {
                    firstEmptyRow.focusInput();
                }
                return;
            }
            this.addBlockedAppRow("");
        }

        private addBlockedAppRow(windowClass: string) {
            const children = this as unknown as ClipboardPageChildren;

            const row = new BlockedAppRow();
            row.setWindowClass(windowClass);

            row.connect("delete-requested", () => {
                this.removeBlockedAppRow(row);
            });

            row.connect("save-requested", () => {
                this.handleSaveRequest(row);
            });

            row.connect("input-changed", () => {
                this.handleInputChange(row);
            });

            children._blockedAppsGroup.add_row(row);

            if (windowClass) {
                this.blockedAppRows.set(windowClass, row);
            } else {
                this.emptyRows.add(row);
                row.focusInput();
            }

            this.updateAddButtonState();
        }

        private handleInputChange(row: BlockedAppRowInstance) {
            const isEmpty = row.isEmpty();
            const wasEmpty = this.emptyRows.has(row);

            if (isEmpty && !wasEmpty) {
                this.emptyRows.add(row);
            } else if (!isEmpty && wasEmpty) {
                this.emptyRows.delete(row);
            }

            this.updateAddButtonState();
        }

        private updateAddButtonState() {
            const children = this as unknown as ClipboardPageChildren;
            const hasEmptyRows = this.emptyRows.size > 0;
            children._addWindowButton.set_sensitive(!hasEmptyRows);

            const hasAnyRows =
                this.blockedAppRows.size > 0 || this.emptyRows.size > 0;
            children._emptyPlaceholderRow.set_visible(!hasAnyRows);
        }

        private handleSaveRequest(row: BlockedAppRowInstance) {
            const oldClass = row.getOriginalWindowClass();
            const newClass = row.getInputValue().trim();

            if (newClass) {
                const currentBlockedApps = this.settings.get_strv(
                    "blocked-applications",
                );

                const isDuplicate = currentBlockedApps.some(
                    (app) =>
                        app !== oldClass &&
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
                    row.setWindowClass(oldClass);
                    return;
                }
                this.updateBlockedAppInSettings(row, oldClass, newClass);
            } else {
                this.removeBlockedAppFromSettings(row, oldClass);
            }
            this.updateAddButtonState();
        }

        private updateBlockedAppInSettings(
            row: BlockedAppRowInstance,
            oldClass: string,
            newClass: string,
        ) {
            try {
                const currentBlockedApps = this.settings.get_strv(
                    "blocked-applications",
                );

                let filteredApps: string[];

                if (oldClass && oldClass.trim() !== "") {
                    filteredApps = currentBlockedApps.filter(
                        (app) => app !== oldClass,
                    );
                } else {
                    filteredApps = [...currentBlockedApps];
                }

                filteredApps.push(newClass);

                this.settings.set_strv("blocked-applications", filteredApps);

                if (oldClass && oldClass.trim() !== "") {
                    this.blockedAppRows.delete(oldClass);
                }
                this.blockedAppRows.set(newClass, row);
            } catch (error) {
                logger.error("Error updating blocked app in settings", error);
            }
        }

        private removeBlockedAppFromSettings(
            _row: BlockedAppRowInstance,
            oldClass: string,
        ) {
            try {
                if (!oldClass || oldClass.trim() === "") {
                    return;
                }

                const currentBlockedApps = this.settings.get_strv(
                    "blocked-applications",
                );

                const filteredApps = currentBlockedApps.filter(
                    (app) => app !== oldClass,
                );

                this.settings.set_strv("blocked-applications", filteredApps);

                this.blockedAppRows.delete(oldClass);
            } catch (error) {
                logger.error("Error removing blocked app from settings", error);
            }
        }

        private removeBlockedAppRow(row: BlockedAppRowInstance) {
            const children = this as unknown as ClipboardPageChildren;
            const windowClass = row.getWindowClass();

            if (windowClass) {
                const currentApps = this.settings.get_strv(
                    "blocked-applications",
                );

                const updatedApps = currentApps.filter(
                    (app) => app !== windowClass,
                );
                this.settings.set_strv("blocked-applications", updatedApps);

                this.blockedAppRows.delete(windowClass);
            } else {
                this.emptyRows.delete(row);
            }

            children._blockedAppsGroup.remove(row);

            this.updateAddButtonState();
        }
    },
);
