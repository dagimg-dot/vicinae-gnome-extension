import type Adw from "gi://Adw";
import type Gtk from "gi://Gtk";

export interface GeneralPageChildren {
    _blockedAppsGroup: Adw.PreferencesGroup;
    _addWindowButton: Gtk.Button;
    _showStatusIndicator: Adw.SwitchRow;
    _loggingLevel: Adw.ComboRow;
    _launcherAutoCloseFocusLoss: Adw.SwitchRow;
    _launcherAppClass: Adw.EntryRow;
}

export interface AboutPageChildren {
    _extensionIcon: Gtk.Image;
    _extensionName: Gtk.Label;
    _extensionVersion: Gtk.Label;
    _linkWebsite: Gtk.Button;
    _linkIssues: Gtk.Button;
    _creditsRow: Adw.ExpanderRow;
    _legalRow: Adw.ExpanderRow;
    _extensionLicense: Gtk.TextView;
}

export interface Credit {
    title: string;
    subtitle: string;
    github?: string; // Optional GitHub username
}
