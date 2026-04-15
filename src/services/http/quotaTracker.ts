import type { QuotaSnapshot } from "@/services/providers/OddsProvider";

type Listener = (snapshot: QuotaSnapshot) => void;

export interface QuotaTracker {
  readonly providerId: string;
  readonly label: string;
  readonly capacity: number | null;
  snapshot(): QuotaSnapshot;
  observeHeaders(headers: Headers | Record<string, string>): void;
  /** Record a client-side consumed request when the server emits no header. */
  recordRequest(): void;
  /** Patch the snapshot from a persisted row (used to rehydrate at boot). */
  hydrate(partial: Partial<QuotaSnapshot>): void;
  reset(): void;
  subscribe(listener: Listener): () => void;
}

export interface QuotaHeaderMap {
  remaining: string[];
  used: string[];
  reset: string[];
  /** If true, reset is interpreted as unix epoch seconds; else as ISO-8601. */
  resetIsEpoch: boolean;
}

export interface CreateQuotaTrackerOpts {
  providerId: string;
  label?: string;
  capacity?: number | null;
  headerMap?: Partial<QuotaHeaderMap>;
}

const DEFAULT_HEADER_MAP: QuotaHeaderMap = {
  remaining: ["x-requests-remaining", "x-ratelimit-remaining"],
  used: ["x-requests-used", "x-ratelimit-used"],
  reset: ["x-requests-reset", "x-ratelimit-reset"],
  resetIsEpoch: true,
};

const readHeader = (
  headers: Headers | Record<string, string>,
  keys: string[],
): string | null => {
  if (headers instanceof Headers) {
    for (const k of keys) {
      const v = headers.get(k);
      if (v !== null && v !== undefined) return v;
    }
    return null;
  }
  const lowered: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lowered[k.toLowerCase()] = v;
  for (const k of keys) {
    const v = lowered[k.toLowerCase()];
    if (v !== undefined) return v;
  }
  return null;
};

const parseReset = (raw: string, isEpoch: boolean): string | null => {
  if (isEpoch) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return new Date(n * 1000).toISOString();
  }
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
};

export const createQuotaTracker = (opts: CreateQuotaTrackerOpts): QuotaTracker => {
  const headerMap: QuotaHeaderMap = {
    ...DEFAULT_HEADER_MAP,
    ...opts.headerMap,
  };
  const capacity = opts.capacity ?? null;
  const label = opts.label ?? opts.providerId;

  let state: QuotaSnapshot = {
    remaining: null,
    used: null,
    resetAt: null,
    lastSyncedAt: null,
  };
  const listeners = new Set<Listener>();
  const emit = () => listeners.forEach((l) => l(state));

  return {
    providerId: opts.providerId,
    label,
    capacity,
    snapshot: () => state,
    observeHeaders(headers) {
      const remainingRaw = readHeader(headers, headerMap.remaining);
      const usedRaw = readHeader(headers, headerMap.used);
      const resetRaw = readHeader(headers, headerMap.reset);
      const remaining = remainingRaw !== null ? Number(remainingRaw) : null;
      const used = usedRaw !== null ? Number(usedRaw) : null;
      const resetAt = resetRaw !== null ? parseReset(resetRaw, headerMap.resetIsEpoch) : null;
      if (remaining === null && used === null && resetAt === null) return;
      state = {
        remaining: Number.isFinite(remaining) ? remaining : state.remaining,
        used: Number.isFinite(used) ? used : state.used,
        resetAt: resetAt ?? state.resetAt,
        lastSyncedAt: new Date().toISOString(),
      };
      emit();
    },
    recordRequest() {
      if (state.remaining !== null && state.remaining > 0) {
        state = {
          ...state,
          remaining: state.remaining - 1,
          used: (state.used ?? 0) + 1,
          lastSyncedAt: new Date().toISOString(),
        };
        emit();
        return;
      }
      if (state.remaining === null && capacity !== null) {
        state = {
          ...state,
          remaining: capacity - 1,
          used: (state.used ?? 0) + 1,
          lastSyncedAt: new Date().toISOString(),
        };
        emit();
      }
    },
    hydrate(partial) {
      state = { ...state, ...partial };
      emit();
    },
    reset() {
      state = { remaining: null, used: null, resetAt: null, lastSyncedAt: null };
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
  };
};

export const oddsApiQuota = createQuotaTracker({
  providerId: "the-odds-api",
  label: "the-odds-api",
  capacity: 500,
  headerMap: {
    remaining: ["x-requests-remaining"],
    used: ["x-requests-used"],
    reset: ["x-requests-reset"],
    resetIsEpoch: true,
  },
});

export const oddsApiIoQuota = createQuotaTracker({
  providerId: "odds-api-io",
  label: "odds-api.io",
  capacity: 100,
  headerMap: {
    remaining: ["x-ratelimit-remaining", "x-requests-remaining"],
    used: ["x-ratelimit-used", "x-requests-used"],
    reset: ["x-ratelimit-reset", "x-requests-reset"],
    resetIsEpoch: true,
  },
});
