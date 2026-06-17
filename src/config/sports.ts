// ============================================================================
// Z-SOURCE — SPORT REGISTRY (the scalable core)
// ----------------------------------------------------------------------------
// Sports are data. To add a sport: append ONE object here. It propagates
// everywhere — rail, sidebar, topbar, scanner headers, market chips,
// terminology. Zero UI rework. `enabled:false` parks a sport as "coming soon"
// without removing it (stays visible, greyed, not clickable).
//
// Registry order == rail order. Per-sport `unit`/`eventLabel`/`markets` let the
// same screen re-label itself per sport. Fixtures/games come from the engine
// feed keyed by `sport.id` — never hardcoded here.
// ============================================================================

export interface Sport {
  /** Stable key, e.g. 'basketball'. Used for routing, persistence, icon lookup. */
  id: string;
  /** 2-letter fallback shown when no icon exists, e.g. 'BK'. */
  mono: string;
  /** Display name, e.g. 'Basketball'. */
  label: string;
  /** Short feed/league tag shown under the rail icon, e.g. 'NBA'. */
  code: string;
  /** false → parked "coming soon" (greyed, not clickable). */
  enabled: boolean;
  /** true → green live dot on the rail tile. */
  live: boolean;
  /** Domain noun: 'fixtures' | 'games' | 'matches'. */
  unit: string;
  /** Contest start term: 'kickoff' | 'tip-off' | 'first pitch' | 'on court'. */
  eventLabel: string;
  /** "next whistle" | "next tip" | … — copy for the next-up strip. */
  nextLabel: string;
  /** League list string for the sidebar/header. */
  competitions: string;
  /** Sport-specific market chips, e.g. ['SPREAD','TOTAL','MONEYLINE', …]. */
  markets: string[];
}

export const SPORTS: readonly Sport[] = [
  {
    id: "football",
    mono: "FB",
    label: "Football",
    code: "SOCCER",
    enabled: true,
    live: true,
    unit: "fixtures",
    eventLabel: "kickoff",
    nextLabel: "next whistle",
    competitions: "Premier League · La Liga · Serie A · Bundesliga · +6",
    markets: ["1X2", "ASIAN HCAP", "TOTALS", "BTTS", "TEAM TTL", "CORNERS"],
  },
  {
    id: "basketball",
    mono: "BK",
    label: "Basketball",
    code: "NBA",
    enabled: true,
    live: true,
    unit: "games",
    eventLabel: "tip-off",
    nextLabel: "next tip",
    competitions: "NBA · EuroLeague · NCAA · +3",
    markets: ["SPREAD", "TOTAL", "MONEYLINE", "TEAM TTL", "Q1 LINES", "PLAYER PROPS"],
  },
  {
    id: "baseball",
    mono: "BB",
    label: "Baseball",
    code: "MLB",
    enabled: true,
    live: false,
    unit: "games",
    eventLabel: "first pitch",
    nextLabel: "next pitch",
    competitions: "MLB · NPB · KBO",
    markets: ["MONEYLINE", "RUN LINE", "TOTAL", "F5 INNINGS", "TEAM TTL", "PROPS"],
  },
  {
    id: "tennis",
    mono: "TN",
    label: "Tennis",
    code: "ATP/WTA",
    enabled: true,
    live: true,
    unit: "matches",
    eventLabel: "on court",
    nextLabel: "next on court",
    competitions: "ATP 1000 · WTA 1000 · Grand Slam",
    markets: ["MONEYLINE", "SET HCAP", "TOTAL GAMES", "SET BETTING", "GAME HCAP"],
  },
  {
    id: "amfootball",
    mono: "AF",
    label: "Am. Football",
    code: "NFL",
    enabled: false, // parked — shows the "coming soon" state
    live: false,
    unit: "games",
    eventLabel: "kickoff",
    nextLabel: "next kickoff",
    competitions: "NFL · NCAAF",
    markets: ["SPREAD", "TOTAL", "MONEYLINE", "TEAM TTL", "PROPS"],
  },
];

/** First enabled sport — the default workspace on a cold start. */
export const DEFAULT_SPORT_ID: string =
  SPORTS.find((s) => s.enabled)?.id ?? SPORTS[0].id;

export const findSportById = (id: string): Sport | undefined =>
  SPORTS.find((s) => s.id === id);

export const enabledSports = (): Sport[] => SPORTS.filter((s) => s.enabled);
