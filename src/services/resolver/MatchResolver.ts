import type { MatchId } from "@/domain/ids";
import type { CatalogMatch } from "@/domain/match";
import { teamSimilarity } from "./teamNameNormalizer";

export interface ResolverEvent {
  eventId: string;
  homeName: string;
  awayName: string;
  kickoffAt: string;
}

export interface ResolverEventSource {
  listEvents(opts: { from: Date; to: Date }): Promise<ResolverEvent[]>;
}

export interface ResolutionResult {
  matchId: MatchId | null;
  confidence: number;
  matched?: ResolverEvent;
}

export interface MatchResolver {
  resolve(catalog: CatalogMatch): Promise<ResolutionResult>;
}

export interface MatchResolverOptions {
  kickoffToleranceMinutes: number;
  minConfidence: number;
}

const DEFAULT_OPTS: MatchResolverOptions = {
  kickoffToleranceMinutes: 15,
  minConfidence: 0.85,
};

export const scoreEventMatch = (
  catalog: CatalogMatch,
  ev: ResolverEvent,
  opts: MatchResolverOptions = DEFAULT_OPTS,
): number => {
  const homeSim = teamSimilarity(catalog.home.name, ev.homeName);
  const awaySim = teamSimilarity(catalog.away.name, ev.awayName);
  const nameScore = (homeSim + awaySim) / 2;
  const dt = Math.abs(
    new Date(catalog.kickoffAt).getTime() - new Date(ev.kickoffAt).getTime(),
  );
  const toleranceMs = opts.kickoffToleranceMinutes * 60 * 1000;
  if (dt > toleranceMs) return 0;
  const timeScore = 1 - dt / toleranceMs;
  return nameScore * 0.85 + timeScore * 0.15;
};

export const createMatchResolver = (
  source: ResolverEventSource,
  opts: Partial<MatchResolverOptions> = {},
): MatchResolver => {
  const cfg: MatchResolverOptions = { ...DEFAULT_OPTS, ...opts };
  return {
    async resolve(catalog) {
      const window = cfg.kickoffToleranceMinutes * 60 * 1000;
      const ko = new Date(catalog.kickoffAt).getTime();
      const events = await source.listEvents({
        from: new Date(ko - window * 2),
        to: new Date(ko + window * 2),
      });
      let best: { ev: ResolverEvent; score: number } | null = null;
      for (const ev of events) {
        const score = scoreEventMatch(catalog, ev, cfg);
        if (!best || score > best.score) best = { ev, score };
      }
      if (!best || best.score < cfg.minConfidence) {
        return { matchId: null, confidence: best?.score ?? 0 };
      }
      return {
        matchId: best.ev.eventId as MatchId,
        confidence: best.score,
        matched: best.ev,
      };
    },
  };
};
