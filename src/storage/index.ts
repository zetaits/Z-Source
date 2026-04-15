import { isTauri } from "@/services/http/environment";
import type { StorageAdapter } from "./StorageAdapter";
import { TauriSqliteAdapter } from "./TauriSqliteAdapter";
import { WebLocalAdapter } from "./WebLocalAdapter";

let adapter: StorageAdapter | null = null;
let initPromise: Promise<StorageAdapter> | null = null;

export const getStorage = async (): Promise<StorageAdapter> => {
  if (adapter) return adapter;
  if (!initPromise) {
    const a: StorageAdapter = isTauri() ? new TauriSqliteAdapter() : new WebLocalAdapter();
    initPromise = a.init().then(() => {
      adapter = a;
      return a;
    });
  }
  return initPromise;
};

export const isPersistentStorage = (): boolean => isTauri();

export type { StorageAdapter, SqlParam } from "./StorageAdapter";
export { StorageUnavailableError } from "./StorageAdapter";
