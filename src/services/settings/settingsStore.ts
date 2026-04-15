import { z } from "zod";
import { LazyStore } from "@tauri-apps/plugin-store";
import { isTauri } from "@/services/http/environment";
import { LEAGUES } from "@/config/leagues";

const STORE_FILE = "z-source.settings.json";

const settingsSchema = z.object({
  oddsApiKey: z.string().nullable(),
  enabledLeagueIds: z.array(z.string()),
  catalogProvider: z.literal("sofascore"),
  oddsRegion: z.enum(["us", "uk", "eu", "au"]),
});

export type AppSettings = z.infer<typeof settingsSchema>;

const defaults = (): AppSettings => ({
  oddsApiKey: null,
  enabledLeagueIds: LEAGUES.filter((l) => l.defaultEnabled).map((l) => String(l.id)),
  catalogProvider: "sofascore",
  oddsRegion: "eu",
});

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
      const parsed = settingsSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : defaults();
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
      const parsed = settingsSchema.safeParse(stored);
      return parsed.success ? parsed.data : defaults();
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
