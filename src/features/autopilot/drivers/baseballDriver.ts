// Baseball autopilot driver (MLB pitcher-strikeout props). Logic moved verbatim
// from the original useAutopilot.ts: analyze posted-lineup games and log their
// threshold plays; capture the Bet365 close ~10 min before first pitch; settle
// from the final box-score strikeout count. All work is best-effort.

import type { Bet } from "@/domain/bet";
import { BetId, BookId, LeagueId, MatchId } from "@/domain/ids";
import { selectionKey } from "@/domain/market";
import { getSportModule } from "@/sports";
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
import { closeWindowReached, gradeKs, isAutopilotBet } from "../autopilotEngine";
import { autopilotRepo } from "../autopilotRepo";
import type { AutopilotDriver, AutopilotDriverCtx } from "./types";

const BASEBALL = "baseball";
const ANALYZE_COOLDOWN_MS = 30 * 60_000;

const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const lookupProps = (props: EventPitcherProps, player: string) =>
  props.get(normalizeName(player));

const analyzeAndLog = async ({ nowMs, push }: AutopilotDriverCtx): Promise<void> => {
  const sport = getSportModule(BASEBALL);
  const sources = sport.fixtureSources();
  const slate = (await Promise.all(sources.map((s) => s.fetch().catch(() => [])))).flat();
  if (slate.length === 0) return;

  const lineupMap = await fetchMlbLineupStatus().catch(() => null);
  if (!lineupMap) return;

  const allBets = await betsRepo.list({ limit: 1000 });
  const betKeys = new Set(allBets.map((b) => `${b.matchId}|${selectionKey(b.selection)}`));
  const seen = await autopilotRepo.loadSeen();
  const unit = (await bankrollRepo.loadSettings()).unitValueMinor;

  for (const match of slate) {
    const gamePk = Number(match.catalogId);
    if (lineupMap.get(String(gamePk)) !== true) continue;
    if (nowMs - (seen[`${BASEBALL}:${gamePk}`] ?? 0) < ANALYZE_COOLDOWN_MS) continue;

    const result = await sport.analyze({ match, forceRefresh: false }).catch(() => null);
    await autopilotRepo.markSeen(`${BASEBALL}:${gamePk}`, nowMs).catch(() => {});
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

const captureAndSettle = async ({ nowMs, push }: AutopilotDriverCtx): Promise<number> => {
  const open = (await betsRepo.list({ status: "OPEN", limit: 1000 })).filter(isAutopilotBet);
  if (open.length === 0) return 0;

  const settings = await settingsStore.load();
  const apiKey = settings.oddsApiIoKey ?? "";
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

    if (timing.state === "final") {
      const ks = await getPitcherFinalKs(ref.gamePk, ref.playerId).catch(() => undefined);
      if (ks === undefined) continue;
      const status = gradeKs(bet.selection.side, bet.selection.line ?? 0, ks);
      await settleBetCore(bet, status, { actualResult: ks });
      push("settle", `Settled ${bet.selection.player} ${status} (${ks}K vs ${bet.selection.line})`);
      continue;
    }

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

export const baseballDriver: AutopilotDriver = {
  sportId: BASEBALL,
  label: "MLB",
  analyzeAndLog,
  captureAndSettle,
};
