export type LogContext = Record<string, unknown>;

function formatContext(context?: LogContext) {
  return context ? { ...context } : undefined;
}

function isAbortLikeError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { name?: unknown; message?: unknown };
  const name = typeof maybeError.name === "string" ? maybeError.name : "";
  const message = typeof maybeError.message === "string" ? maybeError.message : "";
  return name === "AbortError" || /abort(ed|error)/i.test(message);
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
  if (isAbortLikeError(error)) {
    if (ctx) {
      console.info("[info]", `${event}.aborted`, ctx);
    } else {
      console.info("[info]", `${event}.aborted`);
    }
    return;
  }
  if (ctx) {
    console.error("[error]", event, error, ctx);
  } else {
    console.error("[error]", event, error);
  }
}
