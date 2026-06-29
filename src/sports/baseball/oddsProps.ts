// Pitcher player-prop fetcher for odds-api.io. The live /v3/odds endpoint does
// NOT accept a `market=` query param — it returns ALL markets nested under
// bookmakers[slug][] as { name, odds[] }, so we fetch the full event-odds for
// the requested books and FILTER rows by market `name` (and, for books that
// bundle props under a generic "Player Props" market, by the row LABEL's prop
// type). Two book conventions are handled:
//   - Bet365: one market per prop, name = "Pitcher Strikeouts O/U" /
//     "Pitcher Outs O/U"; label = "Rhett Lowder (1) (4.5)" (line in the parens).
//   - DraftKings: a single "Player Props" market; label = "Rhett Lowder
//     (Pitcher Strikeouts)" / "(Outs Recorded)" with the line in `hdp`.
// We BET Bet365, so the Ks lines (the bet target) come from the designated
// ksBook (Bet365) only; the Outs line (a model BF anchor, not bet) is AVERAGED
// across every book that reports it — more coverage + a less noisy anchor.
// Pure of settings I/O: the caller passes apiKey + books. Degrades gracefully —
// on HTTP/zod failure it console.warns and returns an empty Map (never throws).

import { z } from "zod";
import { httpRequest, HttpError } from "@/services/http/httpClient";
import { oddsApiIoQuota } from "@/services/http/quotaTracker";

const IO_BASE = "https://api.odds-api.io/v3";

// Own copy of the row schema — the provider's ioOddsRowSchema omits `label`,
// which carries the player name for props ("Rhett Lowder (1) (4.5)").
const numLike = z
  .union([z.number(), z.string().transform((s) => parseFloat(s))])
  .optional();

const propRowSchema = z
  .object({
    label: z.string().optional(),
    hdp: numLike,
    line: numLike,
    over: numLike,
    under: numLike,
  })
  .passthrough();

const propMarketSchema = z
  .object({ name: z.string(), odds: z.array(propRowSchema).optional() })
  .passthrough();

const eventOddsSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    bookmakers: z.record(z.string(), z.array(propMarketSchema)).optional(),
  })
  .passthrough();

export interface PitcherKsLine {
  line: number;
  overDec: number;
  underDec: number;
}

export interface PitcherProps {
  /** All Strikeouts O/U lines for this pitcher. */
  ksLines: PitcherKsLine[];
  /** Pitcher Outs O/U line (a model BF input); undefined if absent. */
  outsLine?: number;
}

/** normalized player name -> props. */
export type EventPitcherProps = Map<string, PitcherProps>;

// Market-name matching (case-insensitive, tolerant of provider naming drift).
const isKsMarket = (name: string): boolean =>
  /strikeout/i.test(name) && /o\/u|over\/under|total/i.test(name);

const isOutsMarket = (name: string): boolean =>
  /pitcher outs/i.test(name) || (/outs/i.test(name) && /o\/u|over\/under/i.test(name));

// A pitcher prop type, or null if the row isn't one we model (batter props,
// pitcher hits/ER, etc. are skipped in v1).
type PropType = "ks" | "outs";

/**
 * Classify a row's prop type for books that bundle everything under a single
 * generic market (DraftKings' "Player Props"): the type lives in the label's
 * trailing parens, e.g. "Rhett Lowder (Pitcher Strikeouts)" / "(Outs Recorded)".
 * STRICT to pitcher props — "(Total Strikeouts)" is a BATTER prop and must NOT
 * match ks. Returns null for anything we don't bet on.
 */
const labelPropType = (label: string): PropType | null => {
  const m = /\(([^)]*)\)\s*$/.exec(label.trim());
  const type = m?.[1] ?? "";
  if (/pitcher\s+strikeout/i.test(type)) return "ks";
  if (/outs\s+recorded|pitching\s+outs|pitcher\s+outs/i.test(type)) return "outs";
  return null;
};

// Books whose markets are named per-prop (Bet365-style). Others (DraftKings)
// bundle props under a generic market and are classified by label instead.
const isGenericPropMarket = (name: string): boolean => /^player props$/i.test(name);

// Parse the player name from a prop label. The confirmed format is
// "Rhett Lowder (1) (4.5)" — name, jersey seq, line. The strict anchored regex
// gives a clean capture on that exact shape; if a provider naming-drift (missing
// seq, extra suffix) breaks it, fall back to a tolerant trailing-strip so the
// row degrades to a best-effort name instead of being dropped.
const STRICT_LABEL = /^(.+?)\s*\(\d+\)\s*\([\d.]+\)$/;
const parsePlayerName = (label: string): string => {
  const trimmed = label.trim();
  const m = STRICT_LABEL.exec(trimmed);
  if (m) return m[1].trim();
  return trimmed
    .replace(/\s*\([^)]*\)\s*\([^)]*\)\s*$/, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
};

/**
 * Shared name normalizer so analyze() can look up props by statsapi
 * ProbablePitcher.name. Lowercase, strip accents, drop punctuation, collapse
 * spaces. Exported so callers use the identical function for the map key.
 */
