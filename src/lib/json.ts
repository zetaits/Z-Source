/**
 * JSON.parse that names its source on failure. Repos persist domain objects as
 * TEXT columns; a corrupt row otherwise throws a bare SyntaxError with no hint
 * of which column or row produced it. `context` is appended to the message.
 *
 * Validates JSON syntax only — the cast to T is unchecked.
 */
export const safeJsonParse = <T>(raw: string, context: string): T => {
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Corrupt JSON in ${context}: ${msg}`);
  }
};
