export type SqlParam = string | number | boolean | null;

export interface StorageAdapter {
  readonly kind: "tauri-sqlite" | "web-local";
  init(): Promise<void>;
  select<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T[]>;
  execute(sql: string, params?: SqlParam[]): Promise<{ rowsAffected: number; lastInsertId?: number }>;
}

export class StorageUnavailableError extends Error {
  constructor(op: string) {
    super(`Storage op '${op}' is unavailable in this environment. Run via tauri:dev for full persistence.`);
    this.name = "StorageUnavailableError";
  }
}
