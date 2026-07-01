// Autopilot loop: while enabled and the app is open, it runs one tick per minute
// that, for every toggled-on sport driver, (A) analyzes the slate and logs
// threshold plays as bets, (B) records a fresh closing snapshot for open bets in
// the close window so CLV becomes measurable, and (C) auto-settles finished bets.
// Sport-specific work lives in drivers/*; this hook owns the loop, persistence,
// per-sport toggles and the activity feed. All work is best-effort.

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isPersistentStorage } from "@/storage";
import { AUTOPILOT_DRIVERS } from "./drivers";
import type { AutopilotEventKind } from "./drivers";
export type { AutopilotEventKind } from "./drivers";
import { autopilotRepo, isSportEnabled, type AutopilotConfig } from "./autopilotRepo";

const TICK_MS = 60_000;
const MAX_EVENTS = 60;

export interface AutopilotEvent {
  at: string;
  kind: AutopilotEventKind;
  /** Sport label the event belongs to (e.g. "MLB", "TENNIS"). */
  sport: string;
  message: string;
}

export interface AutopilotSportToggle {
  sportId: string;
  label: string;
  enabled: boolean;
}

export interface AutopilotStatus {
  running: boolean;
  lastTickAt?: string;
  /** Open autopilot-managed bets being watched for close/settle. */
  watching: number;
  events: AutopilotEvent[];
}

const DEFAULT_CONFIG: AutopilotConfig = { enabled: false, sports: {} };

export interface UseAutopilot {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  /** Per-sport execution toggles, one per registered driver. */
  sports: AutopilotSportToggle[];
  setSportEnabled: (sportId: string, on: boolean) => void;
  status: AutopilotStatus;
  runNow: () => void;
}

export const useAutopilot = (): UseAutopilot => {
  const qc = useQueryClient();
  const [config, setConfig] = useState<AutopilotConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<AutopilotStatus>({
    running: false,
    watching: 0,
    events: [],
  });
  const tickingRef = useRef(false);
  const configRef = useRef(config);
  configRef.current = config;

  // Restore persisted config on mount.
  useEffect(() => {
    if (!isPersistentStorage()) return;
    void autopilotRepo.loadConfig().then(setConfig);
  }, []);

  const persist = useCallback((next: AutopilotConfig) => {
    setConfig(next);
    if (isPersistentStorage()) void autopilotRepo.saveConfig(next);
  }, []);

  const setEnabled = useCallback(
    (on: boolean) => persist({ ...configRef.current, enabled: on }),
    [persist],
  );

  const setSportEnabled = useCallback(
    (sportId: string, on: boolean) =>
      persist({
        ...configRef.current,
        sports: { ...configRef.current.sports, [sportId]: on },
      }),
    [persist],
  );

  const tick = useCallback(async () => {
    if (tickingRef.current || !isPersistentStorage()) return;
    tickingRef.current = true;
    const cfg = configRef.current;
    const events: AutopilotEvent[] = [];
    setStatus((s) => ({ ...s, running: true }));
    let watching = 0;
    try {
      const nowMs = Date.now();
      for (const driver of AUTOPILOT_DRIVERS) {
        if (!isSportEnabled(cfg, driver.sportId)) continue;
        const push = (kind: AutopilotEventKind, message: string) =>
          events.push({ at: new Date().toISOString(), kind, message, sport: driver.label });
        try {
          await driver.analyzeAndLog({ nowMs, push });
          watching += await driver.captureAndSettle({ nowMs, push });
        } catch (err) {
          push("error", err instanceof Error ? err.message : String(err));
        }
      }
    } finally {
      tickingRef.current = false;
      if (events.length > 0) {
        void qc.invalidateQueries({ queryKey: ["bets"] });
        void qc.invalidateQueries({ queryKey: ["bankroll"] });
        void qc.invalidateQueries({ queryKey: ["clv"] });
      }
      setStatus((s) => ({
        running: false,
        lastTickAt: new Date().toISOString(),
        watching,
        events: [...events.reverse(), ...s.events].slice(0, MAX_EVENTS),
      }));
    }
  }, [qc]);

  // Drive the loop while enabled.
  useEffect(() => {
    if (!config.enabled || !isPersistentStorage()) return;
    void tick();
    const id = setInterval(() => void tick(), TICK_MS);
    return () => clearInterval(id);
  }, [config.enabled, tick]);

  const sports: AutopilotSportToggle[] = AUTOPILOT_DRIVERS.map((d) => ({
    sportId: d.sportId,
    label: d.label,
    enabled: isSportEnabled(config, d.sportId),
  }));

  return {
    enabled: config.enabled,
    setEnabled,
    sports,
    setSportEnabled,
    status,
    runNow: () => void tick(),
  };
};
