import type { MarketKey } from "@/domain/market";
import type { MarketAdapter } from "../types";
import { asianHandicap } from "./asianHandicap";
import { btts } from "./btts";
import { cornersTotal } from "./corners";
import { drawNoBet } from "./drawNoBet";
import { mlMoneyline } from "./mlMoneyline";
import { overUnderGoals } from "./overUnderGoals";

export const MARKET_ADAPTERS: MarketAdapter[] = [
  mlMoneyline,
  drawNoBet,
  asianHandicap,
  overUnderGoals,
  btts,
  cornersTotal,
];

export const adapterByKey = (key: MarketKey): MarketAdapter | undefined =>
  MARKET_ADAPTERS.find((a) => a.key === key);

export { asianHandicap, btts, cornersTotal, drawNoBet, mlMoneyline, overUnderGoals };
