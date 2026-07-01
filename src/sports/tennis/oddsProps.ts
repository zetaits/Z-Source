// Tennis player-prop and match-market fetcher for odds-api.io.
// Parses Bet365 odds rows for the markets available on the plan:
//   ML              — moneyline (player A / B win)
//   Totals (Games)  — total games in match O/U
//   Spread (Games)  — game handicap
//   Totals 1st Set  — first-set total games O/U
//   Totals (Aces)   — total aces in match O/U
//   Totals (Double Faults) — total double faults O/U
//   Team Total (Games) — per-player total games (parse A + B separately)
//
// "Set Betting" (exact score market) is not parsed in v1 — the score-
// distribution model produces its own set-score probs from the Markov chain.
//
// Degrades gracefully: on HTTP / parse failure returns an empty TennisMatchOdds;
// callers treat undefined fields as "market not available" rather than erroring.

import { z } from "zod";
import { httpRequest, HttpError } from "@/services/http/httpClient";
import { oddsApiIoQuota } from "@/services/http/quotaTracker";

const IO_BASE = "https://api.odds-api.io/v3";

// ---------------------------------------------------------------------------
// Shared odds row schema (mirrors baseball/oddsProps.ts propRowSchema + label)
// ---------------------------------------------------------------------------

const numLike = z
  .union([z.number(), z.string().transform((s) => parseFloat(s))])
  .optional();

const oddsRowSchema = z
  .object({
    label: z.string().optional(),
    hdp:   numLike,
    line:  numLike,
    over:  numLike,
    under: numLike,
    home:  numLike,   // player A decimal
    away:  numLike,   // player B decimal
    yes:   numLike,
    no:    numLike,
  })
  .passthrough();

const marketSchema = z
  .object({ name: z.string(), odds: z.array(oddsRowSchema).optional() })
  .passthrough();

