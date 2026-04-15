import type { MarketDescriptor, MarketKey } from "@/domain/market";

export const MARKETS: MarketDescriptor[] = [
  { key: "ML_1X2", label: "Match Result (1X2)", group: "main", hasLine: false },
  { key: "DNB", label: "Draw No Bet", group: "main", hasLine: false },
  { key: "AH", label: "Asian Handicap", group: "main", hasLine: true },
  { key: "OU_GOALS", label: "Total Goals", group: "main", hasLine: true },
  { key: "BTTS", label: "Both Teams To Score", group: "main", hasLine: false },
  { key: "ML_HT", label: "1H Match Result", group: "main", hasLine: false },
  { key: "CORNERS_TOTAL", label: "Total Corners", group: "secondary", hasLine: true },
  { key: "CORNERS_TEAM", label: "Team Corners", group: "secondary", hasLine: true },
  { key: "CARDS_TOTAL", label: "Total Cards", group: "secondary", hasLine: true },
  { key: "SHOTS_TOTAL", label: "Total Shots", group: "secondary", hasLine: true },
  { key: "SOT_TOTAL", label: "Total Shots on Target", group: "secondary", hasLine: true },
  { key: "SAVES_GK", label: "Goalkeeper Saves", group: "secondary", hasLine: true },
  { key: "TACKLES_TOTAL", label: "Total Tackles", group: "secondary", hasLine: true },
  { key: "THROWINS_OU", label: "Total Throw-ins", group: "secondary", hasLine: true },
];

export const marketByKey = (k: MarketKey): MarketDescriptor | undefined =>
  MARKETS.find((m) => m.key === k);
