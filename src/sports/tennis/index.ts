import type { AnalysisContextBase, EngineBundle } from "@/engine";
import type { SportModule } from "@/sports/contracts";
import { fetchTennisWindowFixtures } from "./providers";
import { analyzeTennis } from "./analyze";

// ML/Totals/Spread markets bypass the bonded engine entirely (own Markov model
// + EV in analyze.ts), so the engine bundle stays empty — the contract allows it.
const EMPTY_ENGINE: EngineBundle<AnalysisContextBase> = { adapters: [], rules: [] };

/**
 * Tennis — ATP + WTA. Fixtures from the odds-api.io tennis events feed (each
 * fixture IS an odds-api event; catalogId is the event id, so resolution in
 * analyze.ts is trivial/identity). Markets: ML_TENNIS, OU_GAMES, AH_GAMES
 * powered by the Markov point-level match model + Sackmann Elo/serve data.
 * No form/h2h (history/splits stay false); analyze() runs the standalone
 * Markov pipeline rather than the bonded engine.
 */
export const tennisModule: SportModule = {
  id: "tennis",
  oddsSlug: "tennis",
  capabilities: { catalog: true, odds: true, history: false, splits: false },
  engine: EMPTY_ENGINE,
  fixtureSources: () => [
    {
      key: ["commandCenter", "fixtures", "tennis-odds-api"] as const,
      fetch: () => fetchTennisWindowFixtures(),
    },
  ],
  analyze: (args) => analyzeTennis(args),
};