const eventOddsSchema = z
  .object({
    id:         z.union([z.string(), z.number()]).optional(),
    bookmakers: z.record(z.string(), z.array(marketSchema)).optional(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/** Over/Under line for a total (games, aces, DFs, 1st-set games). */
export interface OULine {
  line:     number;
  overDec:  number;  // decimal odds for Over
  underDec: number;  // decimal odds for Under
}

/** Game handicap — hdp is the spread applied to player A. Negative = A gives games. */
export interface SpreadLine {
  hdp:  number;  // e.g. -3.5 means A must win by 4+ games
  aDec: number;  // player A covers
  bDec: number;  // player B covers
}

/** Per-player total games in the match (Team Total market). */
export interface TeamTotalLine {
  aLine?: OULine; // player A total games
  bLine?: OULine; // player B total games
}

/** All parsed tennis market lines for a single event. */
export interface TennisMatchOdds {
  mlA?: number;          // moneyline decimal for player A
  mlB?: number;          // moneyline decimal for player B
  totalGames?: OULine;   // match total games O/U
  gameSpread?: SpreadLine;
  totalGamesSet1?: OULine;
  totalAces?: OULine;
  totalDFs?: OULine;
  teamTotal?: TeamTotalLine;
}

// ---------------------------------------------------------------------------
// Market detection helpers (case-insensitive, tolerant of minor naming drift)
// ---------------------------------------------------------------------------

const isMlMarket = (name: string): boolean =>
  /^(?:ML|H2H|Moneyline|Match Winner)$/i.test(name.trim());

const isTotalGamesMarket = (name: string): boolean =>
  /totals?\s*\(?games?\)?/i.test(name) &&
  !/1st\s*set|first\s*set|aces|double\s*fault/i.test(name);

const isSpreadGamesMarket = (name: string): boolean =>
  /spread\s*\(?games?\)?/i.test(name);

const isTotalSet1Market = (name: string): boolean =>
  /totals?\s*1st\s*set|totals?\s*first\s*set/i.test(name);

const isAcesMarket = (name: string): boolean =>
  /totals?\s*\(?aces?\)?/i.test(name);

const isDFMarket = (name: string): boolean =>
  /totals?\s*\(?double\s*faults?\)?/i.test(name);

const isTeamTotalGamesMarket = (name: string): boolean =>
  /team\s+totals?\s*\(?games?\)?/i.test(name);

// ---------------------------------------------------------------------------
// Row -> typed lines. Helpers return undefined when required fields are absent
// so callers only store well-formed lines.
// ---------------------------------------------------------------------------

const toOULine = (row: z.infer<typeof oddsRowSchema>): OULine | undefined => {
  const line = row.hdp ?? row.line;
  if (line === undefined || row.over === undefined || row.under === undefined) return undefined;
  return { line, overDec: row.over, underDec: row.under };
};

const toSpreadLine = (row: z.infer<typeof oddsRowSchema>): SpreadLine | undefined => {
  const hdp = row.hdp ?? row.line;
  if (hdp === undefined || row.home === undefined || row.away === undefined) return undefined;
  return { hdp, aDec: row.home, bDec: row.away };
};

// Team Total rows typically come in pairs — one for player A (home) and one for
// player B (away). Bet365 puts the player label in the `label` field or uses
// `home`/`away` fields for the two totals in a single row. Handle both shapes.
const toTeamTotalOULine = (
  row: z.infer<typeof oddsRowSchema>,
): { side: "a" | "b"; line: OULine } | undefined => {
  const line = row.hdp ?? row.line;
  if (line === undefined) return undefined;
  if (row.home !== undefined && row.away !== undefined) {
    // Single-row format: home = player A's over decimal, away = player B's over.
    // Without a matching under price, skip — too ambiguous to model safely.
    return undefined;
  }
  if (row.over === undefined || row.under === undefined) return undefined;
  // Label distinguishes A ("Home", "Player A", or player name in position 0)
  // from B ("Away", "Player B"). Default to A on first occurrence.
  const label = (row.label ?? "").toLowerCase();
  const side: "a" | "b" = /\baway\b|\bplayer\s*b\b/i.test(label) ? "b" : "a";
  return { side, line: { line, overDec: row.over, underDec: row.under } };
};

// ---------------------------------------------------------------------------
// Pure builder (no HTTP) — exported for unit tests
// ---------------------------------------------------------------------------

export const buildTennisMatchOdds = (
  raw: unknown,
  books: string[],
): TennisMatchOdds => {
  const out: TennisMatchOdds = {};
  const parsed = eventOddsSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn("[tennis/oddsProps] zod parse failed", parsed.error.issues.slice(0, 3));
    return out;
  }

  const bookmakers = parsed.data.bookmakers ?? {};
  const wanted = new Set(books.map((b) => b.toLowerCase()));

  for (const [bookKey, markets] of Object.entries(bookmakers)) {
    if (wanted.size > 0 && !wanted.has(bookKey.toLowerCase())) continue;

    for (const market of markets) {
      const name = market.name;
      const rows = market.odds ?? [];

      if (isMlMarket(name)) {
        // ML row: home = player A decimal, away = player B decimal
        for (const row of rows) {
          if (row.home !== undefined) out.mlA = row.home;
          if (row.away !== undefined) out.mlB = row.away;
        }
        continue;
      }

      if (isTotalGamesMarket(name)) {
        for (const row of rows) {
          const line = toOULine(row);
          if (line && !out.totalGames) out.totalGames = line;
        }
        continue;
      }

      if (isSpreadGamesMarket(name)) {
        for (const row of rows) {
          const line = toSpreadLine(row);
          if (line && !out.gameSpread) out.gameSpread = line;
        }
        continue;
      }

      if (isTotalSet1Market(name)) {
        for (const row of rows) {
          const line = toOULine(row);
          if (line && !out.totalGamesSet1) out.totalGamesSet1 = line;
        }
        continue;
      }

      if (isAcesMarket(name)) {
        for (const row of rows) {
          const line = toOULine(row);
          if (line && !out.totalAces) out.totalAces = line;
        }
        continue;
      }

      if (isDFMarket(name)) {
        for (const row of rows) {
          const line = toOULine(row);
          if (line && !out.totalDFs) out.totalDFs = line;
        }
        continue;
      }

      if (isTeamTotalGamesMarket(name)) {
        const tt: TeamTotalLine = out.teamTotal ?? {};
        for (const row of rows) {
          const res = toTeamTotalOULine(row);
          if (!res) continue;
          if (res.side === "a" && !tt.aLine) tt.aLine = res.line;
          if (res.side === "b" && !tt.bLine) tt.bLine = res.line;
        }
        if (tt.aLine ?? tt.bLine) out.teamTotal = tt;
        continue;
      }
    }
  }

  return out;
};

// ---------------------------------------------------------------------------
// Query string builder (mirrors oddsApiIoProvider.ts)
// ---------------------------------------------------------------------------

const buildQuery = (entries: Record<string, string | undefined>): string => {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(entries)) {
    if (v === undefined || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
};

// ---------------------------------------------------------------------------
// Public fetcher
// ---------------------------------------------------------------------------

/**
 * Fetch and parse all supported Bet365 tennis markets for one event.
 * `books` must include at least "Bet365" (plan constraint: only Bet365 + DraftKings).
 * Returns an empty TennisMatchOdds on any failure — never throws.
 */
export const fetchTennisProps = async (args: {
  eventId: string;
  apiKey:  string;
  books:   string[];
  signal?: AbortSignal;
}): Promise<TennisMatchOdds> => {
  const { eventId, apiKey, books, signal } = args;
  if (!apiKey) return {};

  const bookmakersParam = books.length > 0 ? books.join(",") : undefined;
  const url =
    `${IO_BASE}/odds` +
    buildQuery({ eventId, apiKey, bookmakers: bookmakersParam });

  try {
    const res = await httpRequest({
      url,
      rps: 0.5,
      headers: { Accept: "application/json" },
      signal,
    });
    oddsApiIoQuota.observeHeaders(res.headers);
    oddsApiIoQuota.recordRequest();
    return buildTennisMatchOdds(await res.json(), books);
  } catch (err) {
    if (err instanceof HttpError) {
      console.warn(`[tennis/oddsProps] fetch failed (HTTP ${err.status})`);
    } else {
      console.warn("[tennis/oddsProps] fetch failed", err);
    }
    return {};
  }
};

/** Books the tennis module bets on (Bet365) and reads for auxiliary lines (DraftKings). */
export const TENNIS_PROP_BOOKS = ["Bet365", "DraftKings"] as const;

// Pure helpers exported for unit tests, per codebase convention.
export {
  buildTennisMatchOdds as _buildTennisMatchOdds,
  isMlMarket          as _isMlMarket,
  isTotalGamesMarket  as _isTotalGamesMarket,
  isSpreadGamesMarket as _isSpreadGamesMarket,
  isTotalSet1Market   as _isTotalSet1Market,
  isAcesMarket        as _isAcesMarket,
  isDFMarket          as _isDFMarket,
};
