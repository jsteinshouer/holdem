export type LogLevel = "info" | "warn" | "error";

export type LogContext = Record<string, string | number | boolean | null | undefined>;

export type Logger = {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
};

export function createLogger(service: string): Logger {
  return {
    info: (message, context) => writeLog("info", service, message, context),
    warn: (message, context) => writeLog("warn", service, message, context),
    error: (message, context) => writeLog("error", service, message, context)
  };
}

function writeLog(level: LogLevel, service: string, message: string, context: LogContext = {}): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service,
    message,
    ...dropUndefined(context)
  };

  const output = JSON.stringify(entry);

  if (level === "error") {
    console.error(output);
    return;
  }

  if (level === "warn") {
    console.warn(output);
    return;
  }

  console.log(output);
}

function dropUndefined(context: LogContext): LogContext {
  return Object.fromEntries(Object.entries(context).filter(([, value]) => value !== undefined));
}
