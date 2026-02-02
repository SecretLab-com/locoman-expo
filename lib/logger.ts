export type LogContext = Record<string, unknown>;

function formatContext(context?: LogContext) {
  return context ? { ...context } : undefined;
}

export function logEvent(event: string, context?: LogContext) {
  const ctx = formatContext(context);
  if (ctx) {
    console.info("[event]", event, ctx);
  } else {
    console.info("[event]", event);
  }
}

export function logWarn(event: string, context?: LogContext) {
  const ctx = formatContext(context);
  if (ctx) {
    console.warn("[warn]", event, ctx);
  } else {
    console.warn("[warn]", event);
  }
}

export function logError(event: string, error: unknown, context?: LogContext) {
  const ctx = formatContext(context);
  if (ctx) {
    console.error("[error]", event, error, ctx);
  } else {
    console.error("[error]", event, error);
  }
}
