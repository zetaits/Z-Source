import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  DEFAULT_SPORT_ID,
  SPORTS,
  enabledSports,
  findSportById,
  type Sport,
} from "@/config/sports";

const STORAGE_KEY = "zs.activeSport.v1";

function loadSportId(): string {
  if (typeof window === "undefined") return DEFAULT_SPORT_ID;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const found = raw ? findSportById(raw) : undefined;
    // Only honour a stored sport that still exists and is selectable.
    return found && found.enabled ? found.id : DEFAULT_SPORT_ID;
  } catch {
    return DEFAULT_SPORT_ID;
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

interface Ctx {
  /** The active sport (always a real, selectable entry). */
  sport: Sport;
  activeSportId: string;
  /** Select a sport. Ignores parked (disabled) ids. */
  setSport: (id: string) => void;
  /** Cycle to the previous/next ENABLED sport (skips parked ones). */
  cycle: (dir: 1 | -1) => void;
}

const SportCtx = createContext<Ctx | null>(null);

export function SportProvider({ children }: { children: ReactNode }) {
  const [activeSportId, setActiveSportId] = useState<string>(() => loadSportId());

  const setSport = useCallback((id: string) => {
    const next = findSportById(id);
    if (!next || !next.enabled) return;
    setActiveSportId(next.id);
  }, []);

  const cycle = useCallback((dir: 1 | -1) => {
    const list = enabledSports();
    if (list.length === 0) return;
    setActiveSportId((curr) => {
      const idx = list.findIndex((s) => s.id === curr);
      const base = idx === -1 ? 0 : idx;
      const next = (base + dir + list.length) % list.length;
      return list[next].id;
    });
  }, []);

  // persist
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, activeSportId);
    } catch {
      /* ignore quota */
    }
  }, [activeSportId]);

  // keyboard: [ / ] cycle previous/next enabled sport (ignore when typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (e.key === "[") {
        e.preventDefault();
        cycle(-1);
      } else if (e.key === "]") {
        e.preventDefault();
        cycle(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycle]);

  const sport = useMemo<Sport>(
    () => findSportById(activeSportId) ?? findSportById(DEFAULT_SPORT_ID) ?? SPORTS[0],
    [activeSportId],
  );

  const ctx = useMemo<Ctx>(
    () => ({ sport, activeSportId: sport.id, setSport, cycle }),
    [sport, setSport, cycle],
  );

  return <SportCtx.Provider value={ctx}>{children}</SportCtx.Provider>;
}

export function useSport(): Ctx {
  const ctx = useContext(SportCtx);
  if (!ctx) throw new Error("useSport must be used inside <SportProvider>");
  return ctx;
}
