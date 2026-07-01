// Tiny settings-table-backed persistence for the autopilot: the on/off flag
// (so the mode survives a reload) and a per-game "last analyzed" map (so the
// loop re-analyzes a posted-lineup game at most once per cooldown instead of
// every tick). Both live under their own settings keys; no migration needed.

import { getStorage } from "@/storage";

const CONFIG_KEY = "autopilot:config";
const SEEN_KEY = "autopilot:seen";

export interface AutopilotConfig {
  /** Master switch. */
  enabled: boolean;
  /** Per-sport execution toggles. Missing key = enabled (opt-out model). */
  sports?: Record<string, boolean>;
}

const DEFAULT_CONFIG: AutopilotConfig = { enabled: false, sports: {} };

/** A sport driver runs unless explicitly toggled off. */
export const isSportEnabled = (cfg: AutopilotConfig, sportId: string): boolean =>
  cfg.sports?.[sportId] !== false;

const readJson = async <T>(key: string, fallback: T): Promise<T> => {
  const db = await getStorage();
  const rows = await db.select<{ value_json: string }>(
    "SELECT value_json FROM settings WHERE key = ?",
    [key],
  );
  if (!rows[0]) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(rows[0].value_json) as Partial<T>) };
  } catch {
    return fallback;
  }
};

const writeJson = async (key: string, value: unknown): Promise<void> => {
  const db = await getStorage();
  await db.execute(
    "INSERT INTO settings(key, value_json, updated_at) VALUES(?, ?, ?) " +
      "ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at",
    [key, JSON.stringify(value), new Date().toISOString()],
  );
};

export const autopilotRepo = {
  loadConfig: (): Promise<AutopilotConfig> => readJson(CONFIG_KEY, DEFAULT_CONFIG),

  saveConfig: (cfg: AutopilotConfig): Promise<void> => writeJson(CONFIG_KEY, cfg),

  /** sport-prefixed event key -> last-analyzed epoch ms. */
  loadSeen: (): Promise<Record<string, number>> =>
    readJson<Record<string, number>>(SEEN_KEY, {}),

  async markSeen(key: string, atMs: number): Promise<void> {
    const seen = await this.loadSeen();
    seen[key] = atMs;
    await writeJson(SEEN_KEY, seen);
  },
};
