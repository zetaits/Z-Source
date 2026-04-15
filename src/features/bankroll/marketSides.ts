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

export const MARKET_SIDES: Record<MarketKey, MarketSidesConfig> = {
  ML_1X2: { sides: HOME_DRAW_AWAY, hasLine: false },
  ML_HT: { sides: HOME_DRAW_AWAY, hasLine: false },
  DNB: { sides: HOME_AWAY, hasLine: false },
  AH: { sides: HOME_AWAY, hasLine: true, lineHint: "−0.5, +1, +1.25…" },
  OU_GOALS: { sides: OVER_UNDER, hasLine: true, lineHint: "1.5, 2.5, 3.5…" },
  BTTS: { sides: YES_NO, hasLine: false },
  CORNERS_TOTAL: { sides: OVER_UNDER, hasLine: true, lineHint: "8.5, 9.5, 10.5…" },
  CORNERS_TEAM: { sides: HOME_AWAY, hasLine: true, lineHint: "Team line, e.g. 4.5" },
  CARDS_TOTAL: { sides: OVER_UNDER, hasLine: true, lineHint: "3.5, 4.5…" },
  SHOTS_TOTAL: { sides: OVER_UNDER, hasLine: true, lineHint: "23.5, 24.5…" },
  SOT_TOTAL: { sides: OVER_UNDER, hasLine: true, lineHint: "8.5, 9.5…" },
  SAVES_GK: { sides: OVER_UNDER, hasLine: true, lineHint: "GK line, e.g. 3.5" },
  TACKLES_TOTAL: { sides: OVER_UNDER, hasLine: true, lineHint: "20.5, 22.5…" },
  THROWINS_OU: { sides: OVER_UNDER, hasLine: true, lineHint: "30.5, 35.5…" },
};

export const sidesFor = (key: MarketKey): MarketSidesConfig => MARKET_SIDES[key];
