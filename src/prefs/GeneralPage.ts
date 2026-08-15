import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import type { GeneralPageChildren } from "../types/prefs.js";
import { getTemplate } from "../utils/getTemplate.js";
import { logger } from "../utils/logger.js";

/** GSettings `logging-level` string values, in ComboRow order. */
const LOGGING_LEVELS: readonly string[] = ["error", "warn", "info", "debug"];

export const GeneralPage = GObject.registerClass(
    {
        GTypeName: "VicinaeGeneralPage",
        Template: getTemplate("GeneralPage"),
        InternalChildren: [
            "showStatusIndicator",
            "loggingLevel",
            "launcherAutoCloseFocusLoss",
            "launcherAppClass",
            "journalctlCommand",
        ],
    },
    class GeneralPage extends Adw.PreferencesPage {
        private settings!: Gio.Settings;

        bindSettings(settings: Gio.Settings) {
            this.settings = settings;
            logger.debug("Settings bound to GeneralPage");

            const children = this as unknown as GeneralPageChildren;

            this.bindShowStatusIndicator(settings, children);
            this.bindLoggingLevel(settings, children);
            this.bindLauncherAutoCloseFocusLoss(settings, children);
            this.bindLauncherAppClass(settings, children);
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
    },
);
