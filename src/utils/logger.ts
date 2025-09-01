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
let _globalSettings: Gio.Settings | null = null;
let currentLogLevel: LogLevel = LogLevel.INFO;

// Initialize logger with settings
export const initializeLogger = (settings: Gio.Settings) => {
    _globalSettings = settings;

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

const log = (level: LogLevel, message: string, data?: unknown) => {
    // Early return if log level is too low
    if (level > currentLogLevel) {
        return;
    }

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const prefix = `[${PROJECT_NAME}] ${timestamp} ${levelName}`;

    if (data) {
        console.log(`${prefix}: ${message}`);

        // Display each property individually to avoid GNOME Shell truncation
        if (typeof data === "object" && data !== null) {
            Object.entries(data).forEach(([key, value]) => {
                console.log(`${prefix}:   ${key}: ${value}`);
            });
        } else {
            console.log(`${prefix}: ${data}`);
        }
    } else {
        console.log(`${prefix}: ${message}`);
    }
};

// Public logging functions
export const debug = (message: string, data?: unknown) => {
    log(LogLevel.DEBUG, message, data);
};

export const info = (message: string, data?: unknown) => {
    log(LogLevel.INFO, message, data);
};

export const warn = (message: string, data?: unknown) => {
    log(LogLevel.WARN, message, data);
};

export const error = (message: string, error?: unknown) => {
    const timestamp = new Date().toISOString();
    const prefix = `[${PROJECT_NAME}] ${timestamp} ERROR`;

    if (error) {
        console.error(`${prefix}: ${message}`);
        console.error(`${prefix}: ${String(error)}`);
    } else {
        console.error(`${prefix}: ${message}`);
    }
};
