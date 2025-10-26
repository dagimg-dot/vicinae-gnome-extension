import Adw from "gi://Adw";
import Gdk from "gi://Gdk";
import type Gio from "gi://Gio";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk";
import type { ExtensionMetadata } from "@girs/gnome-shell/extensions/extension";
import { Icons } from "../lib/icons.js";
import type { AboutPageChildren, Credit } from "../types/prefs.js";
import { getTemplate } from "../utils/getTemplate.js";

export const CREDITS: Credit[] = [
    {
        title: "Dagim G. Astatkie",
        subtitle: "Original Author",
        github: "dagimg-dot",
    },
    {
        title: "Fernando Carletti",
        subtitle: "Contributor",
        github: "fernandocarletti",
    },
    {
        title: "Tommy Brunn",
        subtitle: "Contributor",
        github: "Nevon",
    },
    {
        title: "Yuriy Matskanyuk",
        subtitle: "Contributor",
        github: "SiriusCrain",
    },
    {
        title: "Noa Virellia",
        subtitle: "Contributor",
        github: "AsterisMono",
    },
];

const LICENSE = `MIT License

Copyright (c) 2025 Dagim G. Astatkie

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

export const AboutPage = GObject.registerClass(
    {
        GTypeName: "VicinaeAboutPage",
        Template: getTemplate("AboutPage"),
        InternalChildren: [
            "extensionIcon",
            "extensionName",
            "extensionVersion",
            "linkWebsite",
            "linkIssues",
            "creditsRow",
            "legalRow",
            "extensionLicense",
        ],
    },
    class AboutPage extends Adw.PreferencesPage {
        setMetadata(metadata: ExtensionMetadata) {
            const children = this as unknown as AboutPageChildren;

            new Icons(metadata.path);

            const vicinaeIcon = Icons.get("vicinae") as Gio.Icon;

            children._extensionIcon.set_from_gicon(vicinaeIcon);

            children._extensionName.set_text(metadata.name);
            children._extensionVersion.set_text(
                `v${metadata["version-name"] || metadata.version}`,
            );

            if (metadata.url) {
                children._linkWebsite.connect("clicked", () => {
                    Gtk.show_uri(null, metadata.url || "", Gdk.CURRENT_TIME);
                });
                children._linkIssues.connect("clicked", () => {
                    Gtk.show_uri(
                        null,
                        `${metadata.url}/issues`,
                        Gdk.CURRENT_TIME,
                    );
                });
            } else {
                children._linkWebsite.visible = false;
                children._linkIssues.visible = false;
            }

            children._extensionLicense.buffer.set_text(LICENSE, -1);

            this.renderCredits(children, metadata.path);
        }

        private renderCredits(children: AboutPageChildren, path: string) {
            const creditsExpander = children._creditsRow;

            CREDITS.forEach((credit) => {
                const creditRow = new Adw.ActionRow({
                    title: credit.title,
                    subtitle: credit.subtitle,
                });

                // Add GitHub icon if username is available
                if (credit.github) {
                    new Icons(path);
                    const githubIcon = Icons.get("github") as Gio.Icon;

                    creditRow.add_suffix(
                        new Gtk.Image({
                            gicon: githubIcon,
                            pixel_size: 16,
                        }),
                    );

                    // Make the row clickable
                    creditRow.set_activatable(true);
                    creditRow.connect("activated", () => {
                        this.openGitHubProfile(credit.github);
                    });
                }

                creditsExpander.add_row(creditRow);
            });
        }

        private openGitHubProfile(githubUsername: string | undefined) {
            if (!githubUsername) return;

            const githubUrl = `https://github.com/${githubUsername}`;
            try {
                Gtk.show_uri(null, githubUrl, Gdk.CURRENT_TIME);
            } catch (error) {
                console.error("Failed to open GitHub profile:", error);
            }
        }
    },
);
