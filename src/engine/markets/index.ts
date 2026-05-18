import type { MarketKey } from "@/domain/market";
import type { MarketAdapter } from "../types";
import { asianHandicap } from "./asianHandicap";
import { btts } from "./btts";
import { bttsFirstHalf, bttsSecondHalf } from "./bttsHalves";
import { cornersTotal } from "./corners";
import { doubleChance } from "./doubleChance";
import { drawNoBet } from "./drawNoBet";
import { mlMoneyline } from "./mlMoneyline";
import { overUnderGoals } from "./overUnderGoals";
import { teamTotalGoalsAway, teamTotalGoalsHome } from "./teamTotalGoals";

export const MARKET_ADAPTERS: MarketAdapter[] = [
  mlMoneyline,
  drawNoBet,
  asianHandicap,
  overUnderGoals,
  btts,
  bttsFirstHalf,
  bttsSecondHalf,
  cornersTotal,
  doubleChance,
  teamTotalGoalsHome,
  teamTotalGoalsAway,
];

export const adapterByKey = (key: MarketKey): MarketAdapter | undefined =>
  MARKET_ADAPTERS.find((a) => a.key === key);

export {
  asianHandicap,
  btts,
  bttsFirstHalf,
  bttsSecondHalf,
  cornersTotal,
  doubleChance,
  drawNoBet,
  mlMoneyline,
  overUnderGoals,
  teamTotalGoalsAway,
  teamTotalGoalsHome,
};
