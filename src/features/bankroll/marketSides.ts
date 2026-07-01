import type { MarketKey } from "@/domain/market";

export interface SideOption {
  value: string;
  label: string;
}

export interface MarketSidesConfig {
  sides: SideOption[];
  hasLine: boolean;
  lineHint?: string;
}

const OVER_UNDER: SideOption[] = [
  { value: "over", label: "Over" },
  { value: "under", label: "Under" },
];

const HOME_AWAY: SideOption[] = [
  { value: "home", label: "Home" },
  { value: "away", label: "Away" },
];

const HOME_DRAW_AWAY: SideOption[] = [
  { value: "home", label: "Home" },
  { value: "draw", label: "Draw" },
  { value: "away", label: "Away" },
];

const YES_NO: SideOption[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const DC_SIDES: SideOption[] = [
  { value: "1X", label: "Home or Draw (1X)" },
  { value: "12", label: "Home or Away (12)" },
  { value: "X2", label: "Draw or Away (X2)" },
];

export const MARKET_SIDES: Record<MarketKey, MarketSidesConfig> = {
  ML_1X2: { sides: HOME_DRAW_AWAY, hasLine: false },
  ML_HT: { sides: HOME_DRAW_AWAY, hasLine: false },
  ML_TENNIS: { sides: HOME_AWAY, hasLine: false },
  OU_GAMES: { sides: OVER_UNDER, hasLine: true, lineHint: "20.5, 21.5, 22.5…" },
  AH_GAMES: { sides: HOME_AWAY, hasLine: true, lineHint: "−3.5, −1.5, +2.5…" },
  DNB: { sides: HOME_AWAY, hasLine: false },
  AH: { sides: HOME_AWAY, hasLine: true, lineHint: "−0.5, +1, +1.25…" },
  OU_GOALS: { sides: OVER_UNDER, hasLine: true, lineHint: "1.5, 2.5, 3.5…" },
  BTTS: { sides: YES_NO, hasLine: false },
  BTTS_1H: { sides: YES_NO, hasLine: false },
  BTTS_2H: { sides: YES_NO, hasLine: false },
  DC: { sides: DC_SIDES, hasLine: false },
  TTG_HOME: { sides: OVER_UNDER, hasLine: true, lineHint: "0.5, 1.5, 2.5…" },
  TTG_AWAY: { sides: OVER_UNDER, hasLine: true, lineHint: "0.5, 1.5, 2.5…" },
  CORNERS_TOTAL: { sides: OVER_UNDER, hasLine: true, lineHint: "8.5, 9.5, 10.5…" },
  CORNERS_TEAM: { sides: HOME_AWAY, hasLine: true, lineHint: "Team line, e.g. 4.5" },
  CARDS_TOTAL: { sides: OVER_UNDER, hasLine: true, lineHint: "3.5, 4.5…" },
  SHOTS_TOTAL: { sides: OVER_UNDER, hasLine: true, lineHint: "23.5, 24.5…" },
  SOT_TOTAL: { sides: OVER_UNDER, hasLine: true, lineHint: "8.5, 9.5…" },
  SAVES_GK: { sides: OVER_UNDER, hasLine: true, lineHint: "GK line, e.g. 3.5" },
  TACKLES_TOTAL: { sides: OVER_UNDER, hasLine: true, lineHint: "20.5, 22.5…" },
  THROWINS_OU: { sides: OVER_UNDER, hasLine: true, lineHint: "30.5, 35.5…" },
  PITCHER_KS: { sides: OVER_UNDER, hasLine: true, lineHint: "4.5, 5.5, 6.5…" },
};

// Fallback to a generic Over/Under config so an unmapped market never crashes
// the bet dialog (sidesFor used to return undefined → ".hasLine of undefined").
const FALLBACK_SIDES: MarketSidesConfig = { sides: OVER_UNDER, hasLine: true };

export const sidesFor = (key: MarketKey): MarketSidesConfig =>
  MARKET_SIDES[key] ?? FALLBACK_SIDES;
