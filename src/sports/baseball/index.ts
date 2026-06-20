import type { AnalysisContextBase, EngineBundle } from "@/engine";
import type { SportModule } from "@/sports/contracts";
import { fetchMlbWindowFixtures } from "./providers";
import { analyzeBaseball } from "./analyze";

// K-props bypass the bonded engine entirely (own projection model + EV in
// analyze.ts), so the engine bundle stays empty — the contract allows it.
const EMPTY_ENGINE: EngineBundle<AnalysisContextBase> = { adapters: [], rules: [] };

/**
 * Baseball — first non-football module. Real fixtures feed (statsapi.mlb.com)
 * plus pitcher-strikeout props analysis off the shared odds-api.io feed. No
 * form/h2h (history/splits stay false); analyze() runs the standalone K-props
 * pipeline rather than the bonded engine.
 */
export const baseballModule: SportModule = {
  id: "baseball",
  oddsSlug: "baseball",
  capabilities: { catalog: true, odds: true, history: false, splits: false },
  engine: EMPTY_ENGINE,
  fixtureSources: () => [
    { key: ["commandCenter", "fixtures", "mlb-statsapi"] as const, fetch: () => fetchMlbWindowFixtures() },
  ],
  analyze: (args) => analyzeBaseball(args),
};
