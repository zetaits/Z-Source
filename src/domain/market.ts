export type MarketKey =
  | "ML_1X2"
  | "DNB"
  | "AH"
  | "OU_GOALS"
  | "BTTS"
  | "ML_HT"
  | "CORNERS_TOTAL"
  | "CORNERS_TEAM"
  | "CARDS_TOTAL"
  | "SHOTS_TOTAL"
  | "SOT_TOTAL"
  | "SAVES_GK"
  | "TACKLES_TOTAL"
  | "THROWINS_OU";

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
}

export const selectionKey = (s: Selection): string =>
  s.line === undefined ? `${s.marketKey}:${s.side}` : `${s.marketKey}:${s.side}@${s.line}`;
