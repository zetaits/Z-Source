import type { AnalysisContextBase, EngineBundle } from "@/engine";
import type { SportModule } from "./contracts";
import { emptyAnalysis } from "./emptyAnalysis";

const EMPTY_ENGINE: EngineBundle<AnalysisContextBase> = { adapters: [], rules: [] };

/**
 * A registered-but-unwired sport: no fixtures feed and no analysis engine yet.
 * Keeps the sport selectable in the rail while everything renders empty states.
 * Replace with a full module (own providers + engine) when the sport is built.
 */
export const createStubModule = (
  id: string,
  oddsSlug: string | null = null,
): SportModule => ({
  id,
  oddsSlug,
  capabilities: { catalog: false, odds: oddsSlug !== null, history: false, splits: false },
  engine: EMPTY_ENGINE,
  fixtureSources: () => [],
  analyze: () => emptyAnalysis("no-engine", `${id} module is a stub — no data wired yet.`),
});
