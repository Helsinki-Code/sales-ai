type LogPayload = Record<string, unknown> | Error | string | number | boolean | null | undefined;

function asSerializable(value: LogPayload): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

function log(level: "debug" | "info" | "warn" | "error", payload?: LogPayload, message?: string): void {
  const ts = new Date().toISOString();
  const body =
    typeof payload === "object" && payload !== null
      ? JSON.stringify(asSerializable(payload))
      : payload !== undefined
        ? String(payload)
        : "";

  const line = [ts, level.toUpperCase(), message ?? "", body].filter(Boolean).join(" ");
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export const logger = {
  debug: (payload?: LogPayload, message?: string) => log("debug", payload, message),
  info: (payload?: LogPayload, message?: string) => log("info", payload, message),
  warn: (payload?: LogPayload, message?: string) => log("warn", payload, message),
  error: (payload?: LogPayload, message?: string) => log("error", payload, message)
};
