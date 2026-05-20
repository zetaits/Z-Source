import type { Bet } from "@/domain/bet";
import { BetId, BookId, LeagueId, MatchId } from "@/domain/ids";
import type { MarketKey, Selection } from "@/domain/market";
import type { Verdict } from "@/domain/play";
import { getStorage } from "@/storage";
import { bankrollRepo } from "@/storage/repos/bankrollRepo";
import { betsRepo } from "@/storage/repos/betsRepo";

const DEMO_ID_PREFIX = "demo-";
const DEMO_NOTE = "DEMO_SEED";
const STARTING_BANKROLL_MINOR = 100_000;
const UNIT_MINOR = 10_000;
const TOTAL_BETS = 30;
const DAYS_BACK = 45;

interface DemoSpec {
  marketKey: MarketKey;
  selection: Selection;
}

const DEMO_SPECS: DemoSpec[] = [
  { marketKey: "ML_1X2", selection: { marketKey: "ML_1X2", side: "home" } },
  { marketKey: "ML_1X2", selection: { marketKey: "ML_1X2", side: "draw" } },
  { marketKey: "ML_1X2", selection: { marketKey: "ML_1X2", side: "away" } },
  { marketKey: "OU_GOALS", selection: { marketKey: "OU_GOALS", side: "over", line: 2.5 } },
  { marketKey: "OU_GOALS", selection: { marketKey: "OU_GOALS", side: "under", line: 2.5 } },
  { marketKey: "OU_GOALS", selection: { marketKey: "OU_GOALS", side: "over", line: 3.5 } },
  { marketKey: "AH", selection: { marketKey: "AH", side: "home", line: -0.5 } },
  { marketKey: "AH", selection: { marketKey: "AH", side: "away", line: 0.5 } },
  { marketKey: "AH", selection: { marketKey: "AH", side: "home", line: -1 } },
  { marketKey: "BTTS", selection: { marketKey: "BTTS", side: "yes" } },
  { marketKey: "BTTS", selection: { marketKey: "BTTS", side: "no" } },
  { marketKey: "DC", selection: { marketKey: "DC", side: "1X" } },
  { marketKey: "DC", selection: { marketKey: "DC", side: "X2" } },
  { marketKey: "TTG_HOME", selection: { marketKey: "TTG_HOME", side: "over", line: 1.5 } },
  { marketKey: "TTG_AWAY", selection: { marketKey: "TTG_AWAY", side: "over", line: 0.5 } },
];

const DEMO_LEAGUES = [
  "soccer:premier-league",
  "soccer:la-liga",
  "soccer:serie-a",
  "soccer:bundesliga",
  "soccer:ligue-1",
];

const DEMO_BOOKS = ["pinnacle", "bet365", "betfair", "william-hill"];

const VERDICTS: Verdict[] = ["LEAN", "PLAY", "STRONG"];

const rand = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
};

const pick = <T,>(arr: T[], r: number): T => arr[Math.floor(r * arr.length) % arr.length];

const lerp = (lo: number, hi: number, t: number): number => lo + (hi - lo) * t;

interface DemoBet {
  bet: Bet;
  outcome: "WIN" | "LOSS";
  payoutMinor: number;
  verdict: Verdict;
  fairProb: number;
  edgePct: number;
  confidence: number;
  playId: string;
}

