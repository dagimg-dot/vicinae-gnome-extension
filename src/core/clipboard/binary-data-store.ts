import type { BufferLike } from "./types.js";

/**
 * In-memory store for binary clipboard data that cannot be represented as
 * plain text (images, files, etc.). Data is keyed by a content marker string
 * and survives until explicitly cleared or the extension is disabled.
 */
export class BinaryDataStore {
    private store = new Map<string, { data: BufferLike; mimeType: string }>();

    has(marker: string): boolean {
        return this.store.has(marker);
    }

    get(marker: string): { data: BufferLike; mimeType: string } | null {
        const entry = this.store.get(marker);
        return entry || null;
    }

    set(marker: string, data: BufferLike, mimeType: string): void {
        this.store.set(marker, { data, mimeType });
    }

    delete(marker: string): void {
        this.store.delete(marker);
    }

    clear(): void {
        this.store.clear();
    }

    get size(): number {
        return this.store.size;
    }
}
