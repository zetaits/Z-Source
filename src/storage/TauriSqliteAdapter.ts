import Database from "@tauri-apps/plugin-sql";
import type { SqlParam, StorageAdapter } from "./StorageAdapter";

const DB_URL = "sqlite:z-source.db";

export class TauriSqliteAdapter implements StorageAdapter {
  readonly kind = "tauri-sqlite" as const;
  private db: Database | null = null;
  private loading: Promise<Database> | null = null;

  async init(): Promise<void> {
    await this.getDb();
  }

  private getDb(): Promise<Database> {
    if (this.db) return Promise.resolve(this.db);
    if (!this.loading) {
      this.loading = Database.load(DB_URL).then((d) => {
        this.db = d;
        return d;
      });
    }
    return this.loading;
  }

  async select<T = Record<string, unknown>>(sql: string, params: SqlParam[] = []): Promise<T[]> {
    const db = await this.getDb();
    return db.select<T[]>(sql, params);
  }

  async execute(sql: string, params: SqlParam[] = []): Promise<{ rowsAffected: number; lastInsertId?: number }> {
    const db = await this.getDb();
    const r = await db.execute(sql, params);
    return { rowsAffected: r.rowsAffected, lastInsertId: r.lastInsertId };
  }
}
