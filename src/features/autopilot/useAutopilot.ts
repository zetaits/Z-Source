// Autopilot loop: while enabled and the app is open, it runs one tick per
// minute that (A) analyzes MLB games whose lineups are posted and logs the
// threshold plays as bets, (B) records a fresh Bet365 snapshot for open bets in
// the closing-line window so CLV becomes measurable, and (C) auto-settles bets
// whose game is final from the box-score strikeout count. All work is
// best-effort: a failed fetch just retries next tick. Effectful by nature; the
// pure grading/timing helpers live in autopilotEngine.ts.

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Bet } from "@/domain/bet";
import { BetId, BookId, LeagueId, MatchId } from "@/domain/ids";
import { selectionKey } from "@/domain/market";
import { getSportModule } from "@/sports";
import { isPersistentStorage } from "@/storage";
import { betsRepo } from "@/storage/repos/betsRepo";
import { bankrollRepo } from "@/storage/repos/bankrollRepo";
import { pickOutcomesRepo } from "@/storage/repos/pickOutcomesRepo";
import { snapshotsRepo } from "@/storage/repos/snapshotsRepo";
import { settingsStore } from "@/services/settings/settingsStore";
import { settleBetCore } from "@/features/bankroll/settleBet";
import { fetchMlbLineupStatus } from "@/sports/baseball/statsapiData";
import {
  fetchPitcherProps,
  normalizeName,
  type EventPitcherProps,
} from "@/sports/baseball/oddsProps";
import { getGameTiming, getPitcherFinalKs } from "@/sports/baseball/gameResult";
import { BASEBALL_KS_BOOK } from "@/sports/baseball/analyze";
import {
  closeWindowReached,
  gradeKs,
  isAutopilotBet,
} from "./autopilotEngine";
import { autopilotRepo } from "./autopilotRepo";

const BASEBALL = "baseball";
const TICK_MS = 60_000;
// Re-analyze a posted-lineup game at most this often (lineups/props firm up
// over time, but every-tick re-analysis would hammer the free feeds).
const ANALYZE_COOLDOWN_MS = 30 * 60_000;
const MAX_EVENTS = 40;

export type AutopilotEventKind = "log" | "close" | "settle" | "info" | "error";

export interface AutopilotEvent {
  at: string;
  kind: AutopilotEventKind;
  message: string;
}

export interface AutopilotStatus {
  /** A tick is currently in flight. */
  running: boolean;
  lastTickAt?: string;
  /** Open autopilot-managed bets being watched for close/settle. */
  watching: number;
  events: AutopilotEvent[];
}

const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const lookupProps = (props: EventPitcherProps, player: string) => {
  const key = normalizeName(player);
  return props.get(key);
};

/** Phase A — analyze posted-lineup games and log their threshold plays. */
const analyzeAndLog = async (
  nowMs: number,
  push: (k: AutopilotEventKind, m: string) => void,
): Promise<void> => {
  const sport = getSportModule(BASEBALL);
  const sources = sport.fixtureSources();
  const slate = (
    await Promise.all(sources.map((s) => s.fetch().catch(() => [])))
  ).flat();
  if (slate.length === 0) return;

  const lineupMap = await fetchMlbLineupStatus().catch(() => null);
  if (!lineupMap) return;

  const allBets = await betsRepo.list({ limit: 1000 });
  const betKeys = new Set(
    allBets.map((b) => `${b.matchId}|${selectionKey(b.selection)}`),
  );
  const seen = await autopilotRepo.loadSeen();
  const unit = (await bankrollRepo.loadSettings()).unitValueMinor;

  for (const match of slate) {
    const gamePk = Number(match.catalogId);
    if (lineupMap.get(String(gamePk)) !== true) continue;
    if (nowMs - (seen[String(gamePk)] ?? 0) < ANALYZE_COOLDOWN_MS) continue;

    const result = await sport.analyze({ match, forceRefresh: false }).catch(() => null);
    await autopilotRepo.markSeen(gamePk, nowMs).catch(() => {});
    if (!result || result.status !== "ok") continue;

    for (const play of result.plays) {
      if (!(play.stakeUnits > 0)) continue;
      const key = `${play.matchId}|${selectionKey(play.selection)}`;
      if (betKeys.has(key)) continue;

      const bet: Bet = {
        id: BetId(uid()),
        placedAt: new Date().toISOString(),
        matchId: play.matchId,
        leagueId: LeagueId(String(match.leagueId)),
        marketKey: "PITCHER_KS",
        selection: play.selection,
        priceDecimal: play.price.decimal,
        book: BookId(String(play.price.book)),
        stakeUnits: play.stakeUnits,
        stakeMinor: Math.round(play.stakeUnits * unit),
        status: "OPEN",
        notes: "autopilot",
        playSnapshot: play,
      };
      await betsRepo.insert(bet);
      await pickOutcomesRepo.insertFromPlay(play, bet.leagueId, bet.id).catch(() => {});
      betKeys.add(key);
      const line = play.selection.line ?? "";
      push("log", `Logged ${play.selection.player} ${play.selection.side} ${line}K @ ${play.price.decimal}`);
    }
  }
};

