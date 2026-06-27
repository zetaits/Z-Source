import { describe, expect, it } from "vitest";
import type { CatalogMatch } from "@/domain/match";
import { LeagueId } from "@/domain/ids";
import { selectAnalyzableMlbGames } from "./mlbBatchAnalysis";

const mkMatch = (catalogId: string, source: string): CatalogMatch =>
  ({
    catalogId,
    source,
    leagueId: LeagueId("mlb"),
    kickoffAt: "2026-06-23T23:05:00.000Z",
    home: { name: "Home" },
    away: { name: "Away" },
    status: "scheduled",
  }) as unknown as CatalogMatch;

describe("selectAnalyzableMlbGames", () => {
  it("keeps only mlb-statsapi games whose lineup is posted", () => {
    const matches = [
      mkMatch("1", "mlb-statsapi"), // posted
      mkMatch("2", "mlb-statsapi"), // not posted
      mkMatch("3", "mlb-statsapi"), // absent from map
      mkMatch("4", "odds-api-io"), // wrong source, even if posted
    ];
    const status = new Map<string, boolean>([
      ["1", true],
      ["2", false],
      ["4", true],
    ]);
    const out = selectAnalyzableMlbGames(matches, status);
    expect(out.map((m) => m.catalogId)).toEqual(["1"]);
  });

  it("returns nothing while the lineup status is still loading (null)", () => {
    expect(selectAnalyzableMlbGames([mkMatch("1", "mlb-statsapi")], null)).toEqual([]);
  });
});
