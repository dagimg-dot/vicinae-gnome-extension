import Gio from "gi://Gio";

const ICONS = ["smile"] as const;
type ICON = (typeof ICONS)[number];

export class Icons {
    static #icons = new Map<ICON, Gio.Icon>();

    constructor(extPath: string) {
        for (const name of ICONS) {
            const icon = Gio.icon_new_for_string(
                `${extPath}/assets/icons/${name}-symbolic.svg`,
            );
            Icons.#icons.set(name, icon);
        }
    }

    static get(name: ICON) {
        return Icons.#icons.get(name);
    }
}
