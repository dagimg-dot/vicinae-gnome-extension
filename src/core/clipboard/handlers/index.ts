import { FileHandler } from "./file-handler.js";
import { ImageHandler } from "./image-handler.js";
import { TextHandler } from "./text-handler.js";
import type { ClipboardContentHandler } from "./types.js";

export { FileHandler } from "./file-handler.js";
export { ImageHandler } from "./image-handler.js";
export { TextHandler } from "./text-handler.js";
export type {
    ClipboardContentHandler,
    ClipboardHandlerContext,
} from "./types.js";

/**
 * Creates content handlers. Context for binary storage is passed at capture time.
 */
export function createHandlers(): ClipboardContentHandler[] {
    return [new ImageHandler(), new FileHandler(), new TextHandler()];
}
