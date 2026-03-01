import St from "gi://St";
import { isFileUri } from "../../../utils/clipboard-utils.js";
import type {
    ClipboardContentHandler,
    ClipboardHandlerContext,
} from "./types.js";

const MIME_TYPES = ["text/plain"] as const;

export class TextHandler implements ClipboardContentHandler {
    readonly mimeTypes = MIME_TYPES;
    readonly priority = 0;

    matchesMimeTypes(types: string[]): boolean {
        return types.includes("text/plain") || types.length === 0;
    }

    matchesContent(content: string): boolean {
        if (typeof content !== "string") return false;
        if (isFileUri(content)) return false;
        if (
            content.startsWith("[BINARY_IMAGE:") ||
            content.startsWith("[BINARY_DATA:")
        )
            return false;
        return true;
    }

    capture(
        clipboard: St.Clipboard,
        onResult: (content: string) => void,
        _context?: ClipboardHandlerContext,
    ): void {
        clipboard.get_text(St.ClipboardType.CLIPBOARD, (_, text) => {
            if (text) onResult(text);
        });
        clipboard.get_text(St.ClipboardType.PRIMARY, (_, text) => {
            if (text) onResult(text);
        });
    }

    set(clipboard: St.Clipboard, content: string): boolean {
        clipboard.set_text(St.ClipboardType.CLIPBOARD, content);
        clipboard.set_text(St.ClipboardType.PRIMARY, content);
        return true;
    }

    getMimeType(content: string): string {
        if (
            content.includes("<") &&
            content.includes(">") &&
            (content.includes("<html") ||
                content.includes("<div") ||
                content.includes("<p"))
        ) {
            return "text/html";
        }
        return "text/plain";
    }
}
