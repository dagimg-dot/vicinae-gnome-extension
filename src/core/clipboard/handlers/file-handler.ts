import St from "gi://St";
import {
    decodeClipboardBytes,
    isFileUri,
    parseFileUris,
    toUriListFormat,
} from "../../../utils/clipboard-utils.js";
import type {
    ClipboardContentHandler,
    ClipboardHandlerContext,
} from "./types.js";

const MIME_TYPE = "text/uri-list";

export class FileHandler implements ClipboardContentHandler {
    readonly mimeTypes = [MIME_TYPE] as const;
    readonly priority = 1;

    matchesMimeTypes(types: string[]): boolean {
        return types.includes(MIME_TYPE);
    }

    matchesContent(content: string): boolean {
        return isFileUri(content);
    }

    capture(
        clipboard: St.Clipboard,
        onResult: (content: string) => void,
        _context?: ClipboardHandlerContext,
    ): void {
        clipboard.get_content(
            St.ClipboardType.CLIPBOARD,
            MIME_TYPE,
            (_: unknown, content: unknown) => {
                if (!content) return;
                const data = decodeClipboardBytes(content);
                if (data && data.length > 0) {
                    const text = new TextDecoder().decode(data).trim();
                    if (text) onResult(text);
                }
            },
        );
    }

    set(clipboard: St.Clipboard, content: string): boolean {
        const uris = parseFileUris(content);
        const uriListBytes = toUriListFormat(uris);
        if (uriListBytes.length === 0) return false;

        clipboard.set_content(
            St.ClipboardType.CLIPBOARD,
            MIME_TYPE,
            uriListBytes,
        );
        clipboard.set_content(
            St.ClipboardType.PRIMARY,
            MIME_TYPE,
            uriListBytes,
        );
        return true;
    }

    getMimeType(): string {
        return MIME_TYPE;
    }
}
