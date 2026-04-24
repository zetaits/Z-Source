import { z } from "zod";

export const ACTION_NETWORK_API_BASE = "https://api.actionnetwork.com";

export const actionNetworkPublicBettingApiUrl = (dateYyyyMmDd: string): string => {
  const compact = dateYyyyMmDd.replace(/-/g, "");
  return `${ACTION_NETWORK_API_BASE}/web/v2/scoreboard/publicbetting/soccer?date=${compact}`;
};

const betPercentSchema = z
  .object({
    value: z.number().nullable().optional(),
    percent: z.number().nullable().optional(),
  })
  .passthrough();

const betInfoSchema = z
  .object({
    tickets: betPercentSchema.optional(),
    money: betPercentSchema.optional(),
  })
  .passthrough();

const outcomeSchema = z
  .object({
    type: z.string().nullish(),
    side: z.string().nullish(),
    team_id: z.number().nullish(),
    odds: z.number().nullish(),
    bet_info: betInfoSchema.nullish(),
  })
  .passthrough();

const bookMarketsSchema = z
  .object({
    event: z.record(z.string(), z.array(outcomeSchema)).nullish(),
  })
  .passthrough();

const teamSchema = z
  .object({
    id: z.number(),
    full_name: z.string().nullish(),
    display_name: z.string().nullish(),
    short_name: z.string().nullish(),
    abbr: z.string().nullish(),
  })
  .passthrough();

const gameSchema = z
  .object({
    id: z.number(),
    league_id: z.number().nullish(),
    league_name: z.string().nullish(),
    start_time: z.string().nullish(),
    home_team_id: z.number(),
    away_team_id: z.number(),
    teams: z.array(teamSchema),
    markets: z.record(z.string(), bookMarketsSchema).nullish(),
  })
  .passthrough();

export const anPublicBettingResponseSchema = z
  .object({
    games: z.array(gameSchema).default([]),
  })
  .passthrough();

export type AnGame = z.infer<typeof gameSchema>;
export type AnTeam = z.infer<typeof teamSchema>;

const AN_BOOK_LABELS: Record<string, string> = {
  "15": "consensus",
  "69": "bet365",
  "68": "pointsbet",
  "75": "draftkings",
  "972": "fanduel",
  "123": "pinnacle",
  "71": "betmgm",
  "79": "caesars",
};

export const anBookLabel = (id: string): string => AN_BOOK_LABELS[id] ?? `book ${id}`;

export type MlSide = "home" | "draw" | "away";

export interface AnMlRow {
  side: MlSide;
  betsPct: number | null;
  moneyPct: number | null;
}

export interface AnMlSplits {
  homeTeamName: string;
  awayTeamName: string;
  rows: AnMlRow[];
  bookId: string;
}

const teamNameFromTeam = (t: AnTeam | undefined): string | null => {
  if (!t) return null;
  return t.full_name ?? t.display_name ?? t.short_name ?? t.abbr ?? null;
};

const readPct = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const hasAnyPct = (o: z.infer<typeof outcomeSchema>): boolean => {
  const t = readPct(o.bet_info?.tickets?.percent);
  const m = readPct(o.bet_info?.money?.percent);
  return t !== null || m !== null;
};

const classifySide = (
  o: z.infer<typeof outcomeSchema>,
  homeId: number,
  awayId: number,
): MlSide | null => {
  const raw = (o.side ?? "").toLowerCase();
  if (raw === "home" || o.team_id === homeId) return "home";
  if (raw === "away" || o.team_id === awayId) return "away";
  if (raw === "draw" || raw === "tie" || raw === "x") return "draw";
  if (o.team_id === 0 || o.team_id === undefined) return "draw";
  return null;
};

export const extractMlSplits = (game: AnGame): AnMlSplits | null => {
  const homeTeam = game.teams.find((t) => t.id === game.home_team_id);
  const awayTeam = game.teams.find((t) => t.id === game.away_team_id);
  const homeName = teamNameFromTeam(homeTeam);
  const awayName = teamNameFromTeam(awayTeam);
  if (!homeName || !awayName) return null;

  for (const [bookId, book] of Object.entries(game.markets ?? {})) {
    const ml = book.event?.moneyline;
    if (!Array.isArray(ml)) continue;
    const bySide = new Map<MlSide, AnMlRow>();
    for (const o of ml) {
      const side = classifySide(o, game.home_team_id, game.away_team_id);
      if (!side) continue;
      if (bySide.has(side)) continue;
      if (!hasAnyPct(o)) continue;
      bySide.set(side, {
        side,
        betsPct: readPct(o.bet_info?.tickets?.percent),
        moneyPct: readPct(o.bet_info?.money?.percent),
      });
    }
    if (bySide.size === 0) continue;
    const order: MlSide[] = ["home", "draw", "away"];
    const rows = order.map((s) => bySide.get(s)).filter((r): r is AnMlRow => !!r);
    return { homeTeamName: homeName, awayTeamName: awayName, rows, bookId };
  }
  return null;
};
