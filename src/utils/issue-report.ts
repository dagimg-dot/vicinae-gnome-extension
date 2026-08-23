import Gio from "gi://Gio";
import GLib from "gi://GLib";
import * as Config from "resource:///org/gnome/Shell/Extensions/js/misc/config.js";

export interface ExtensionMetadata {
    path?: string;
    name: string;
    description: string;
    uuid: string;
    version?: string | number;
    "version-name"?: string;
    "shell-version"?: readonly string[];
    url?: string;
}

declare const __VICINAE_ENV_SUFFIX__: string | undefined;

async function getKernelVersionAsync(): Promise<string> {
    try {
        const file = Gio.File.new_for_path("/proc/version");
        const [contents] = await file.load_contents_async(null);
        if (contents) {
            const text = new TextDecoder().decode(contents).trim();
            const match = text.match(/^Linux version ([^\s]+)/);
            if (match?.[1]) {
                return `Linux ${match[1]}`;
            }
            return text.substring(0, 50);
        }
    } catch {
        // Fallback if reading fails
    }
    return "Linux";
}

export async function buildSystemInfo(
    metadata: ExtensionMetadata,
): Promise<string> {
    const osName =
        GLib.get_os_info("PRETTY_NAME") || GLib.get_os_info("NAME") || "Linux";
    const sessionType = GLib.getenv("XDG_SESSION_TYPE") || "unknown";
    const desktop = GLib.getenv("XDG_CURRENT_DESKTOP") || "GNOME";
    const kernel = await getKernelVersionAsync();
    const shellVersion =
        Config.PACKAGE_VERSION ||
        metadata["shell-version"]?.join(", ") ||
        "unknown";

    const versionStr = `v${metadata["version-name"] || metadata.version || "1.0.0"}${
        typeof __VICINAE_ENV_SUFFIX__ !== "undefined"
            ? __VICINAE_ENV_SUFFIX__
            : ""
    }`;

    return [
        `- **Extension Version**: ${versionStr} (\`${metadata.uuid}\`)`,
        `- **GNOME Shell**: ${shellVersion}`,
        `- **Session Type**: ${sessionType}`,
        `- **OS**: ${osName}`,
        `- **Kernel / Arch**: ${kernel}`,
        `- **Desktop**: ${desktop}`,
    ].join("\n");
}

export async function makeBugReportUrl(
    metadata: ExtensionMetadata,
): Promise<string> {
    const baseUrl =
        metadata.url || "https://github.com/vicinaehq/gnome-extension";
    const systemInfo = await buildSystemInfo(metadata);

    const body = [
        "### System Information",
        "",
        systemInfo,
        "",
        "### Describe the Bug",
        "",
        "A clear and concise description of what the bug is.",
        "",
        "### Steps to Reproduce",
        "",
        "1. ",
        "2. ",
        "3. ",
        "",
        "### Expected Behavior",
        "",
        "A clear and concise description of what you expected to happen.",
        "",
        "### Screenshots / Logs",
        "",
        'If applicable, add screenshots or logs (`journalctl --user -n 50 -g "Vicinae"`).',
        "",
        "### Additional Context",
        "",
        "Add any other context about the problem here.",
        "",
    ].join("\n");

    return `${baseUrl}/issues/new?body=${encodeURIComponent(body)}`;
}