const buildDemoBets = (): DemoBet[] => {
  const rng = rand(20260518);
  const now = Date.now();
  const DAY_MS = 86_400_000;
  const out: DemoBet[] = [];

  for (let i = 0; i < TOTAL_BETS; i++) {
    const spec = DEMO_SPECS[i % DEMO_SPECS.length];
    const leagueId = DEMO_LEAGUES[i % DEMO_LEAGUES.length];
    const book = DEMO_BOOKS[i % DEMO_BOOKS.length];

    const placedOffsetDays = DAYS_BACK - (i / TOTAL_BETS) * DAYS_BACK;
    const placedAt = new Date(now - placedOffsetDays * DAY_MS).toISOString();
    const settledAt = new Date(now - placedOffsetDays * DAY_MS + 3 * 3_600_000).toISOString();

    const stakeUnits = +lerp(0.5, 2.5, rng()).toFixed(2);
    const stakeMinor = Math.round(stakeUnits * UNIT_MINOR);
    const priceDecimal = +lerp(1.6, 3.4, rng()).toFixed(2);

    const win = rng() < 0.55;
    const payoutMinor = win ? Math.round(stakeMinor * priceDecimal) : 0;

    const verdict = pick(VERDICTS, rng());
    const fairProb = +lerp(0.4, 0.75, rng()).toFixed(3);
    const edgePct = +lerp(1.5, 8, rng()).toFixed(2);
    const confidence = +lerp(0.5, 0.9, rng()).toFixed(2);

    const id = `${DEMO_ID_PREFIX}${String(i).padStart(3, "0")}`;
    const matchId = `${DEMO_ID_PREFIX}match-${String(i).padStart(3, "0")}`;
    const playId = `${DEMO_ID_PREFIX}play-${String(i).padStart(3, "0")}`;

    const bet: Bet = {
      id: BetId(id),
      placedAt,
      matchId: MatchId(matchId),
      leagueId: LeagueId(leagueId),
      marketKey: spec.marketKey,
      selection: spec.selection,
      priceDecimal,
      book: BookId(book),
      stakeUnits,
      stakeMinor,
      status: win ? "WON" : "LOST",
      settledAt,
      payoutMinor,
      closingPriceDecimal: +lerp(priceDecimal * 0.93, priceDecimal * 1.05, rng()).toFixed(2),
      notes: DEMO_NOTE,
    };

    out.push({
      bet,
      outcome: win ? "WIN" : "LOSS",
      payoutMinor,
      verdict,
      fairProb,
      edgePct,
      confidence,
      playId,
    });
  }

  return out;
};

const insertPickOutcome = async (d: DemoBet): Promise<void> => {
  const db = await getStorage();
  const payoutUnits = d.outcome === "WIN" ? +(d.payoutMinor / UNIT_MINOR).toFixed(3) : 0;
  await db.execute(
    "INSERT OR REPLACE INTO pick_outcomes(play_id, generated_at, match_id, league_id, market_key, selection_json, verdict, edge_pct, fair_prob, confidence, price_decimal, stake_units, outcome, payout_units, settled_at, bet_id) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      d.playId,
      d.bet.placedAt,
      d.bet.matchId,
      d.bet.leagueId,
      d.bet.marketKey,
      JSON.stringify(d.bet.selection),
      d.verdict,
      d.edgePct,
      d.fairProb,
      d.confidence,
      d.bet.priceDecimal,
      d.bet.stakeUnits,
      d.outcome,
      payoutUnits,
      d.bet.settledAt ?? null,
      d.bet.id,
    ],
  );
};

export const seedDemoData = async (): Promise<{ bets: number }> => {
  const db = await getStorage();
  await db.execute("DELETE FROM bankroll_ledger");

  const demos = buildDemoBets();
  const oldestPlaced = demos[0]?.bet.placedAt ?? new Date().toISOString();
  const depositAt = new Date(new Date(oldestPlaced).getTime() - 3_600_000).toISOString();
  await db.execute(
    "INSERT INTO bankroll_ledger(occurred_at, kind, amount_minor, balance_after_minor, bet_id, note) VALUES(?, ?, ?, ?, ?, ?)",
    [depositAt, "DEPOSIT", STARTING_BANKROLL_MINOR, STARTING_BANKROLL_MINOR, null, "Demo starting bankroll"],
  );

  for (const d of demos) {
    await betsRepo.insert(d.bet);
    await bankrollRepo.append({
      kind: "BET_STAKE",
      amountMinor: -d.bet.stakeMinor,
      betId: d.bet.id,
      occurredAt: d.bet.placedAt,
      note: DEMO_NOTE,
    });
    await bankrollRepo.append({
      kind: "BET_RESULT",
      amountMinor: d.payoutMinor,
      betId: d.bet.id,
      occurredAt: d.bet.settledAt,
      note: DEMO_NOTE,
    });
    await insertPickOutcome(d);
  }

  return { bets: demos.length };
};

export const clearDemoData = async (): Promise<void> => {
  const db = await getStorage();
  await db.execute("DELETE FROM pick_outcomes WHERE play_id LIKE ?", [`${DEMO_ID_PREFIX}%`]);
  await db.execute("DELETE FROM bankroll_ledger WHERE bet_id LIKE ?", [`${DEMO_ID_PREFIX}%`]);
  await db.execute("DELETE FROM bets WHERE id LIKE ?", [`${DEMO_ID_PREFIX}%`]);
  await bankrollRepo.reset(STARTING_BANKROLL_MINOR);
};
