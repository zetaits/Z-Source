// Tennis autopilot driver (ATP/WTA Match Winner). Logs threshold ML plays for
// upcoming main-draw singles, captures the Bet365 close ~10 min before start for
// CLV, and auto-settles from the odds-api.io /events result feed (winner by
// sets). v1 logs Match Winner only — Totals/Spread stay off until real serve
// stats land (they'd rest on league-average serve dominance). Best-effort: any
// failed fetch just retries next tick.

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
import { fetchTennisProps } from "@/sports/tennis/oddsProps";
import { fetchTennisResults, gradeTennisMl } from "@/sports/tennis/gameResult";
import { closeWindowReached } from "../autopilotEngine";
import { autopilotRepo } from "../autopilotRepo";
import type { AutopilotDriver, AutopilotDriverCtx } from "./types";

const TENNIS = "tennis";
const TENNIS_BET_BOOK = "Bet365";
const ML_MARKET = "ML_TENNIS";
// Only auto-log matches starting inside this lead window (capture the opening
// price early, snapshot the close later) and not yet started.
const LOG_LEAD_MS = 48 * 60 * 60_000;
const ANALYZE_COOLDOWN_MS = 30 * 60_000;

const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** Open, autopilot-logged tennis Match Winner bets. */
const isAutopilotTennisBet = (b: Bet): boolean =>
  b.notes === "autopilot" && b.marketKey === ML_MARKET;

const analyzeAndLog = async ({ nowMs, push }: AutopilotDriverCtx): Promise<void> => {
  const sport = getSportModule(TENNIS);
  const sources = sport.fixtureSources();
  const slate = (await Promise.all(sources.map((s) => s.fetch().catch(() => [])))).flat();
  if (slate.length === 0) return;

  const allBets = await betsRepo.list({ limit: 1000 });
  const betKeys = new Set(allBets.map((b) => `${b.matchId}|${selectionKey(b.selection)}`));
  const seen = await autopilotRepo.loadSeen();
  const unit = (await bankrollRepo.loadSettings()).unitValueMinor;

  for (const match of slate) {
    if (match.status !== "SCHEDULED") continue;
    const startMs = new Date(match.kickoffAt).getTime();
    if (!(startMs > nowMs) || startMs - nowMs > LOG_LEAD_MS) continue;
    const eventId = match.catalogId;
    if (nowMs - (seen[`${TENNIS}:${eventId}`] ?? 0) < ANALYZE_COOLDOWN_MS) continue;

    const result = await sport.analyze({ match, forceRefresh: false }).catch(() => null);
    await autopilotRepo.markSeen(`${TENNIS}:${eventId}`, nowMs).catch(() => {});
    if (!result || result.status !== "ok") continue;

    for (const play of result.plays) {
      if (play.selection.marketKey !== ML_MARKET) continue; // ML only in v1
      if (!(play.stakeUnits > 0)) continue;
      const key = `${play.matchId}|${selectionKey(play.selection)}`;
      if (betKeys.has(key)) continue;

      const bet: Bet = {
        id: BetId(uid()),
        placedAt: new Date().toISOString(),
        matchId: play.matchId,
        leagueId: LeagueId(String(match.leagueId)),
        marketKey: ML_MARKET,
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
      const who = play.selection.side === "home" ? match.home.name : match.away.name;
      push("log", `Logged ${who} ML @ ${play.price.decimal}`);
    }
  }
};

const captureAndSettle = async ({ nowMs, push }: AutopilotDriverCtx): Promise<number> => {
  const open = (await betsRepo.list({ status: "OPEN", limit: 1000 })).filter(isAutopilotTennisBet);
  if (open.length === 0) return 0;

  const settings = await settingsStore.load();
  const apiKey = settings.oddsApiIoKey ?? "";
  const results = await fetchTennisResults(apiKey).catch(() => new Map());

  for (const bet of open) {
    const eventId = String(bet.matchId);
    const r = results.get(eventId);

    // Phase C — settle from the final result (winner by sets; walkover → VOID).
    if (r && (r.settled || r.cancelled)) {
      const status = gradeTennisMl(bet.selection.side, r);
      if (!status) continue; // undecided — retry next tick
      await settleBetCore(bet, status, { actualResult: r.winner === "home" ? 1 : 0 });
      push("settle", `Settled ${bet.selection.side} ${status} (${r.homeSets}-${r.awaySets})`);
      continue;
    }

    // Phase B — in the closing window: snapshot the current Bet365 ML price so
    // the settle-time CLV has a real "close" to compare entry against.
    const startAt = r?.kickoffAt ?? undefined;
    if (!startAt || !closeWindowReached(startAt, nowMs)) continue;
    if (!apiKey) continue;
    const odds = await fetchTennisProps({ eventId, apiKey, books: [TENNIS_BET_BOOK] }).catch(() => null);
    const price = bet.selection.side === "home" ? odds?.mlA : odds?.mlB;
    if (!(price && price > 0)) continue;
    await snapshotsRepo
      .recordOffer({
        matchId: MatchId(eventId),
        marketKey: ML_MARKET,
        selection: bet.selection,
        priceDecimal: price,
        book: BookId(TENNIS_BET_BOOK),
        isOpener: false,
      })
      .then(() => push("close", `Close snapshot ${bet.selection.side} @ ${price}`))
      .catch(() => {});
  }

  return open.length;
};

export const tennisDriver: AutopilotDriver = {
  sportId: TENNIS,
  label: "TENNIS",
  analyzeAndLog,
  captureAndSettle,
};
