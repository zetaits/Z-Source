import { describe, it, expect, beforeEach } from "vitest";
import { _internals } from "./oddsApiIoLeagues";
import { registerDiscovered, getDiscovered } from "./discoveredLeagues";
import { findLeagueById, findLeagueBySofa, allLeagues, LEAGUES } from "@/config/leagues";

const { countryCodeFor, tierFor, isTopAutoEnable, toDiscoveredLeague } = _internals;

describe("countryCodeFor", () => {
  it("maps known country prefixes to ISO codes", () => {
    expect(countryCodeFor("Spain - LaLiga")).toBe("ES");
    expect(countryCodeFor("England - Premier League")).toBe("GB-ENG");
  });
  it("maps international competitions to INT", () => {
    expect(countryCodeFor("International - FIFA World Cup")).toBe("INT");
    expect(countryCodeFor("International Clubs - CONMEBOL Libertadores")).toBe("INT");
  });
  it("falls back to a 3-letter code for unknown prefixes", () => {
    expect(countryCodeFor("Narnia - Super Cup")).toBe("NAR");
  });
});

describe("tierFor", () => {
  it("tiers marquee competitions at 0", () => {
    expect(tierFor("International Clubs - CONMEBOL Libertadores, Knockout stage")).toBe(0);
    expect(tierFor("International - FIFA World Cup")).toBe(0);
  });
  it("buries noise (women/youth) at tier 3", () => {
    expect(tierFor("International - Africa Cup of Nations, Women, Group A")).toBe(3);
    expect(tierFor("International Youth - U19 European Championship")).toBe(3);
  });
  it("defaults ordinary leagues to tier 2", () => {
    expect(tierFor("Kazakhstan - Premier League")).toBe(2);
  });
});

describe("isTopAutoEnable", () => {
  it("includes senior marquee comps", () => {
    expect(isTopAutoEnable("International Clubs - CONMEBOL Sudamericana, Knockout stage")).toBe(true);
    expect(isTopAutoEnable("International - UEFA Nations League")).toBe(true);
  });
  it("excludes women/youth variants of top comps", () => {
    expect(isTopAutoEnable("International - Africa Cup of Nations, Women, Group A")).toBe(false);
    expect(isTopAutoEnable("International Youth - U19 UEFA European Championship")).toBe(false);
  });
});

describe("toDiscoveredLeague", () => {
  it("builds a synthetic discovered LeagueDef", () => {
    const def = toDiscoveredLeague({
      name: "International Clubs - CONMEBOL Libertadores, Knockout stage",
      slug: "international-clubs-conmebol-libertadores-knockout-stage",
      eventsCount: 16,
    });
    expect(def.id).toBe("io-international-clubs-conmebol-libertadores-knockout-stage");
    expect(def.discovered).toBe(true);
    expect(def.oddsApiKey).toBe("");
    expect(def.sofaScoreId).toBe(0);
    expect(def.oddsApiIoSlugs).toEqual([
      "international-clubs-conmebol-libertadores-knockout-stage",
    ]);
    expect(def.eventsCount).toBe(16);
  });
});

describe("registry integration", () => {
  beforeEach(() => registerDiscovered([]));

  it("finds discovered leagues via findLeagueById and includes them in allLeagues", () => {
    const def = toDiscoveredLeague({ name: "Narnia - Cup", slug: "narnia-cup" });
    registerDiscovered([def]);
    expect(findLeagueById("io-narnia-cup")?.name).toBe("Narnia - Cup");
    expect(allLeagues()).toHaveLength(LEAGUES.length + 1);
    expect(getDiscovered()).toHaveLength(1);
  });

  it("keeps curated leagues taking precedence over discovered", () => {
    // A discovered entry that collides on id should never shadow a curated one.
    registerDiscovered([toDiscoveredLeague({ name: "Fake EPL", slug: "x" })]);
    expect(findLeagueById("epl")?.name).toBe("Premier League");
  });

  it("does not match discovered leagues by the 0 SofaScore sentinel", () => {
    registerDiscovered([toDiscoveredLeague({ name: "Narnia - Cup", slug: "narnia-cup" })]);
    expect(findLeagueBySofa(0)).toBeUndefined();
  });
});
