import type Adw from "gi://Adw";
import type Gio from "gi://Gio";

import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import { AboutPage } from "./prefs/AboutPage.js";
import { GeneralPage } from "./prefs/GeneralPage.js";

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
