import type { AnalysisContextBase, EngineBundle } from "@/engine";
import { FOOTBALL_BUNDLE } from "@/engine";
import type { SportModule } from "@/sports/contracts";
import { analyzeFootball, FOOTBALL_ODDS_SLUG } from "./analyze";
import { footballFixtureSources } from "./fixtures";

/**
 * Football — the reference, fully-wired sport module. Odds via odds-api.io,
 * fixtures via the three-feed merge, history via SofaScore, and the complete
 * adapters + rules engine bundle.
 */
export const footballModule: SportModule = {
  id: "football",
  oddsSlug: FOOTBALL_ODDS_SLUG,
  capabilities: { catalog: true, odds: true, history: true, splits: true },
  engine: FOOTBALL_BUNDLE as unknown as EngineBundle<AnalysisContextBase>,
  fixtureSources: footballFixtureSources,
  analyze: analyzeFootball,
};
