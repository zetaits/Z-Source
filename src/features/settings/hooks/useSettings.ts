import { useEffect, useState } from "react";
import { settingsStore, type AppSettings } from "@/services/settings/settingsStore";

export interface UseSettings {
  data: AppSettings | null;
  loading: boolean;
  update(patch: Partial<AppSettings>): Promise<void>;
}

export const useSettings = (): UseSettings => {
  const [data, setData] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    settingsStore.load().then((s) => {
      if (mounted) {
        setData(s);
        setLoading(false);
      }
    });
    const unsubscribe = settingsStore.subscribe((s) => {
      if (mounted) setData(s);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return {
    data,
    loading,
    async update(patch) {
      await settingsStore.update(patch);
    },
  };
};
