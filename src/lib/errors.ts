// A thrown value is `unknown` — it can be a string, plain object or null, so
// (err as Error).message is unsafe. Narrow before reading.
export const errorMessage = (err: unknown, fallback = "Unknown error"): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
};
