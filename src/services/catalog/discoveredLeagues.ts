import type { LeagueDef } from "@/config/leagues";

// Runtime store for leagues discovered from the odds provider's catalog (the
// universe of priceable competitions). Kept in its own module with no runtime
// import of `leagues.ts` so the static config and the registry finders in
// `leagues.ts` can read this without an import cycle (the LeagueDef import is
// type-only and erased at build time).

let discovered: LeagueDef[] = [];
let version = 0;
const listeners = new Set<() => void>();

const notify = (): void => {
  version += 1;
  for (const cb of listeners) cb();
};

/**
 * Replace the discovered set. Caller is responsible for having already removed
 * any entry that collides with a curated league (see `oddsApiIoLeagues`).
 */
export const registerDiscovered = (defs: LeagueDef[]): void => {
  discovered = defs;
  notify();
};

export const getDiscovered = (): readonly LeagueDef[] => discovered;

/** Monotonic counter; bump on every change. Drives `useSyncExternalStore`. */
export const discoveredVersion = (): number => version;

export const subscribeDiscovered = (cb: () => void): (() => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
