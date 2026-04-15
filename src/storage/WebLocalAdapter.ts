import type { SqlParam, StorageAdapter } from "./StorageAdapter";
import { StorageUnavailableError } from "./StorageAdapter";

export class WebLocalAdapter implements StorageAdapter {
  readonly kind = "web-local" as const;

  async init(): Promise<void> {
    // no-op: web mode does not persist a SQL store. Repos should check
    // `isPersistentStorage()` before issuing writes, or surface a graceful
    // "desktop required" state to the UI.
  }

  async select<T>(_sql: string, _params?: SqlParam[]): Promise<T[]> {
    return [];
  }

  async execute(_sql: string, _params?: SqlParam[]): Promise<{ rowsAffected: number; lastInsertId?: number }> {
    throw new StorageUnavailableError("execute");
  }
}
