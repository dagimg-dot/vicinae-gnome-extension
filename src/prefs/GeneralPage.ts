import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import type { GeneralPageChildren } from "../types/prefs.js";
import { getTemplate } from "../utils/getTemplate.js";
import { logger } from "../utils/logger.js";
import {
    BlockedAppRow,
    type BlockedAppRowInstance,
} from "./components/blocked-app-row.js";

/** GSettings `logging-level` string values, in ComboRow order. */
const LOGGING_LEVELS: readonly string[] = ["error", "warn", "info", "debug"];

export const GeneralPage = GObject.registerClass(
    {
        GTypeName: "VicinaeGeneralPage",
        Template: getTemplate("GeneralPage"),
        InternalChildren: [
            "blockedAppsGroup",
            "addWindowButton",
            "showStatusIndicator",
            "loggingLevel",
            "launcherAutoCloseFocusLoss",
            "launcherAppClass",
            "journalctlCommand",
        ],
    },
    class GeneralPage extends Adw.PreferencesPage {
        private settings!: Gio.Settings;
        private blockedAppRows: Map<string, BlockedAppRowInstance> = new Map();
        private emptyRows: Set<BlockedAppRowInstance> = new Set();

        bindSettings(settings: Gio.Settings) {
            this.settings = settings;
            logger.debug("Settings bound to GeneralPage");

            this.loadBlockedApplications();
            this.updateAddButtonState();

            const children = this as unknown as GeneralPageChildren;

            this.connectAddBlockedAppButton(children);
            this.bindShowStatusIndicator(settings, children);
            this.bindLoggingLevel(settings, children);
            this.bindLauncherAutoCloseFocusLoss(settings, children);
            this.bindLauncherAppClass(settings, children);
        }

        /** "Add window class" → append an empty blocked-app row. */
        private connectAddBlockedAppButton(children: GeneralPageChildren) {
            children._addWindowButton.connect("clicked", () => {
                this.addEmptyBlockedAppRow();
            });
        }

        /** `show-status-indicator` ↔ status indicator switch. */
        private bindShowStatusIndicator(
            settings: Gio.Settings,
            children: GeneralPageChildren,
        ) {
            settings.bind(
                "show-status-indicator",
                children._showStatusIndicator,
                "active",
                Gio.SettingsBindFlags.DEFAULT,
            );
        }

        /** `logging-level` ↔ logging ComboRow (not a direct GSettings bind). */
        private bindLoggingLevel(
            settings: Gio.Settings,
            children: GeneralPageChildren,
        ) {
            const row = children._loggingLevel;
            const currentLevel = settings.get_string("logging-level");
            const currentIndex = LOGGING_LEVELS.indexOf(currentLevel);

            row.set_selected(currentIndex >= 0 ? currentIndex : 2);

            row.connect("notify::selected", () => {
                const selectedIndex = row.get_selected();
                if (
                    selectedIndex >= 0 &&
                    selectedIndex < LOGGING_LEVELS.length
                ) {
                    settings.set_string(
                        "logging-level",
                        LOGGING_LEVELS[selectedIndex],
                    );
                }
            });
        }

        /** `launcher-auto-close-focus-loss` ↔ auto-close switch. */
        private bindLauncherAutoCloseFocusLoss(
            settings: Gio.Settings,
            children: GeneralPageChildren,
        ) {
            settings.bind(
                "launcher-auto-close-focus-loss",
                children._launcherAutoCloseFocusLoss,
                "active",
                Gio.SettingsBindFlags.DEFAULT,
            );
        }

        /** `launcher-app-class` ↔ launcher WM class entry. */
        private bindLauncherAppClass(
            settings: Gio.Settings,
            children: GeneralPageChildren,
        ) {
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

                const uniqueBlockedApps = this.removeDuplicates(blockedApps);
                if (uniqueBlockedApps.length !== blockedApps.length) {
                    this.settings.set_strv(
                        "blocked-applications",
                        uniqueBlockedApps,
                    );
                }

                const children = this as unknown as GeneralPageChildren;
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
            this.addBlockedAppRow("");
        }

        private addBlockedAppRow(windowClass: string) {
            const children = this as unknown as GeneralPageChildren;

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

            children._blockedAppsGroup.add(row);

            if (windowClass) {
                this.blockedAppRows.set(windowClass, row);
            } else {
                this.emptyRows.add(row);
                row.updateCheckButtonState();
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
            const children = this as unknown as GeneralPageChildren;
            const hasEmptyRows = this.emptyRows.size > 0;
            children._addWindowButton.set_sensitive(!hasEmptyRows);
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
            const children = this as unknown as GeneralPageChildren;
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
