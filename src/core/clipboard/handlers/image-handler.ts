import St from "gi://St";
import {
    decodeClipboardBytes,
    getImageMimeType,
    isValidImageBuffer,
} from "../../../utils/clipboard-utils.js";
import type {
    ClipboardContentHandler,
    ClipboardHandlerContext,
} from "./types.js";

const IMAGE_MIME_PREFIX = "image/";

export class ImageHandler implements ClipboardContentHandler {
    readonly mimeTypes = [
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
    ] as const;
    readonly priority = 2;

    matchesMimeTypes(types: string[]): boolean {
        return types.some((t) => t.startsWith(IMAGE_MIME_PREFIX));
    }

    matchesContent(content: string): boolean {
        return content.startsWith("[BINARY_IMAGE:");
    }

    capture(
        clipboard: St.Clipboard,
        onResult: (content: string) => void,
        context?: ClipboardHandlerContext,
    ): void {
        if (!context) return;

        clipboard.get_content(
            St.ClipboardType.CLIPBOARD,
            "image/png",
            (_: unknown, rawContent: unknown) => {
                if (!rawContent) return;

                const data = decodeClipboardBytes(rawContent);
                if (!data || data.length === 0) {
                    onResult("[IMAGE_DATA_AVAILABLE]");
                    return;
                }

                const isValid = isValidImageBuffer(data);
                const mimeType = getImageMimeType(data);

                if (isValid) {
                    const marker = `[BINARY_IMAGE:${mimeType}:${data.length}]`;
                    context.storeBinaryData(marker, data, mimeType);
                    onResult(marker);
                } else {
                    onResult("[BINARY_DATA_AVAILABLE]");
                }
            },
        );
    }

    set(_clipboard: St.Clipboard, _content: string): boolean {
        return false;
    }

    getMimeType(content: string, source?: string): string {
        if (source === "image" && content.startsWith("[BINARY_IMAGE:")) {
            const match = content.match(/^\[BINARY_IMAGE:([^:]+):/);
            return match ? match[1] : "image/png";
        }
        if (content.startsWith("data:image/")) {
            const match = content.match(/^data:(image\/[^;]+);/);
            return match ? match[1] : "image/png";
        }
        return "image/png";
    }
}
