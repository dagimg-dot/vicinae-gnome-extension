import Gio from "gi://Gio";

const ICONS = ["vicinae", "smile"] as const;
type ICON = (typeof ICONS)[number];

export class Icons {
    static #icons = new Map<ICON, Gio.Icon>();

    constructor(extPath: string) {
        for (const name of ICONS) {
            const iconPath = `${extPath}/assets/icons/${name}-symbolic.svg`;
            const icon = Gio.icon_new_for_string(iconPath);
            Icons.#icons.set(name, icon);
        }
    }

    static get(name: ICON) {
        return Icons.#icons.get(name);
    }
}