/** Phases B + C — closing-line snapshots and auto-settle for open bets. */
const captureAndSettle = async (
  nowMs: number,
  push: (k: AutopilotEventKind, m: string) => void,
): Promise<number> => {
  const open = (await betsRepo.list({ status: "OPEN", limit: 1000 })).filter(isAutopilotBet);
  if (open.length === 0) return 0;

  const settings = await settingsStore.load();
  const apiKey = settings.oddsApiIoKey ?? "";
  // Closing snapshot is the Bet365 price we actually bet — the bet book only.
  const propsCache = new Map<string, EventPitcherProps>();
  const eventProps = async (eventId: string): Promise<EventPitcherProps> => {
    const hit = propsCache.get(eventId);
    if (hit) return hit;
    const fetched = apiKey
      ? await fetchPitcherProps({ eventId, apiKey, books: [BASEBALL_KS_BOOK] }).catch(() => new Map())
      : new Map();
    propsCache.set(eventId, fetched as EventPitcherProps);
    return fetched as EventPitcherProps;
  };

  for (const bet of open) {
    const ref = bet.playSnapshot?.settleRef;
    if (!ref) continue;
    const timing = await getGameTiming(ref.gamePk, ref.date).catch(() => undefined);
    if (!timing) continue;

    // Phase C — game final: settle from the realised K count.
    if (timing.state === "final") {
      const ks = await getPitcherFinalKs(ref.gamePk, ref.playerId).catch(() => undefined);
      if (ks === undefined) continue; // box score not posted yet — retry next tick
      const status = gradeKs(bet.selection.side, bet.selection.line ?? 0, ks);
      await settleBetCore(bet, status, { actualResult: ks });
      push("settle", `Settled ${bet.selection.player} ${status} (${ks}K vs ${bet.selection.line})`);
      continue;
    }

    // Phase B — in the closing window: record the current Bet365 price so the
    // settle-time latestFor() has a real "close" to compare entry against.
    if (bet.selection.line === undefined) continue;
    if (!closeWindowReached(timing.startTime, nowMs)) continue;
    const props = await eventProps(String(bet.matchId));
    const pp = bet.selection.player ? lookupProps(props, bet.selection.player) : undefined;
    const ks = pp?.ksLines.find((l) => l.line === bet.selection.line);
    if (!ks) continue;
    const price = bet.selection.side === "over" ? ks.overDec : ks.underDec;
    if (!(price > 0)) continue;
    await snapshotsRepo
      .recordOffer({
        matchId: MatchId(String(bet.matchId)),
        marketKey: "PITCHER_KS",
        selection: bet.selection,
        priceDecimal: price,
        book: BookId("Bet365"),
        isOpener: false,
      })
      .then(() => push("close", `Close snapshot ${bet.selection.player} @ ${price}`))
      .catch(() => {});
  }

  return open.length;
};

export interface UseAutopilot {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  status: AutopilotStatus;
  /** Force a tick now (ignores the interval). */
  runNow: () => void;
}

export const useAutopilot = (): UseAutopilot => {
  const qc = useQueryClient();
  const [enabled, setEnabledState] = useState(false);
  const [status, setStatus] = useState<AutopilotStatus>({
    running: false,
    watching: 0,
    events: [],
  });
  const tickingRef = useRef(false);

  // Restore the persisted on/off flag on mount.
  useEffect(() => {
    if (!isPersistentStorage()) return;
    void autopilotRepo.loadConfig().then((c) => setEnabledState(c.enabled));
  }, []);

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on);
    if (isPersistentStorage()) void autopilotRepo.saveConfig({ enabled: on });
  }, []);

  const tick = useCallback(async () => {
    if (tickingRef.current || !isPersistentStorage()) return;
    tickingRef.current = true;
    const events: AutopilotEvent[] = [];
    const push = (kind: AutopilotEventKind, message: string) =>
      events.push({ at: new Date().toISOString(), kind, message });
    setStatus((s) => ({ ...s, running: true }));
    let watching = 0;
    try {
      const nowMs = Date.now();
      await analyzeAndLog(nowMs, push);
      watching = await captureAndSettle(nowMs, push);
    } catch (err) {
      push("error", err instanceof Error ? err.message : String(err));
    } finally {
      tickingRef.current = false;
      if (events.length > 0) {
        // Bet/bankroll/CLV views all change when the autopilot acts.
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

  // Drive the loop while enabled. Runs an immediate tick on enable, then every
  // TICK_MS until disabled/unmounted.
  useEffect(() => {
    if (!enabled || !isPersistentStorage()) return;
    void tick();
    const id = setInterval(() => void tick(), TICK_MS);
    return () => clearInterval(id);
  }, [enabled, tick]);

  return { enabled, setEnabled, status, runNow: () => void tick() };
};
