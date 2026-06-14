import { logger } from "./logger.js";

/**
 * Stores disconnect thunks for signal connections and runs them all on
 * disconnectAll(). Ensures no signal handler is missed during cleanup.
 *
 * Usage:
 *   const id = source.connect("signal", callback);
 *   registry.add(() => source.disconnect(id));
 *   // Later:
 *   registry.disconnectAll();
 */
export class SignalRegistry {
    private disconnectFns: Array<() => void> = [];

    add(fn: () => void): void {
        this.disconnectFns.push(fn);
    }

    disconnectAll(): void {
        for (const fn of this.disconnectFns) {
            try {
                fn();
            } catch (error) {
                logger.debug(`Error during signal cleanup: ${error}`);
            }
        }
        this.disconnectFns = [];
    }
}
