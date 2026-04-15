import type { CatalogMatch, CatalogMatchDetails, League } from "@/domain/match";
import type { LeagueId } from "@/domain/ids";

export interface CatalogProvider {
  readonly name: string;
  listLeagues(opts?: { sport?: "football" }): Promise<League[]>;
  listFixtures(opts: {
    leagueIds: LeagueId[];
    from: Date;
    to: Date;
  }): Promise<CatalogMatch[]>;
  getMatchDetails?(catalogMatchId: string): Promise<CatalogMatchDetails>;
}
