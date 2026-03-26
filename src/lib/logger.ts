type LogLevel = "info" | "warn" | "error" | "debug";

function format(level: LogLevel, message: string, meta?: unknown): string {
  const payload = meta !== undefined ? ` ${JSON.stringify(meta)}` : "";
  return `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}${payload}`;
}

export const logger = {
  info(message: string, meta?: unknown): void {
    console.log(format("info", message, meta));
  },
  warn(message: string, meta?: unknown): void {
    console.warn(format("warn", message, meta));
  },
  error(message: string, meta?: unknown): void {
    console.error(format("error", message, meta));
  },
  debug(message: string, meta?: unknown): void {
    if (process.env.DEBUG === "1") {
      console.debug(format("debug", message, meta));
    }
  },
};
