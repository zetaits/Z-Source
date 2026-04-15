import type { MatchId, TeamId } from "@/domain/ids";
import type {
  FormResult,
  H2H,
  InjuryNote,
  Intangibles,
  TeamForm,
  TeamFormGame,
} from "@/domain/history";
import type { HistoryProvider } from "@/services/providers/HistoryProvider";
import { mulberry32, randomBetween, randomInt, seedFromString, type Prng } from "./mockSeed";

const WEATHER_CONDITIONS = ["Clear", "Overcast", "Drizzle", "Rain", "Snow", "Wind"] as const;

const pickResult = (prng: Prng, winBias: number): FormResult => {
  const r = prng();
  if (r < 0.1 + winBias * 0.05) return "D";
  if (r < 0.55 + winBias * 0.25) return "W";
  return "L";
};

const daysAgo = (n: number): string =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

const buildForm = (teamId: TeamId, lastN: number): TeamForm => {
  const prng = mulberry32(seedFromString(`${teamId}|form|${lastN}`));
  const strength = randomBetween(prng, -0.4, 0.4);

  const games: TeamFormGame[] = [];
  let goalsFor = 0;
  let goalsAgainst = 0;
  let cleanSheets = 0;
  let bttsCount = 0;
  let points = 0;

  for (let i = 0; i < lastN; i++) {
    const result = pickResult(prng, strength);
    const isHome = prng() < 0.5;
    const gf =
      result === "W"
        ? randomInt(prng, 1, 4)
        : result === "D"
          ? randomInt(prng, 0, 2)
          : randomInt(prng, 0, 2);
    const ga =
      result === "W"
        ? randomInt(prng, 0, Math.max(0, gf - 1))
        : result === "D"
          ? gf
          : randomInt(prng, gf + 1, gf + 3);

    goalsFor += gf;
    goalsAgainst += ga;
    if (ga === 0) cleanSheets += 1;
    if (gf > 0 && ga > 0) bttsCount += 1;
    points += result === "W" ? 3 : result === "D" ? 1 : 0;

    games.push({
      matchId: `${teamId}:game${i}` as MatchId,
      date: daysAgo((lastN - i) * 7 + randomInt(prng, -1, 1)),
      opponentId: `${teamId}:opp${i}` as TeamId,
      opponentName: `Opponent ${i + 1}`,
      isHome,
      goalsFor: gf,
      goalsAgainst: ga,
      result,
    });
  }

  return {
    teamId,
    lastN,
    games,
    goalsFor,
    goalsAgainst,
    cleanSheets,
    bttsRate: lastN > 0 ? bttsCount / lastN : 0,
    ppgLast: lastN > 0 ? points / lastN : 0,
  };
};

const buildH2H = (homeId: TeamId, awayId: TeamId): H2H => {
  const prng = mulberry32(seedFromString(`${homeId}|${awayId}|h2h`));
  const size = randomInt(prng, 3, 6);
  const meetings: TeamFormGame[] = [];
  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  let totalGoals = 0;

  for (let i = 0; i < size; i++) {
    const r = prng();
    const result: FormResult = r < 0.38 ? "W" : r < 0.7 ? "L" : "D";
    const homeGoals = result === "W" ? randomInt(prng, 1, 3) : randomInt(prng, 0, 2);
    const awayGoals = result === "L" ? randomInt(prng, 1, 3) : randomInt(prng, 0, 2);
    const isHome = prng() < 0.5;
    totalGoals += homeGoals + awayGoals;
    if (result === "W") homeWins += 1;
    else if (result === "L") awayWins += 1;
    else draws += 1;

    meetings.push({
      matchId: `${homeId}:${awayId}:h2h${i}` as MatchId,
      date: daysAgo((size - i) * 180 + randomInt(prng, -14, 14)),
      opponentId: awayId,
      opponentName: "H2H meeting",
      isHome,
      goalsFor: homeGoals,
      goalsAgainst: awayGoals,
      result,
    });
  }

  return {
    homeId,
    awayId,
    meetings,
    homeWins,
    awayWins,
    draws,
    averageGoals: size > 0 ? totalGoals / size : 0,
  };
};

const buildInjuries = (prng: Prng): InjuryNote[] => {
  const count = randomInt(prng, 0, 3);
  const out: InjuryNote[] = [];
  const importance: InjuryNote["importance"][] = ["KEY", "ROTATION", "FRINGE"];
  const status: InjuryNote["status"][] = ["OUT", "DOUBT", "RETURNING"];
  for (let i = 0; i < count; i++) {
    out.push({
      player: `Player ${randomInt(prng, 1, 30)}`,
      status: status[randomInt(prng, 0, status.length - 1)],
      importance: importance[randomInt(prng, 0, importance.length - 1)],
      position: ["GK", "DEF", "MID", "FWD"][randomInt(prng, 0, 3)],
    });
  }
  return out;
};

const buildIntangibles = (matchId: MatchId): Intangibles => {
  const prng = mulberry32(seedFromString(`${matchId}|intangibles`));
  return {
    matchId,
    homeRestDays: randomInt(prng, 3, 9),
    awayRestDays: randomInt(prng, 2, 9),
    homeCongestion: randomInt(prng, 0, 3),
    awayCongestion: randomInt(prng, 0, 3),
    homeInjuries: buildInjuries(prng),
    awayInjuries: buildInjuries(prng),
    motivation: {
      home: prng() < 0.5 ? "Title race" : "Mid-table",
      away: prng() < 0.5 ? "Relegation fight" : "Europe push",
    },
    weather: {
      tempC: Math.round(randomBetween(prng, 2, 28)),
      windKph: Math.round(randomBetween(prng, 0, 30)),
      condition: WEATHER_CONDITIONS[randomInt(prng, 0, WEATHER_CONDITIONS.length - 1)],
    },
  };
};

export const createMockHistoryProvider = (): HistoryProvider => ({
  name: "Mock (deterministic)",
  async getForm(teamId: TeamId, lastN: number): Promise<TeamForm> {
    return buildForm(teamId, lastN);
  },
  async getH2H(homeId: TeamId, awayId: TeamId): Promise<H2H> {
    return buildH2H(homeId, awayId);
  },
  async getIntangibles(matchId: MatchId): Promise<Intangibles> {
    return buildIntangibles(matchId);
  },
});
