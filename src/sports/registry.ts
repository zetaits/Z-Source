import { DEFAULT_SPORT_ID } from "@/config/sports";
import type { SportModule } from "./contracts";
import { footballModule } from "./football";
import { baseballModule } from "./baseball";
import { createStubModule } from "./stubModule";

/**
 * sportId -> SportModule. Every selectable sport in config/sports.ts MUST have
 * an entry here (guaranteed by sports/registry.test.ts). Fully-wired sports get
 * their own module; the rest get a stub until built.
 */
const MODULES: Record<string, SportModule> = {
  football: footballModule,
  baseball: baseballModule,
  basketball: createStubModule("basketball", "basketball_nba"),
  tennis: createStubModule("tennis", "tennis_atp"),
  amfootball: createStubModule("amfootball", "americanfootball_nfl"),
};

/** Resolve a sport module, falling back to the default sport then football. */
export const getSportModule = (sportId: string): SportModule =>
  MODULES[sportId] ?? MODULES[DEFAULT_SPORT_ID] ?? footballModule;

export const hasSportModule = (sportId: string): boolean => sportId in MODULES;

export const sportModuleIds = (): string[] => Object.keys(MODULES);
