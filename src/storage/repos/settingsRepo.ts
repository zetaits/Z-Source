import { getStorage } from "@/storage";

export const settingsRepo = {
  async get<T>(key: string): Promise<T | null> {
    const db = await getStorage();
    const rows = await db.select<{ value_json: string }>(
      "SELECT value_json FROM settings WHERE key = ?",
      [key],
    );
    if (!rows[0]) return null;
    try {
      return JSON.parse(rows[0].value_json) as T;
    } catch {
      return null;
    }
  },

  async set<T>(key: string, value: T): Promise<void> {
    const db = await getStorage();
    await db.execute(
      "INSERT INTO settings(key, value_json, updated_at) VALUES(?, ?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at",
      [key, JSON.stringify(value), new Date().toISOString()],
    );
  },

  async delete(key: string): Promise<void> {
    const db = await getStorage();
    await db.execute("DELETE FROM settings WHERE key = ?", [key]);
  },
};
