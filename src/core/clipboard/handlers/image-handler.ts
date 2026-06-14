import St from "gi://St";
import {
    bufferLikeToUint8Array,
    decodeClipboardBytes,
} from "../../../utils/clipboard-utils.js";
import type { BufferLike } from "../types.js";
import type {
    ClipboardContentHandler,
    ClipboardHandlerContext,
    SignalPayload,
    SignalPayloadContext,
} from "./types.js";

export class ImageHandler implements ClipboardContentHandler {
    readonly mimeTypes = [
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
    ] as const;
    readonly priority = 2;

    private requestedMimeType: string = "image/png";

    matchesMimeTypes(types: string[]): boolean {
        for (const supported of this.mimeTypes) {
            if (types.includes(supported)) {
                this.requestedMimeType = supported;
                return true;
            }
        }
        return false;
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
            this.requestedMimeType,
            (_: unknown, rawContent: unknown) => {
                if (!rawContent) return;

                const data = decodeClipboardBytes(rawContent);
                if (!data || data.length === 0) return;

                const marker = `[BINARY_IMAGE:${this.requestedMimeType}:${data.length}]`;
                context.storeBinaryData(marker, data, this.requestedMimeType);
                onResult(marker);
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

    toSignalPayload(
        event: { content: string },
        context: SignalPayloadContext,
    ): SignalPayload | null {
        if (!event.content.startsWith("[BINARY_IMAGE:")) return null;

        const binaryInfo = context.getBinaryData(event.content);
        if (!binaryInfo) return null;

        return {
            content: bufferLikeToUint8Array(binaryInfo.data as BufferLike),
            mimeType: binaryInfo.mimeType,
        };
    }
}
