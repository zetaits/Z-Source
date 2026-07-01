export type MarketKey =
  | "ML_1X2"
  | "DNB"
  | "AH"
  | "OU_GOALS"
  | "BTTS"
  | "BTTS_1H"
  | "BTTS_2H"
  | "DC"
  | "TTG_HOME"
  | "TTG_AWAY"
  | "ML_HT"
  | "CORNERS_TOTAL"
  | "CORNERS_TEAM"
  | "CARDS_TOTAL"
  | "SHOTS_TOTAL"
  | "SOT_TOTAL"
  | "SAVES_GK"
  | "TACKLES_TOTAL"
  | "THROWINS_OU"
  | "PITCHER_KS"
  // Tennis
  | "ML_TENNIS"   // Match winner (two-way; no draw)
  | "OU_GAMES"    // Total games in match over/under
  | "AH_GAMES";   // Games handicap (Asian handicap on game count)

export type MarketGroup = "main" | "secondary";

export interface MarketDescriptor {
  key: MarketKey;
  label: string;
  group: MarketGroup;
  hasLine: boolean;
}

export interface Selection {
  marketKey: MarketKey;
  side: string;
  line?: number;
  /** Player name — present only for player props (e.g. "Rhett Lowder"). */
  player?: string;
  /** Short market label for props (e.g. "Strikeouts O/U"). */
  propLabel?: string;
}

export const selectionKey = (s: Selection): string => {
  const base =
    s.line === undefined ? `${s.marketKey}:${s.side}` : `${s.marketKey}:${s.side}@${s.line}`;
  // Disambiguate two pitchers sharing the same PITCHER_KS line. Player-less
  // selections (all football) keep their existing key unchanged.
  return s.player ? `${base}|${s.player}` : base;
};
