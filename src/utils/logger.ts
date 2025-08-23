const PROJECT_NAME = "Vicinae";

export const logger = (message: string, data?: unknown) => {
    const timestamp = new Date().toISOString();
    const prefix = `[${PROJECT_NAME}] ${timestamp}`;

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

export const errorLogger = (message: string, error?: unknown) => {
    const timestamp = new Date().toISOString();
    const prefix = `[${PROJECT_NAME}] ${timestamp} ERROR`;

    if (error) {
        console.error(`${prefix}: ${message}`);
        console.error(`${prefix}: ${String(error)}`);
    } else {
        console.error(`${prefix}: ${message}`);
    }
};
