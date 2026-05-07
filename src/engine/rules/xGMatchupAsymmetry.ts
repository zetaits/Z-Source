import type { Rule, RuleOutput } from "../types";
import { clamp } from "../ev";

const XG_FOR_HIGH = 1.7;
const XG_AGAINST_HIGH = 1.5;
const XG_FOR_LOW = 1.0;
const XG_AGAINST_LOW = 0.9;
const MAX_STRENGTH = 0.55;

export const xGMatchupAsymmetry: Rule = {
  id: "xg-matchup-asymmetry",
  description:
    "Crosses home/away xG attack vs defence rates to detect mismatches favoring Over, BTTS, or Under.",
  markets: ["OU_GOALS", "BTTS"],
  leg: "matchup",
  defaultWeight: 1,
  run: ({ ctx, selection, config }): RuleOutput | null => {
    const home = ctx.homeForm;
    const away = ctx.awayForm;
    if (!home || !away) return null;
    if (
      home.xGForLast === undefined ||
      home.xGAgainstLast === undefined ||
      away.xGForLast === undefined ||
      away.xGAgainstLast === undefined ||
      home.lastN === 0 ||
      away.lastN === 0
    )
      return null;

    const homeXGFor = home.xGForLast / home.lastN;
    const homeXGAgainst = home.xGAgainstLast / home.lastN;
    const awayXGFor = away.xGForLast / away.lastN;
    const awayXGAgainst = away.xGAgainstLast / away.lastN;

    // Over/BTTS mismatch: high-attack vs leaky defence
    const offensiveMismatch =
      (homeXGFor >= XG_FOR_HIGH && awayXGAgainst >= XG_AGAINST_HIGH) ||
      (awayXGFor >= XG_FOR_HIGH && homeXGAgainst >= XG_AGAINST_HIGH);

    // Under mismatch: both teams attack-weak and defence-solid
    const defensiveMismatch =
      homeXGFor <= XG_FOR_LOW &&
      awayXGFor <= XG_FOR_LOW &&
      homeXGAgainst <= XG_AGAINST_LOW &&
      awayXGAgainst <= XG_AGAINST_LOW;

    const marketKey = selection.marketKey;
    const side = selection.side;

    if (offensiveMismatch) {
      if (
        (marketKey === "OU_GOALS" && side === "over") ||
        (marketKey === "BTTS" && side === "yes")
      ) {
        const score =
          Math.max(
            homeXGFor - XG_FOR_HIGH,
            awayXGFor - XG_FOR_HIGH,
            homeXGAgainst - XG_AGAINST_HIGH,
            awayXGAgainst - XG_AGAINST_HIGH,
            0,
          );
        const strength = clamp(0.25 + score * 0.15, 0.25, MAX_STRENGTH);
        return {
          ruleId: "xg-matchup-asymmetry",
          leg: "matchup",
          verdict: "SUPPORT",
          strength,
          weight: config.weight,
          message: `xG attack-vs-defence mismatch · home ${homeXGFor.toFixed(2)} xGF / away ${awayXGFor.toFixed(2)} xGF · favours ${side}`,
          data: { homeXGFor, homeXGAgainst, awayXGFor, awayXGAgainst, mismatch: "offensive" },
        };
      }
      if (
        (marketKey === "OU_GOALS" && side === "under") ||
        (marketKey === "BTTS" && side === "no")
      ) {
        return {
          ruleId: "xg-matchup-asymmetry",
          leg: "matchup",
          verdict: "AGAINST",
          strength: -0.25,
          weight: config.weight,
          message: `xG mismatch signals goals · ${side} goes against the grain`,
          data: { homeXGFor, homeXGAgainst, awayXGFor, awayXGAgainst, mismatch: "offensive" },
        };
      }
    }

    if (defensiveMismatch) {
      if (
        (marketKey === "OU_GOALS" && side === "under") ||
        (marketKey === "BTTS" && side === "no")
      ) {
        const score =
          XG_FOR_LOW -
          Math.min(homeXGFor, awayXGFor) +
          (XG_AGAINST_LOW - Math.min(homeXGAgainst, awayXGAgainst));
        const strength = clamp(0.25 + score * 0.15, 0.25, MAX_STRENGTH);
        return {
          ruleId: "xg-matchup-asymmetry",
          leg: "matchup",
          verdict: "SUPPORT",
          strength,
          weight: config.weight,
          message: `xG low-scoring mismatch · home ${homeXGFor.toFixed(2)} / away ${awayXGFor.toFixed(2)} xGF · favours ${side}`,
          data: { homeXGFor, homeXGAgainst, awayXGFor, awayXGAgainst, mismatch: "defensive" },
        };
      }
    }

    return null;
  },
};
