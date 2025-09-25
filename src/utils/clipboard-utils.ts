import type { BufferLike } from "../core/clipboard/types.js";
import { getFocusedWindowApp } from "./window-utils.js";

/**
 * Configuration constants for performance optimization
 */
export const CLIPBOARD_CONFIG = {
    MAX_CLIPBOARD_SIZE: 10 * 1024 * 1024, // 10MB - reasonable clipboard limit
} as const;

/**
 * Validates if a buffer contains valid image data
 */
export function isValidImageBuffer(
    buffer: BufferLike | ArrayBuffer | Uint8Array,
): boolean {
    if (!buffer) return false;

    let uint8Array: Uint8Array;

    if (buffer instanceof ArrayBuffer) {
        if (buffer.byteLength < 8) return false;
        uint8Array = new Uint8Array(buffer);
    } else if (buffer instanceof Uint8Array) {
        if (buffer.length < 8) return false;
        uint8Array = buffer;
    } else if ("length" in buffer && buffer.length >= 8) {
        uint8Array = new Uint8Array(buffer.slice(0, 8));
    } else {
        return false;
    }

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (
        uint8Array[0] === 0x89 &&
        uint8Array[1] === 0x50 &&
        uint8Array[2] === 0x4e &&
        uint8Array[3] === 0x47
    ) {
        return true;
    }

    // JPEG signature: FF D8 FF
    if (
        uint8Array[0] === 0xff &&
        uint8Array[1] === 0xd8 &&
        uint8Array[2] === 0xff
    ) {
        return true;
    }

    // GIF signature: 47 49 46 38 (GIF8)
    if (
        uint8Array[0] === 0x47 &&
        uint8Array[1] === 0x49 &&
        uint8Array[2] === 0x46 &&
        uint8Array[3] === 0x38
    ) {
        return true;
    }

    // WebP signature: 52 49 46 46 ... 57 45 42 50 (RIFF...WEBP)
    if (
        uint8Array[0] === 0x52 &&
        uint8Array[1] === 0x49 &&
        uint8Array[2] === 0x46 &&
        uint8Array[3] === 0x46
    ) {
        // Check for WEBP at offset 8 if buffer is long enough
        let webpCheck: Uint8Array;
        if (buffer instanceof Uint8Array && buffer.length >= 12) {
            webpCheck = buffer.slice(8, 12);
        } else if (buffer instanceof ArrayBuffer && buffer.byteLength >= 12) {
            webpCheck = new Uint8Array(buffer.slice(8, 12));
        } else if ("length" in buffer && buffer.length >= 12) {
            webpCheck = new Uint8Array((buffer as BufferLike).slice(8, 12));
        } else {
            return false;
        }

        if (
            webpCheck[0] === 0x57 &&
            webpCheck[1] === 0x45 &&
            webpCheck[2] === 0x42 &&
            webpCheck[3] === 0x50
        ) {
            return true;
        }
    }

    return false;
}

/**
 * Gets the MIME type from image buffer data
 */
export function getImageMimeType(
    buffer: BufferLike | ArrayBuffer | Uint8Array,
): string {
    if (!buffer) return "application/octet-stream";

    let uint8Array: Uint8Array;

    if (buffer instanceof ArrayBuffer) {
        if (buffer.byteLength < 8) return "application/octet-stream";
        uint8Array = new Uint8Array(buffer.slice(0, 12));
    } else if (buffer instanceof Uint8Array) {
        if (buffer.length < 8) return "application/octet-stream";
        uint8Array = buffer.slice(0, 12);
    } else if ("length" in buffer && buffer.length >= 8) {
        uint8Array = new Uint8Array((buffer as BufferLike).slice(0, 12));
    } else {
        return "application/octet-stream";
    }

    // PNG
    if (
        uint8Array[0] === 0x89 &&
        uint8Array[1] === 0x50 &&
        uint8Array[2] === 0x4e &&
        uint8Array[3] === 0x47
    ) {
        return "image/png";
    }

    // JPEG
    if (
        uint8Array[0] === 0xff &&
        uint8Array[1] === 0xd8 &&
        uint8Array[2] === 0xff
    ) {
        return "image/jpeg";
    }

    // GIF
    if (
        uint8Array[0] === 0x47 &&
        uint8Array[1] === 0x49 &&
        uint8Array[2] === 0x46 &&
        uint8Array[3] === 0x38
    ) {
        return "image/gif";
    }

    // WebP
    if (
        uint8Array[0] === 0x52 &&
        uint8Array[1] === 0x49 &&
        uint8Array[2] === 0x46 &&
        uint8Array[3] === 0x46
    ) {
        // Check for WEBP at offset 8 if buffer is long enough
        let webpCheck: Uint8Array;
        if (buffer instanceof Uint8Array && buffer.length >= 12) {
            webpCheck = buffer.slice(8, 12);
        } else if (buffer instanceof ArrayBuffer && buffer.byteLength >= 12) {
            webpCheck = new Uint8Array(buffer.slice(8, 12));
        } else if ("length" in buffer && buffer.length >= 12) {
            webpCheck = new Uint8Array((buffer as BufferLike).slice(8, 12));
        } else {
            return "application/octet-stream";
        }

        if (
            webpCheck[0] === 0x57 &&
            webpCheck[1] === 0x45 &&
            webpCheck[2] === 0x42 &&
            webpCheck[3] === 0x50
        ) {
            return "image/webp";
        }
    }

    return "application/octet-stream";
}

/**
 * Calculates simplified clipboard metadata for an event
 * Removed unused fields (timestamp, contentType, contentHash, size)
 */
export function calculateClipboardMetadata(event: {
    content: string;
    source: string;
}) {
    const content = event.content;
    let mimeType = "text/plain";
    const sourceApp = getFocusedWindowApp();

    // Determine MIME type based on content
    if (event.source === "image") {
        if (content.startsWith("data:image/")) {
            const match = content.match(/^data:(image\/[^;]+);/);
            mimeType = match ? match[1] : "image/png";
        }
    } else if (content.startsWith("data:")) {
        // Handle other data URLs
        const match = content.match(/^data:([^;]+);/);
        mimeType = match ? match[1] : "application/octet-stream";
    } else {
        // Text content
        mimeType = "text/plain";

        // Check if it looks like HTML
        if (
            content.includes("<") &&
            content.includes(">") &&
            (content.includes("<html") ||
                content.includes("<div") ||
                content.includes("<p"))
        ) {
            mimeType = "text/html";
        }
    }

    return {
        mimeType,
        sourceApp,
    };
}
