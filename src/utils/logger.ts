import type Gio from "gi://Gio";

const PROJECT_NAME = "Vicinae";

export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
}

const stringToLogLevel = (level: string): LogLevel => {
    switch (level.toLowerCase()) {
        case "error":
            return LogLevel.ERROR;
        case "warn":
            return LogLevel.WARN;
        case "info":
            return LogLevel.INFO;
        case "debug":
            return LogLevel.DEBUG;
        default:
            return LogLevel.INFO; // Default fallback
    }
};

// Global settings reference for logger
let currentLogLevel: LogLevel = LogLevel.INFO;

// Initialize logger with settings
export const initializeLogger = (settings: Gio.Settings) => {
    // Set initial log level
    const levelString = settings.get_string("logging-level");
    currentLogLevel = stringToLogLevel(levelString);

    // Listen for log level changes
    settings.connect("changed::logging-level", () => {
        const newLevelString = settings.get_string("logging-level");
        currentLogLevel = stringToLogLevel(newLevelString);
        log(LogLevel.INFO, `Log level changed to: ${newLevelString}`);
    });

    log(LogLevel.INFO, `Logger initialized with level: ${levelString}`);
};

// Single write function — all console output routes through here
const write = (prefix: string, message: string, data?: unknown) => {
    const lines = [`${prefix}: ${message}`];
    if (data) {
        if (typeof data === "object" && data !== null) {
            Object.entries(data).forEach(([key, value]) => {
                lines.push(`${prefix}:   ${key}: ${value}`);
            });
        } else {
            lines.push(`${prefix}: ${data}`);
        }
    }
    console.log(lines.join("\n"));
};

const log = (level: LogLevel, message: string, data?: unknown) => {
    if (level > currentLogLevel) return;

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const prefix = `[${PROJECT_NAME}] ${timestamp} ${levelName}`;
    write(prefix, message, data);
};

const debug = (message: string, data?: unknown) => {
    log(LogLevel.DEBUG, message, data);
};

const info = (message: string, data?: unknown) => {
    log(LogLevel.INFO, message, data);
};

const warn = (message: string, data?: unknown) => {
    log(LogLevel.WARN, message, data);
};

const error = (message: string, error?: unknown) => {
    const timestamp = new Date().toISOString();
    const prefix = `[${PROJECT_NAME}] ${timestamp} ERROR`;
    write(prefix, message, error ? String(error) : undefined);
};

export const logger = {
    debug,
    info,
    warn,
    error,
};
