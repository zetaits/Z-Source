import { z } from "zod";
import { LazyStore } from "@tauri-apps/plugin-store";
import { isTauri } from "@/services/http/environment";
import { LEAGUES } from "@/config/leagues";

const STORE_FILE = "z-source.settings.json";

export const ODDS_PROVIDER_IDS = ["odds-api-io", "the-odds-api"] as const;
export type OddsProviderId = (typeof ODDS_PROVIDER_IDS)[number];

const oddsProviderIdSchema = z.enum(ODDS_PROVIDER_IDS);

export const SPLIT_PROVIDER_IDS = ["action-network"] as const;
export type SplitProviderId = (typeof SPLIT_PROVIDER_IDS)[number];

export const HISTORY_PROVIDER_IDS = ["sofascore"] as const;
export type HistoryProviderId = (typeof HISTORY_PROVIDER_IDS)[number];

const settingsSchema = z.object({
  oddsApiKey: z.string().nullable(),
  oddsApiIoKey: z.string().nullable(),
  enabledLeagueIds: z.array(z.string()),
  catalogProvider: z.literal("sofascore"),
  oddsRegion: z.enum(["us", "uk", "eu", "au"]),
  oddsProviderOrder: z.array(oddsProviderIdSchema).min(1),
  splitProviderId: z.enum(SPLIT_PROVIDER_IDS),
  historyProviderId: z.enum(HISTORY_PROVIDER_IDS),
});

export type AppSettings = z.infer<typeof settingsSchema>;

const DEFAULT_ODDS_ORDER: OddsProviderId[] = ["odds-api-io", "the-odds-api"];

const defaults = (): AppSettings => ({
  oddsApiKey: null,
  oddsApiIoKey: null,
  enabledLeagueIds: LEAGUES.filter((l) => l.defaultEnabled).map((l) => String(l.id)),
  catalogProvider: "sofascore",
  oddsRegion: "eu",
  oddsProviderOrder: [...DEFAULT_ODDS_ORDER],
  splitProviderId: "action-network",
  historyProviderId: "sofascore",
});

const migrate = (raw: unknown): AppSettings => {
  const coerced =
    raw && typeof raw === "object"
      ? { ...(raw as Record<string, unknown>) }
      : null;
  if (coerced) {
    const legacySplit = coerced.splitProviderId;
    if (
      legacySplit === "mock" ||
      legacySplit === "sbr" ||
      legacySplit === "fallback"
    ) {
      coerced.splitProviderId = "action-network";
    }
    if (coerced.historyProviderId === "mock") coerced.historyProviderId = "sofascore";
  }
  const input = coerced ?? raw;
  const parsed = settingsSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  if (!input || typeof input !== "object") return defaults();
  const merged = { ...defaults(), ...(input as Record<string, unknown>) };
  const fallback = settingsSchema.safeParse(merged);
  return fallback.success ? fallback.data : defaults();
};

const LS_KEY = "z-source.settings";

interface Backend {
  get(): Promise<AppSettings>;
  set(next: AppSettings): Promise<void>;
}

const localStorageBackend: Backend = {
  async get() {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return defaults();
      return migrate(JSON.parse(raw));
    } catch {
      return defaults();
    }
  },
  async set(next) {
    window.localStorage.setItem(LS_KEY, JSON.stringify(next));
  },
};

const tauriStoreBackend = (): Backend => {
  const store = new LazyStore(STORE_FILE);
  return {
    async get() {
      const stored = await store.get<unknown>("settings");
      return migrate(stored);
    },
    async set(next) {
      await store.set("settings", next);
      await store.save();
    },
  };
};

let backend: Backend | null = null;
const backendOf = (): Backend => {
  if (!backend) backend = isTauri() ? tauriStoreBackend() : localStorageBackend;
  return backend;
};

let cache: AppSettings | null = null;
const subscribers = new Set<(s: AppSettings) => void>();

export const settingsStore = {
  async load(): Promise<AppSettings> {
    cache = await backendOf().get();
    return cache;
  },
  get(): AppSettings {
    return cache ?? defaults();
  },
  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const current = cache ?? (await this.load());
    const next: AppSettings = { ...current, ...patch };
    const validated = settingsSchema.parse(next);
    await backendOf().set(validated);
    cache = validated;
    subscribers.forEach((cb) => cb(validated));
    return validated;
  },
  subscribe(listener: (s: AppSettings) => void): () => void {
    subscribers.add(listener);
    if (cache) listener(cache);
    return () => subscribers.delete(listener);
  },
};
