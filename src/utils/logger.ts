type LogType = string | string[] | number | object;

export const logger = (message: LogType) => {
    console.log(`gnomext: ${message}`);
};
