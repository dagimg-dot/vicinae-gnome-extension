import type { BufferLike } from "../core/clipboard/types.js";
import { getFocusedWindowApp } from "./window-utils.js";

/**
 * Converts a Uint8Array to base64 string using direct bit manipulation
 * This is more reliable than btoa() for large binary data
 */
export function uint8ArrayToBase64(uint8Array: Uint8Array): string {
    try {
        // Create a base64 lookup table
        const base64Chars =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let result = "";

        // Process 3 bytes at a time (24 bits = 4 base64 characters)
        for (let i = 0; i < uint8Array.length; i += 3) {
            const byte1 = uint8Array[i] || 0;
            const byte2 = uint8Array[i + 1] || 0;
            const byte3 = uint8Array[i + 2] || 0;

            // Convert 3 bytes to 4 base64 characters
            const chunk1 = (byte1 >> 2) & 0x3f;
            const chunk2 = ((byte1 & 0x3) << 4) | ((byte2 >> 4) & 0xf);
            const chunk3 = ((byte2 & 0xf) << 2) | ((byte3 >> 6) & 0x3);
            const chunk4 = byte3 & 0x3f;

            result +=
                base64Chars[chunk1] +
                base64Chars[chunk2] +
                base64Chars[chunk3] +
                base64Chars[chunk4];
        }

        // Add padding if needed
        const padding = 3 - (uint8Array.length % 3);
        if (padding < 3) {
            result = result.slice(0, -padding) + "=".repeat(padding);
        }

        // Conversion complete

        return result;
    } catch (error) {
        error("Error in direct base64 conversion", error);
        throw error;
    }
}

/**
 * Fallback base64 conversion using btoa() with chunked processing
 * Used as a backup if the direct method fails
 */
export function uint8ArrayToBase64Fallback(uint8Array: Uint8Array): string {
    try {
        // Use a chunked approach to avoid memory issues with large arrays
        const chunkSize = 8192; // Process in 8KB chunks
        let binaryString = "";

        // Process in chunks to avoid memory issues

        for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.slice(i, i + chunkSize);
            let chunkString = "";

            // Convert chunk to string
            for (let j = 0; j < chunk.length; j++) {
                chunkString += String.fromCharCode(chunk[j]);
            }

            binaryString += chunkString;
        }

        // Binary string created

        // Convert to base64
        const base64Result = btoa(binaryString);

        // Conversion complete

        return base64Result;
    } catch (error) {
        error("Error in fallback base64 conversion", error);
        throw error;
    }
}

/**
 * Converts any buffer-like object to base64 string
 * Handles GLib.Bytes, ArrayBuffer, and Uint8Array
 */
export function bufferToBase64(
    buffer: BufferLike | ArrayBuffer | Uint8Array,
): string {
    try {
        let uint8Array: Uint8Array;

        // Handle different buffer types
        if (buffer instanceof ArrayBuffer) {
            uint8Array = new Uint8Array(buffer);
        } else if (buffer instanceof Uint8Array) {
            uint8Array = buffer;
        } else if (
            buffer &&
            typeof buffer === "object" &&
            "length" in buffer &&
            buffer.length > 0
        ) {
            // Handle GLib.Bytes data (which might be a special array-like object)
            uint8Array = new Uint8Array(buffer.length);
            for (let i = 0; i < buffer.length; i++) {
                uint8Array[i] = (buffer as BufferLike)[i];
            }
        } else {
            // Unknown buffer type, returning empty string
            return "";
        }

        // Try the direct method first (more reliable)
        try {
            return uint8ArrayToBase64(uint8Array);
        } catch (_directError) {
            // Direct conversion failed, try fallback

            // Try the fallback method
            try {
                return uint8ArrayToBase64Fallback(uint8Array);
            } catch (fallbackError) {
                // Fallback failed too

                // Last resort: try simple conversion for small arrays
                if (uint8Array.length <= 1024) {
                    try {
                        // Try simple conversion for small array
                        let binaryString = "";
                        for (let i = 0; i < uint8Array.length; i++) {
                            binaryString += String.fromCharCode(uint8Array[i]);
                        }
                        return btoa(binaryString);
                    } catch (_simpleError) {
                        // Simple conversion also failed
                    }
                }

                throw fallbackError;
            }
        }
    } catch (error) {
        error("Error converting buffer to base64", error);
        return "";
    }
}

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
 * Simple hash function for content deduplication
 */
export function simpleHash(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();

    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16);
}

/**
 * Calculates comprehensive clipboard metadata for an event
 * Used by both clipboard manager and DBUS service
 */
export function calculateClipboardMetadata(event: {
    content: string;
    source: string;
}) {
    const content = event.content;
    let mimeType = "text/plain";
    let contentType = "text";
    let contentHash = "";
    let size = 0;
    const sourceApp = getFocusedWindowApp();

    // Determine content type and MIME type
    if (event.source === "image") {
        contentType = "image";
        if (content.startsWith("data:image/")) {
            const match = content.match(/^data:(image\/[^;]+);/);
            mimeType = match ? match[1] : "image/png";
        }
        // Calculate hash for image data
        contentHash = simpleHash(content);
        size = content.length;
    } else if (content.startsWith("data:")) {
        // Handle other data URLs
        const match = content.match(/^data:([^;]+);/);
        mimeType = match ? match[1] : "application/octet-stream";
        contentType = "binary";
        contentHash = simpleHash(content);
        size = content.length;
    } else {
        // Text content
        mimeType = "text/plain";
        contentType = "text";
        contentHash = simpleHash(content);
        size = content.length;

        // Check if it looks like HTML
        if (
            content.includes("<") &&
            content.includes(">") &&
            (content.includes("<html") ||
                content.includes("<div") ||
                content.includes("<p"))
        ) {
            mimeType = "text/html";
            contentType = "html";
        }

        // Check if it looks like a file path
        if (
            content.includes("/") &&
            (content.includes(".") || content.includes("~"))
        ) {
            contentType = "file";
        }
    }

    return {
        mimeType,
        contentType,
        contentHash,
        size,
        sourceApp,
    };
}
