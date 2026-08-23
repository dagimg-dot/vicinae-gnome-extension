import GLib from "gi://GLib";

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

function getKernelAndArch(): string {
    try {
        const [success, stdout] = GLib.spawn_command_line_sync("uname -srm");
        if (success && stdout) {
            return new TextDecoder().decode(stdout).trim();
        }
    } catch {
        // Fallback if spawn fails
    }
    return "Linux";
}

function getGnomeShellVersion(metadata: ExtensionMetadata): string {
    try {
        const [success, stdout] = GLib.spawn_command_line_sync(
            "gnome-shell --version",
        );
        if (success && stdout) {
            const output = new TextDecoder().decode(stdout).trim();
            const match = output.match(/GNOME Shell ([\d.]+)/i);
            if (match?.[1]) {
                return match[1];
            }
            return output;
        }
    } catch {
        // Fallback if spawn fails
    }

    return metadata["shell-version"]?.join(", ") || "unknown";
}

export function buildSystemInfo(metadata: ExtensionMetadata): string {
    const osName =
        GLib.get_os_info("PRETTY_NAME") || GLib.get_os_info("NAME") || "Linux";
    const sessionType = GLib.getenv("XDG_SESSION_TYPE") || "unknown";
    const desktop = GLib.getenv("XDG_CURRENT_DESKTOP") || "GNOME";
    const kernel = getKernelAndArch();
    const shellVersion = getGnomeShellVersion(metadata);

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

export function makeBugReportUrl(metadata: ExtensionMetadata): string {
    const baseUrl =
        metadata.url || "https://github.com/vicinaehq/gnome-extension";
    const systemInfo = buildSystemInfo(metadata);

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