export const normalizeName = (raw: string): string =>
  raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.,'`"’\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const mean = (xs: number[]): number =>
  xs.reduce((a, b) => a + b, 0) / xs.length;

/** Default book we BET (and thus take Ks lines from). */
const DEFAULT_KS_BOOK = "bet365";

// Pure builder (no HTTP) — exported for tests, per the codebase convention.
const buildEventPitcherProps = (
  raw: unknown,
  books: string[],
  opts: { ksBook?: string } = {},
): EventPitcherProps => {
  const out: EventPitcherProps = new Map();
  const parsed = eventOddsSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn("[oddsProps] zod parse failed", parsed.error.issues.slice(0, 3));
    return out;
  }
  const bookmakers = parsed.data.bookmakers ?? {};
  // Requested books, case-insensitive (settings store "Bet365").
  const wanted = new Set(books.map((b) => b.toLowerCase()));
  // Ks lines (the bet target) only come from the book we actually bet.
  const ksBook = (opts.ksBook ?? DEFAULT_KS_BOOK).toLowerCase();

  const ensure = (name: string): PitcherProps => {
    const existing = out.get(name);
    if (existing) return existing;
    const created: PitcherProps = { ksLines: [] };
    out.set(name, created);
    return created;
  };

  // One Outs line per player PER BOOK, then averaged across books (a less noisy,
  // higher-coverage BF anchor than either book alone). Keyed player -> book -> line.
  const outsByPlayer = new Map<string, Map<string, number>>();

  for (const [bookKey, markets] of Object.entries(bookmakers)) {
    if (wanted.size > 0 && !wanted.has(bookKey.toLowerCase())) continue;
    const isKsBook = bookKey.toLowerCase() === ksBook;
    for (const market of markets) {
      const generic = isGenericPropMarket(market.name);
      // Bet365-style: the market name carries the type. Generic (DraftKings):
      // resolved per-row from the label below.
      const marketType: PropType | null = generic
        ? null
        : isKsMarket(market.name)
          ? "ks"
          : isOutsMarket(market.name)
            ? "outs"
            : null;
      if (!generic && marketType === null) continue;

      for (const row of market.odds ?? []) {
        if (!row.label) continue;
        const type = generic ? labelPropType(row.label) : marketType;
        if (type === null) continue;

        const player = normalizeName(parsePlayerName(row.label));
        if (!player) continue;
        const line = row.hdp ?? row.line;
        if (line === undefined) continue;

        if (type === "ks") {
          // Only bet-book Ks lines (we place bets on that book), two-way priced.
          if (!isKsBook) continue;
          if (row.over === undefined || row.under === undefined) continue;
          ensure(player).ksLines.push({ line, overDec: row.over, underDec: row.under });
        } else {
          const byBook = outsByPlayer.get(player) ?? new Map<string, number>();
          byBook.set(bookKey, line); // last line for this book wins (one per book)
          outsByPlayer.set(player, byBook);
        }
      }
    }
  }

  for (const [player, byBook] of outsByPlayer) {
    const lines = [...byBook.values()];
    if (lines.length === 0) continue;
    ensure(player).outsLine = mean(lines);
  }

  return out;
};

const buildQuery = (entries: Record<string, string | undefined>): string => {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(entries)) {
    if (v === undefined || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
};

export const fetchPitcherProps = async (args: {
  eventId: string;
  apiKey: string;
  books: string[];
  /** Book whose Ks lines we bet (default Bet365); others contribute Outs only. */
  ksBook?: string;
  signal?: AbortSignal;
}): Promise<EventPitcherProps> => {
  const { eventId, apiKey, books, ksBook, signal } = args;
  if (!apiKey) return new Map();

  const bookmakersParam = books.length > 0 ? books.join(",") : undefined;
  const url = `${IO_BASE}/odds${buildQuery({
    eventId,
    apiKey,
    bookmakers: bookmakersParam,
  })}`;

  try {
    const res = await httpRequest({
      url,
      rps: 0.5,
      headers: { Accept: "application/json" },
      signal,
    });
    oddsApiIoQuota.observeHeaders(res.headers);
    oddsApiIoQuota.recordRequest();
    return buildEventPitcherProps(await res.json(), books, { ksBook });
  } catch (err) {
    // Props are optional — downgrade every error to an empty result rather than
    // rethrow, so a missing/limited props feed never breaks the analysis.
    if (err instanceof HttpError) {
      console.warn(`[oddsProps] fetch failed (HTTP ${err.status})`);
    } else {
      console.warn("[oddsProps] fetch failed", err);
    }
    return new Map();
  }
};

// Pure helpers exported for unit tests (no HTTP), per the codebase convention.
export {
  buildEventPitcherProps as _buildEventPitcherProps,
  parsePlayerName as _parsePlayerName,
  isKsMarket as _isKsMarket,
  isOutsMarket as _isOutsMarket,
  labelPropType as _labelPropType,
};
