import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import type Gtk from "gi://Gtk";

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

interface GeneralPageChildren {
    _sayHello: Adw.SwitchRow;
}

const GeneralPage = GObject.registerClass(
    {
        GTypeName: "TypescriptTemplateGeneralPage",
        Template: getTemplate("GeneralPage"),
        InternalChildren: ["sayHello"],
    },
    class GeneralPage extends Adw.PreferencesPage {
        bindSettings(settings: Gio.Settings) {
            logger("This is from prefs");
            const children = this as unknown as GeneralPageChildren;
            settings.bind(
                "say-hello",
                children._sayHello,
                "active",
                Gio.SettingsBindFlags.DEFAULT,
            );
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

export default class gnomextPrefs extends ExtensionPreferences {
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
